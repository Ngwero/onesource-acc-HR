import { prisma } from "@/lib/prisma";
import { generateDocumentNumber } from "@/lib/utils";
import type { CurrencyCode } from "@/generated/prisma/client";
import { createAuditLog } from "./audit.service";
import { getTrialBalanceFromGl } from "./gl.service";

async function getAccountByCode(code: string) {
  const account = await prisma.chartOfAccount.findUnique({ where: { code } });
  if (!account) throw new Error(`Account ${code} not found`);
  return account;
}

async function updateAccountBalance(accountId: string, amount: number, isDebit: boolean) {
  const account = await prisma.chartOfAccount.findUnique({ where: { id: accountId } });
  if (!account) return;

  // 1210 Accumulated Depreciation is contra-asset (credit-normal)
  const isDebitNormal =
    account.code !== "1210" &&
    (account.accountType === "ASSET" ||
      account.accountType === "EXPENSE" ||
      account.accountType === "COGS");

  const delta = isDebitNormal
    ? isDebit
      ? amount
      : -amount
    : isDebit
      ? -amount
      : amount;

  await prisma.chartOfAccount.update({
    where: { id: accountId },
    data: { balance: { increment: delta } },
  });
}

interface JournalLineInput {
  debitAccountCode: string;
  creditAccountCode: string;
  amount: number;
  description?: string;
}

interface PostJournalParams {
  description: string;
  reference?: string;
  lines: JournalLineInput[];
  userId: string;
  currency?: CurrencyCode;
  exchangeRate?: number;
  autoPost?: boolean;
  entryDate?: Date;
  skipPeriodCheck?: boolean;
}

export async function postJournalEntry(params: PostJournalParams) {
  if (!params.skipPeriodCheck) {
    const { assertPeriodOpen } = await import("./period.service");
    await assertPeriodOpen(params.entryDate || new Date());
  }

  const journalNumber = await generateDocumentNumber("JE", prisma);

  const lines = [];
  for (const line of params.lines) {
    const debitAccount = await getAccountByCode(line.debitAccountCode);
    const creditAccount = await getAccountByCode(line.creditAccountCode);

    lines.push({
      debitAccountId: debitAccount.id,
      creditAccountId: creditAccount.id,
      amount: line.amount,
      description: line.description,
    });
  }

  const entry = await prisma.journalEntry.create({
    data: {
      journalNumber,
      date: params.entryDate || new Date(),
      description: params.description,
      reference: params.reference,
      currency: params.currency || "UGX",
      exchangeRate: params.exchangeRate || 1,
      status: params.autoPost !== false ? "POSTED" : "DRAFT",
      createdById: params.userId,
      approvedById: params.autoPost !== false ? params.userId : undefined,
      approvedAt: params.autoPost !== false ? new Date() : undefined,
      lines: { create: lines },
    },
    include: { lines: true },
  });

  if (params.autoPost !== false) {
    for (const line of params.lines) {
      const debitAccount = await getAccountByCode(line.debitAccountCode);
      const creditAccount = await getAccountByCode(line.creditAccountCode);
      await updateAccountBalance(debitAccount.id, line.amount, true);
      await updateAccountBalance(creditAccount.id, line.amount, false);
    }
  }

  await createAuditLog({
    userId: params.userId,
    action: "JOURNAL_POSTED",
    module: "ledger",
    recordId: entry.id,
    newValue: { journalNumber, description: params.description },
  });

  return entry;
}

export async function postDraftJournal(entryId: string, userId: string) {
  const entry = await prisma.journalEntry.findUnique({
    where: { id: entryId },
    include: { lines: true },
  });
  if (!entry) throw new Error("Journal entry not found");
  if (entry.status !== "DRAFT") throw new Error("Only draft entries can be posted");

  const { assertPeriodOpen } = await import("./period.service");
  await assertPeriodOpen(entry.date);

  for (const line of entry.lines) {
    if (!line.debitAccountId || !line.creditAccountId) {
      throw new Error("Journal line missing debit or credit account");
    }
    await updateAccountBalance(line.debitAccountId, Number(line.amount), true);
    await updateAccountBalance(line.creditAccountId, Number(line.amount), false);
  }

  const updated = await prisma.journalEntry.update({
    where: { id: entryId },
    data: {
      status: "POSTED",
      approvedById: userId,
      approvedAt: new Date(),
    },
    include: { lines: { include: { debitAccount: true, creditAccount: true } } },
  });

  await createAuditLog({
    userId,
    action: "JOURNAL_POSTED",
    module: "ledger",
    recordId: entryId,
    newValue: { journalNumber: entry.journalNumber, fromDraft: true },
  });

  return updated;
}

