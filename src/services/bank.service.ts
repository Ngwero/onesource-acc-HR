import { prisma } from "@/lib/prisma";
import { generateDocumentNumber } from "@/lib/utils";
import { isOutflowTransaction } from "@/lib/payment-allocation";
import { createPaymentWithAllocations, getUnmatchedPayments } from "./payment.service";
import { postBankVarianceJournal, postPaymentJournal } from "./accounting.service";
import { createAuditLog } from "./audit.service";

export async function getBankAccounts() {
  return prisma.bankAccount.findMany({
    where: { isActive: true },
    include: { glAccount: true, _count: { select: { transactions: true } } },
    orderBy: { name: "asc" },
  });
}

export async function importBankTransactions(
  bankAccountId: string,
  transactions: Array<{
    date: string;
    description: string;
    reference?: string;
    amount: number;
    type: "DEPOSIT" | "WITHDRAWAL" | "FEE" | "INTEREST" | "TRANSFER" | "PAYMENT" | "RECEIPT";
  }>
) {
  const batch = `IMPORT-${Date.now()}`;
  const toCreate: typeof transactions = [];
  let skipped = 0;

  for (const t of transactions) {
    const txDate = new Date(t.date);
    const amount = Math.abs(t.amount);
    const duplicate = await prisma.bankTransaction.findFirst({
      where: {
        bankAccountId,
        date: txDate,
        amount,
        description: t.description,
        reference: t.reference || null,
        reconciliationStatus: { not: "EXCLUDED" },
      },
    });
    if (duplicate) {
      skipped++;
      continue;
    }
    toCreate.push(t);
  }

  if (toCreate.length === 0) {
    return { imported: 0, skipped, batch };
  }

  const created = await prisma.$transaction(
    toCreate.map((t) =>
      prisma.bankTransaction.create({
        data: {
          bankAccountId,
          date: new Date(t.date),
          description: t.description,
          reference: t.reference,
          amount: Math.abs(t.amount),
          type: t.type,
          importBatch: batch,
        },
      })
    )
  );

  const netChange = toCreate.reduce((sum, t) => {
    const isInflow = ["DEPOSIT", "RECEIPT", "INTEREST"].includes(t.type);
    return sum + (isInflow ? t.amount : -Math.abs(t.amount));
  }, 0);

  await prisma.bankAccount.update({
    where: { id: bankAccountId },
    data: { currentBalance: { increment: netChange } },
  });

  return { imported: created.length, skipped, batch };
}

export async function suggestPaymentMatches(transactionId: string) {
  const tx = await prisma.bankTransaction.findUnique({
    where: { id: transactionId },
    include: { bankAccount: true, matchedPayment: true },
  });
  if (!tx) throw new Error("Bank transaction not found");
  if (tx.reconciliationStatus !== "UNRECONCILED") {
    throw new Error("Transaction is already reconciled");
  }

  const outflow = isOutflowTransaction(tx.type);
  const amount = Number(tx.amount);
  const fromDate = new Date(tx.date);
  fromDate.setDate(fromDate.getDate() - 14);
  const toDate = new Date(tx.date);
  toDate.setDate(toDate.getDate() + 14);

  const matchedIds = (
    await prisma.bankTransaction.findMany({
      where: { matchedPaymentId: { not: null } },
      select: { matchedPaymentId: true },
    })
  )
    .map((t) => t.matchedPaymentId)
    .filter(Boolean) as string[];

  const [exactPayments, referencePayments, openItems] = await Promise.all([
    getUnmatchedPayments({ isOutflow: outflow, amount, fromDate, toDate }),
    tx.reference
      ? prisma.payment.findMany({
          where: {
            ...(matchedIds.length > 0 ? { id: { notIn: matchedIds } } : {}),
            reference: { contains: tx.reference, mode: "insensitive" },
          },
          include: {
            payable: { include: { supplier: true } },
            receivable: { include: { customer: true } },
            allocations: true,
          },
          take: 10,
        })
      : Promise.resolve([]),
    outflow
      ? prisma.payable.findMany({
          where: { status: { in: ["UNPAID", "PARTIALLY_PAID", "OVERDUE"] } },
          include: { supplier: true },
          orderBy: { dueDate: "asc" },
          take: 20,
        })
      : prisma.receivable.findMany({
          where: { status: { in: ["UNPAID", "PARTIALLY_PAID", "OVERDUE"] } },
          include: { customer: true },
          orderBy: { dueDate: "asc" },
          take: 20,
        }),
  ]);

  const paymentMap = new Map<string, (typeof exactPayments)[0]>();
  for (const p of [...exactPayments, ...referencePayments]) {
    paymentMap.set(p.id, p);
  }

  return {
    transaction: tx,
    suggestedPayments: Array.from(paymentMap.values()),
    openPayables: outflow ? openItems : [],
    openReceivables: outflow ? [] : openItems,
  };
}