export async function reverseJournalEntry(entryId: string, userId: string) {
  const entry = await prisma.journalEntry.findUnique({
    where: { id: entryId },
    include: { lines: true, reversalOf: true },
  });
  if (!entry) throw new Error("Journal entry not found");
  if (entry.status !== "POSTED") throw new Error("Only posted entries can be reversed");
  if (entry.reversalOf) throw new Error("Reversal entries cannot be reversed again");

  const existingReversal = await prisma.journalEntry.findFirst({
    where: { reversedEntryId: entryId },
  });
  if (existingReversal) throw new Error("Entry has already been reversed");

  const { assertPeriodOpen } = await import("./period.service");
  await assertPeriodOpen(new Date());

  const journalNumber = await generateDocumentNumber("JE", prisma);

  const reversal = await prisma.journalEntry.create({
    data: {
      journalNumber,
      date: new Date(),
      description: `Reversal of ${entry.journalNumber}: ${entry.description}`,
      reference: entry.journalNumber,
      currency: entry.currency,
      exchangeRate: entry.exchangeRate,
      status: "POSTED",
      createdById: userId,
      approvedById: userId,
      approvedAt: new Date(),
      reversedEntryId: entryId,
      lines: {
        create: entry.lines.map((line) => ({
          debitAccountId: line.creditAccountId,
          creditAccountId: line.debitAccountId,
          amount: line.amount,
          description: line.description ? `Reversal: ${line.description}` : "Reversal",
        })),
      },
    },
    include: { lines: { include: { debitAccount: true, creditAccount: true } } },
  });

  for (const line of entry.lines) {
    await updateAccountBalance(line.debitAccountId!, Number(line.amount), false);
    await updateAccountBalance(line.creditAccountId!, Number(line.amount), true);
  }

  await createAuditLog({
    userId,
    action: "JOURNAL_REVERSED",
    module: "ledger",
    recordId: entryId,
    newValue: { reversalJournalNumber: journalNumber },
  });

  return reversal;
}

export async function postPurchaseJournal(
  totalAmount: number,
  isPaid: boolean,
  userId: string,
  reference: string,
  taxAmount = 0
) {
  const creditCode = isPaid ? "1100" : "2100";
  const netInventory = totalAmount - taxAmount;
  const lines: JournalLineInput[] = [];

  if (taxAmount > 0) {
    lines.push({
      debitAccountCode: "1200",
      creditAccountCode: creditCode,
      amount: netInventory,
      description: "Inventory purchase (net)",
    });
    lines.push({
      debitAccountCode: "2300",
      creditAccountCode: creditCode,
      amount: taxAmount,
      description: "Input VAT",
    });
  } else {
    lines.push({
      debitAccountCode: "1200",
      creditAccountCode: creditCode,
      amount: totalAmount,
      description: "Inventory purchase",
    });
  }

  return postJournalEntry({
    description: `Purchase confirmed - ${reference}`,
    reference,
    userId,
    lines,
  });
}

export async function postSaleJournal(
  totalAmount: number,
  isCash: boolean,
  userId: string,
  reference: string,
  taxAmount = 0
) {
  const debitCode = isCash ? "1100" : "1300";
  const revenue = totalAmount - taxAmount;
  const lines: JournalLineInput[] = [];

  if (taxAmount > 0) {
    if (revenue > 0) {
      lines.push({
        debitAccountCode: debitCode,
        creditAccountCode: "4100",
        amount: revenue,
        description: "Sales revenue (net)",
      });
    }
    lines.push({
      debitAccountCode: debitCode,
      creditAccountCode: "2300",
      amount: taxAmount,
      description: "Output VAT",
    });
  } else {
    lines.push({
      debitAccountCode: debitCode,
      creditAccountCode: "4100",
      amount: totalAmount,
      description: "Local sales revenue",
    });
  }

  return postJournalEntry({
    description: `Sale confirmed - ${reference}`,
    reference,
    userId,
    lines,
  });
}

export async function postExportSaleJournal(
  amount: number,
  userId: string,
  reference: string
) {
  return postJournalEntry({
    description: `Export sale confirmed - ${reference}`,
    reference,
    userId,
    lines: [
      {
        debitAccountCode: "1300",
        creditAccountCode: "4200",
        amount,
        description: "Export sales revenue",
      },
    ],
  });
}

export async function postSalesCreditNoteJournal(
  subtotal: number,
  taxAmount: number,
  userId: string,
  reference: string
) {
  const lines: JournalLineInput[] = [];
  if (subtotal > 0) {
    lines.push({
      debitAccountCode: "4100",
      creditAccountCode: "1300",
      amount: subtotal,
      description: "Sales credit note — revenue reversal",
    });
  }
  if (taxAmount > 0) {
    lines.push({
      debitAccountCode: "2300",
      creditAccountCode: "1300",
      amount: taxAmount,
      description: "VAT credit note reversal",
    });
  }
  if (lines.length === 0) return null;

  return postJournalEntry({
    description: `Sales credit note - ${reference}`,
    reference,
    userId,
    lines,
  });
}