export async function matchBankTransaction(
  transactionId: string,
  paymentId: string,
  userId: string
) {
  const tx = await prisma.bankTransaction.findUnique({ where: { id: transactionId } });
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!tx || !payment) throw new Error("Transaction or payment not found");
  if (tx.reconciliationStatus !== "UNRECONCILED") {
    throw new Error("Transaction already reconciled");
  }
  if (Math.abs(Number(tx.amount) - Number(payment.amount)) > 0.01) {
    throw new Error("Payment amount does not match bank transaction");
  }

  const updated = await prisma.bankTransaction.update({
    where: { id: transactionId },
    data: {
      reconciliationStatus: "RECONCILED",
      matchedPaymentId: paymentId,
    },
    include: { matchedPayment: true, bankAccount: true },
  });

  await createAuditLog({
    userId,
    action: "BANK_MATCHED",
    module: "bank",
    recordId: transactionId,
    newValue: { paymentId, paymentNumber: payment.paymentNumber },
  });

  return updated;
}

export async function matchBankWithNewPayment(
  transactionId: string,
  data: {
    userId: string;
    allocations: Array<{ payableId?: string; receivableId?: string; amount: number }>;
    reference?: string;
    notes?: string;
  }
) {
  const tx = await prisma.bankTransaction.findUnique({
    where: { id: transactionId },
    include: { bankAccount: true },
  });
  if (!tx) throw new Error("Bank transaction not found");
  if (tx.reconciliationStatus !== "UNRECONCILED") {
    throw new Error("Transaction already reconciled");
  }

  const amount = Number(tx.amount);
  const outflow = isOutflowTransaction(tx.type);

  const payment = await createPaymentWithAllocations({
    userId: data.userId,
    amount,
    paymentMethod: "BANK_TRANSFER",
    bankAccountId: tx.bankAccountId,
    reference: data.reference || tx.reference || tx.description,
    notes: data.notes || `Matched to bank tx ${tx.id}`,
    allocations: data.allocations,
    skipBankBalanceUpdate: true,
    allowOverpay: true,
  });

  const updated = await prisma.bankTransaction.update({
    where: { id: transactionId },
    data: {
      reconciliationStatus: "RECONCILED",
      matchedPaymentId: payment.id,
    },
    include: { matchedPayment: true },
  });

  return { payment, transaction: updated };
}

export async function excludeBankTransaction(transactionId: string, userId: string) {
  const updated = await prisma.bankTransaction.update({
    where: { id: transactionId },
    data: { reconciliationStatus: "EXCLUDED" },
  });

  await createAuditLog({
    userId,
    action: "BANK_EXCLUDED",
    module: "bank",
    recordId: transactionId,
  });

  return updated;
}