export async function postPurchaseCreditNoteJournal(
  subtotal: number,
  taxAmount: number,
  userId: string,
  reference: string
) {
  const lines: JournalLineInput[] = [];
  if (subtotal > 0) {
    lines.push({
      debitAccountCode: "2100",
      creditAccountCode: "1200",
      amount: subtotal,
      description: "Purchase credit note — inventory reduction",
    });
  }
  if (taxAmount > 0) {
    lines.push({
      debitAccountCode: "2100",
      creditAccountCode: "2300",
      amount: taxAmount,
      description: "Input VAT credit reversal",
    });
  }
  if (lines.length === 0) return null;

  return postJournalEntry({
    description: `Purchase credit note - ${reference}`,
    reference,
    userId,
    lines,
  });
}

export async function postDepreciationJournal(
  amount: number,
  userId: string,
  reference: string,
  assetName: string
) {
  return postJournalEntry({
    description: `Depreciation - ${assetName}`,
    reference,
    userId,
    lines: [
      {
        debitAccountCode: "5310",
        creditAccountCode: "1210",
        amount,
        description: `Monthly depreciation ${reference}`,
      },
    ],
  });
}

export async function postCOGSJournal(
  amount: number,
  userId: string,
  reference: string
) {
  return postJournalEntry({
    description: `COGS - ${reference}`,
    reference,
    userId,
    lines: [
      {
        debitAccountCode: "5100",
        creditAccountCode: "1200",
        amount,
        description: "Cost of goods sold",
      },
    ],
  });
}

export async function postExpenseJournal(
  amount: number,
  expenseAccountCode: string,
  isPaid: boolean,
  userId: string,
  reference: string
) {
  return postJournalEntry({
    description: `Expense - ${reference}`,
    reference,
    userId,
    lines: [
      {
        debitAccountCode: expenseAccountCode,
        creditAccountCode: isPaid ? "1100" : "2100",
        amount,
        description: "Business expense",
      },
    ],
  });
}

export async function postPayrollJournal(
  amount: number,
  isBankTransfer: boolean,
  userId: string,
  reference: string
) {
  return postJournalEntry({
    description: `Payroll - ${reference}`,
    reference,
    userId,
    lines: [
      {
        debitAccountCode: "5230",
        creditAccountCode: isBankTransfer ? "1110" : "1100",
        amount,
        description: "Staff salaries",
      },
    ],
  });
}

export async function postPaymentJournal(
  amount: number,
  isPayable: boolean,
  userId: string,
  reference: string,
  cashAccountCode = "1100"
) {
  if (isPayable) {
    return postJournalEntry({
      description: `Supplier payment - ${reference}`,
      reference,
      userId,
      lines: [
        {
          debitAccountCode: "2100",
          creditAccountCode: cashAccountCode,
          amount,
          description: "Pay supplier",
        },
      ],
    });
  }
  return postJournalEntry({
    description: `Customer payment received - ${reference}`,
    reference,
    userId,
    lines: [
      {
        debitAccountCode: cashAccountCode,
        creditAccountCode: "1300",
        amount,
        description: "Receive from customer",
      },
    ],
  });
}

export async function postBankVarianceJournal(
  variance: number,
  userId: string,
  reference: string
) {
  const absAmount = Math.abs(variance);
  if (absAmount < 0.01) return null;

  if (variance > 0) {
    return postJournalEntry({
      description: `Bank reconciliation variance (surplus) - ${reference}`,
      reference,
      userId,
      lines: [
        {
          debitAccountCode: "1110",
          creditAccountCode: "4300",
          amount: absAmount,
          description: "Unidentified bank receipt / reconciliation adjustment",
        },
      ],
      skipPeriodCheck: true,
    });
  }

  return postJournalEntry({
    description: `Bank reconciliation variance (shortage) - ${reference}`,
    reference,
    userId,
    lines: [
      {
        debitAccountCode: "5900",
        creditAccountCode: "1110",
        amount: absAmount,
        description: "Bank charges / reconciliation adjustment",
      },
    ],
    skipPeriodCheck: true,
  });
}

export async function postExchangeGainLoss(
  amount: number,
  isGain: boolean,
  userId: string,
  reference: string
) {
  return postJournalEntry({
    description: `Exchange ${isGain ? "gain" : "loss"} - ${reference}`,
    reference,
    userId,
    lines: isGain
      ? [
          {
            debitAccountCode: "1100",
            creditAccountCode: "4300",
            amount,
            description: "Exchange gain",
          },
        ]
      : [
          {
            debitAccountCode: "5900",
            creditAccountCode: "1100",
            amount,
            description: "Exchange loss",
          },
        ],
  });
}

export async function getTrialBalance(asOfDate?: Date) {
  return getTrialBalanceFromGl(asOfDate);
}