export async function matchBankToInvoice(
  transactionId: string,
  invoiceId: string,
  userId: string
) {
  const [tx, invoice] = await Promise.all([
    prisma.bankTransaction.findUnique({ where: { id: transactionId } }),
    prisma.invoice.findUnique({ where: { id: invoiceId }, include: { customer: true } }),
  ]);
  if (!tx || !invoice) throw new Error("Transaction or invoice not found");
  if (tx.reconciliationStatus !== "UNRECONCILED") {
    throw new Error("Transaction already reconciled");
  }
  if (Math.abs(Number(tx.amount) - Number(invoice.balance)) > 0.01) {
    throw new Error("Bank amount does not match invoice balance");
  }

  const receivable = invoice.saleId
    ? await prisma.receivable.findFirst({ where: { saleId: invoice.saleId } })
    : await prisma.receivable.findFirst({
        where: { customerId: invoice.customerId, invoiceNumber: invoice.invoiceNumber },
      });

  if (receivable) {
    const result = await matchBankWithNewPayment(transactionId, {
      userId,
      allocations: [{ receivableId: receivable.id, amount: Number(tx.amount) }],
      reference: invoice.invoiceNumber,
      notes: `Matched to invoice ${invoice.invoiceNumber}`,
    });
    await prisma.bankTransaction.update({
      where: { id: transactionId },
      data: { matchedInvoiceId: invoiceId },
    });
    return result.transaction;
  }

  const updated = await prisma.bankTransaction.update({
    where: { id: transactionId },
    data: {
      reconciliationStatus: "RECONCILED",
      matchedInvoiceId: invoiceId,
    },
    include: { matchedInvoice: true },
  });

  await createAuditLog({
    userId,
    action: "BANK_MATCHED_INVOICE",
    module: "bank",
    recordId: transactionId,
    newValue: { invoiceId, invoiceNumber: invoice.invoiceNumber },
  });

  return updated;
}

export async function splitBankTransaction(
  transactionId: string,
  splits: Array<{ amount: number; description?: string }>,
  userId: string
) {
  const parent = await prisma.bankTransaction.findUnique({ where: { id: transactionId } });
  if (!parent) throw new Error("Bank transaction not found");
  if (parent.reconciliationStatus !== "UNRECONCILED") {
    throw new Error("Only unreconciled transactions can be split");
  }
  if (parent.parentTransactionId) {
    throw new Error("Cannot split a child split transaction");
  }

  const splitTotal = splits.reduce((s, x) => s + x.amount, 0);
  if (Math.abs(splitTotal - Number(parent.amount)) > 0.01) {
    throw new Error("Split amounts must equal the original transaction amount");
  }

  const children = await prisma.$transaction(async (tx) => {
    const created = [];
    for (const split of splits) {
      const child = await tx.bankTransaction.create({
        data: {
          bankAccountId: parent.bankAccountId,
          date: parent.date,
          description: split.description || `${parent.description} (split)`,
          reference: parent.reference,
          amount: split.amount,
          type: parent.type,
          parentTransactionId: parent.id,
          importBatch: parent.importBatch,
        },
      });
      created.push(child);
    }
    await tx.bankTransaction.update({
      where: { id: transactionId },
      data: { reconciliationStatus: "RECONCILED", isSplit: true },
    });
    return created;
  });

  await createAuditLog({
    userId,
    action: "BANK_SPLIT",
    module: "bank",
    recordId: transactionId,
    newValue: { splitCount: splits.length },
  });

  return { parentId: transactionId, children };
}

export async function reconcileTransaction(
  transactionId: string,
  match: { paymentId?: string; invoiceId?: string }
) {
  return prisma.bankTransaction.update({
    where: { id: transactionId },
    data: {
      reconciliationStatus: "RECONCILED",
      matchedPaymentId: match.paymentId,
      matchedInvoiceId: match.invoiceId,
    },
  });
}

export async function getUnreconciledTransactions(bankAccountId?: string) {
  return prisma.bankTransaction.findMany({
    where: {
      reconciliationStatus: "UNRECONCILED",
      ...(bankAccountId && { bankAccountId }),
    },
    include: { bankAccount: true, matchedPayment: true },
    orderBy: { date: "desc" },
  });
}

export async function createBankReconciliation(data: {
  bankAccountId: string;
  statementDate: string;
  openingBalance: number;
  closingBalance: number;
  userId: string;
  notes?: string;
  postVariance?: boolean;
}) {
  const account = await prisma.bankAccount.findUnique({
    where: { id: data.bankAccountId },
  });
  if (!account) throw new Error("Bank account not found");

  const unreconciled = await prisma.bankTransaction.count({
    where: { bankAccountId: data.bankAccountId, reconciliationStatus: "UNRECONCILED" },
  });

  if (unreconciled > 0) {
    throw new Error(`${unreconciled} transactions still unreconciled — match or exclude them first`);
  }

  const bookBalance = Number(account.currentBalance);
  const variance = data.closingBalance - bookBalance;
  let varianceJournalRef: string | null = null;

  if (Math.abs(variance) >= 0.01 && data.postVariance !== false) {
    const ref = `BANK-REC-${data.bankAccountId.slice(-6)}-${data.statementDate}`;
    const journal = await postBankVarianceJournal(variance, data.userId, ref);
    varianceJournalRef = journal?.journalNumber || null;

    await prisma.bankAccount.update({
      where: { id: data.bankAccountId },
      data: { currentBalance: data.closingBalance },
    });
  }

  const rec = await prisma.bankReconciliation.create({
    data: {
      bankAccountId: data.bankAccountId,
      statementDate: new Date(data.statementDate),
      openingBalance: data.openingBalance,
      closingBalance: data.closingBalance,
      bookBalance,
      varianceAmount: variance,
      varianceJournalRef,
      reconciledById: data.userId,
      reconciledAt: new Date(),
      notes: data.notes,
    },
    include: { bankAccount: true },
  });

  await createAuditLog({
    userId: data.userId,
    action: "BANK_RECONCILIATION_COMPLETED",
    module: "bank",
    recordId: rec.id,
    newValue: { variance, varianceJournalRef },
  });

  return rec;
}

export async function createBatchPayment(data: {
  bankAccountId: string;
  payableIds: string[];
  userId: string;
}) {
  const payables = await prisma.payable.findMany({
    where: { id: { in: data.payableIds }, status: { in: ["UNPAID", "PARTIALLY_PAID", "OVERDUE"] } },
  });

  if (payables.length === 0) throw new Error("No valid payables selected");

  const batchNumber = await generateDocumentNumber("BATCH", prisma);
  const allocations = payables.map((p) => ({
    payableId: p.id,
    amount: Number(p.balance),
  }));
  const totalAmount = allocations.reduce((s, a) => s + a.amount, 0);

  const batch = await prisma.$transaction(async (tx) => {
    const items = [];
    for (const alloc of allocations) {
      items.push({ payableId: alloc.payableId, amount: alloc.amount });
    }

    return tx.batchPayment.create({
      data: {
        batchNumber,
        bankAccountId: data.bankAccountId,
        totalAmount,
        paymentCount: items.length,
        status: "POSTED",
        createdById: data.userId,
        items: { create: items },
      },
      include: { items: { include: { payable: { include: { supplier: true } } } } },
    });
  });

  const payment = await createPaymentWithAllocations({
    userId: data.userId,
    amount: totalAmount,
    paymentMethod: "BANK_TRANSFER",
    bankAccountId: data.bankAccountId,
    reference: batchNumber,
    notes: `Batch payment ${batchNumber}`,
    allocations,
  });

  return { batch, payment };
}

export async function getReconciliationSummary(bankAccountId: string) {
  const account = await prisma.bankAccount.findUnique({ where: { id: bankAccountId } });
  if (!account) throw new Error("Bank account not found");

  const unreconciled = await prisma.bankTransaction.findMany({
    where: { bankAccountId, reconciliationStatus: "UNRECONCILED" },
  });

  const unreconciledTotal = unreconciled.reduce((sum, tx) => {
    const signed = isOutflowTransaction(tx.type) ? -Number(tx.amount) : Number(tx.amount);
    return sum + signed;
  }, 0);

  return {
    bookBalance: Number(account.currentBalance),
    unreconciledCount: unreconciled.length,
    unreconciledTotal,
    adjustedBalance: Number(account.currentBalance) + unreconciledTotal,
  };
}
