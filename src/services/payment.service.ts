import { prisma } from "@/lib/prisma";
import { generateDocumentNumber } from "@/lib/utils";
import type { PaymentMethod, PayableStatus, ReceivableStatus, Prisma } from "@/generated/prisma/client";
import {
  normalizePaymentAllocations,
  validatePaymentAllocations,
  type PaymentAllocationInput,
} from "@/lib/payment-allocation";
import { postPaymentJournal } from "./accounting.service";
import { createAuditLog } from "./audit.service";
import { dispatchWebhooks } from "./webhook.service";

function resolveCashAccountCode(paymentMethod: PaymentMethod, bankAccountId?: string): string {
  if (paymentMethod === "CASH") return "1100";
  if (bankAccountId) return "1110";
  return paymentMethod === "BANK_TRANSFER" ? "1110" : "1100";
}

function payableStatus(amount: number, amountPaid: number): PayableStatus {
  if (amountPaid >= amount - 0.01) return "PAID";
  if (amountPaid > 0) return "PARTIALLY_PAID";
  return "UNPAID";
}

function receivableStatus(amount: number, amountPaid: number): ReceivableStatus {
  if (amountPaid >= amount - 0.01) return "PAID";
  if (amountPaid > 0) return "PARTIALLY_PAID";
  return "UNPAID";
}

async function applyPayableAllocation(
  tx: Prisma.TransactionClient,
  payableId: string,
  amount: number,
  allowOverpay = false
) {
  const payable = await tx.payable.findUnique({ where: { id: payableId } });
  if (!payable) throw new Error("Payable not found");
  if (!["UNPAID", "PARTIALLY_PAID", "OVERDUE"].includes(payable.status)) {
    throw new Error(`Payable ${payable.payableNumber} is not open for payment`);
  }

  const balance = Number(payable.balance);
  const applyToBill = allowOverpay ? Math.min(amount, balance) : amount;
  if (!allowOverpay && amount > balance + 0.01) {
    throw new Error(`Amount exceeds payable ${payable.payableNumber} balance`);
  }

  const overpay = amount - applyToBill;
  const newPaid = Number(payable.amountPaid) + applyToBill;
  const newBalance = Math.max(0, Number(payable.amount) - newPaid);

  await tx.payable.update({
    where: { id: payableId },
    data: {
      amountPaid: newPaid,
      balance: newBalance,
      status: payableStatus(Number(payable.amount), newPaid),
    },
  });

  await tx.supplier.update({
    where: { id: payable.supplierId },
    data: {
      balance: { decrement: applyToBill },
      ...(overpay > 0.01 ? { creditBalance: { increment: overpay } } : {}),
    },
  });

  return { applied: applyToBill, overpay, creditCreated: overpay };
}

async function applyReceivableAllocation(
  tx: Prisma.TransactionClient,
  receivableId: string,
  amount: number,
  allowOverpay = false
) {
  const receivable = await tx.receivable.findUnique({ where: { id: receivableId } });
  if (!receivable) throw new Error("Receivable not found");
  if (!["UNPAID", "PARTIALLY_PAID", "OVERDUE"].includes(receivable.status)) {
    throw new Error(`Receivable ${receivable.receivableNumber} is not open for payment`);
  }

  const balance = Number(receivable.balance);
  const applyToBill = allowOverpay ? Math.min(amount, balance) : amount;
  if (!allowOverpay && amount > balance + 0.01) {
    throw new Error(`Amount exceeds receivable ${receivable.receivableNumber} balance`);
  }

  const overpay = amount - applyToBill;
  const newPaid = Number(receivable.amountPaid) + applyToBill;
  const newBalance = Math.max(0, Number(receivable.amount) - newPaid);

  await tx.receivable.update({
    where: { id: receivableId },
    data: {
      amountPaid: newPaid,
      balance: newBalance,
      status: receivableStatus(Number(receivable.amount), newPaid),
    },
  });

  await tx.customer.update({
    where: { id: receivable.customerId },
    data: {
      balance: { decrement: applyToBill },
      ...(overpay > 0.01 ? { creditBalance: { increment: overpay } } : {}),
    },
  });

  return { applied: applyToBill, overpay, creditCreated: overpay };
}

export async function createPaymentWithAllocations(data: {
  userId: string;
  amount: number;
  currency?: string;
  exchangeRate?: number;
  paymentMethod?: PaymentMethod;
  reference?: string;
  notes?: string;
  bankAccountId?: string;
  payableId?: string;
  receivableId?: string;
  allocations?: PaymentAllocationInput[];
  skipBankBalanceUpdate?: boolean;
  allowOverpay?: boolean;
  allowPartialAllocation?: boolean;
}) {
  const paymentMethod = (data.paymentMethod || "BANK_TRANSFER") as PaymentMethod;
  const allocations = normalizePaymentAllocations({
    amount: data.amount,
    payableId: data.payableId,
    receivableId: data.receivableId,
    allocations: data.allocations,
  });
  validatePaymentAllocations(data.amount, allocations, {
    allowPartial: data.allowPartialAllocation,
  });

  const allocatedTotal = allocations.reduce((sum, a) => sum + a.amount, 0);
  const unallocatedAmount = Math.max(0, data.amount - allocatedTotal);
  const allowOverpay = data.allowOverpay !== false;

  const isPayablePayment = allocations.every((a) => !!a.payableId);
  const isReceivablePayment = allocations.every((a) => !!a.receivableId);
  if (!isPayablePayment && !isReceivablePayment) {
    throw new Error("Allocations must all be payables or all receivables in one payment");
  }

  const paymentNumber = await generateDocumentNumber("PMT", prisma);
  const primaryPayableId = allocations.find((a) => a.payableId)?.payableId;
  const primaryReceivableId = allocations.find((a) => a.receivableId)?.receivableId;

  const payment = await prisma.$transaction(async (tx) => {
    const pmt = await tx.payment.create({
      data: {
        paymentNumber,
        amount: data.amount,
        currency: (data.currency as "UGX") || "UGX",
        exchangeRate: data.exchangeRate || 1,
        paymentMethod,
        bankAccountId: data.bankAccountId,
        payableId: primaryPayableId,
        receivableId: primaryReceivableId,
        reference: data.reference,
        notes: data.notes,
        unallocatedAmount,
        createdById: data.userId,
        allocations: {
          create: allocations.map((a) => ({
            payableId: a.payableId,
            receivableId: a.receivableId,
            amount: a.amount,
          })),
        },
      },
      include: {
        allocations: {
          include: {
            payable: { include: { supplier: true } },
            receivable: { include: { customer: true } },
          },
        },
      },
    });

    for (const alloc of allocations) {
      if (alloc.payableId) {
        await applyPayableAllocation(tx, alloc.payableId, alloc.amount, allowOverpay);
      } else if (alloc.receivableId) {
        await applyReceivableAllocation(tx, alloc.receivableId, alloc.amount, allowOverpay);
      }
    }

    if (data.bankAccountId && paymentMethod === "BANK_TRANSFER" && !data.skipBankBalanceUpdate) {
      const delta = isPayablePayment ? -data.amount : data.amount;
      await tx.bankAccount.update({
        where: { id: data.bankAccountId },
        data: { currentBalance: { increment: delta } },
      });
    }

    return pmt;
  });

  await postPaymentJournal(
    data.amount,
    isPayablePayment,
    data.userId,
    paymentNumber,
    resolveCashAccountCode(paymentMethod, data.bankAccountId)
  );

  await createAuditLog({
    userId: data.userId,
    action: "PAYMENT_POSTED",
    module: "payments",
    recordId: payment.id,
    newValue: { paymentNumber, amount: data.amount, allocationCount: allocations.length },
  });

  await dispatchWebhooks("PAYMENT_POSTED", {
    paymentId: payment.id,
    paymentNumber,
    amount: data.amount,
    allocationCount: allocations.length,
    paymentMethod,
  });

  return payment;
}

export async function listPayments(limit = 50) {
  return prisma.payment.findMany({
    include: {
      payable: { include: { supplier: true } },
      receivable: { include: { customer: true } },
      allocations: {
        include: {
          payable: { include: { supplier: true } },
          receivable: { include: { customer: true } },
        },
      },
      createdBy: { select: { fullName: true } },
    },
    orderBy: { date: "desc" },
    take: limit,
  });
}

export async function getUnmatchedPayments(options?: {
  isOutflow?: boolean;
  amount?: number;
  fromDate?: Date;
  toDate?: Date;
}) {
  const matchedIds = (
    await prisma.bankTransaction.findMany({
      where: { matchedPaymentId: { not: null } },
      select: { matchedPaymentId: true },
    })
  )
    .map((t) => t.matchedPaymentId)
    .filter(Boolean) as string[];

  return prisma.payment.findMany({
    where: {
      id: matchedIds.length > 0 ? { notIn: matchedIds } : undefined,
      ...(options?.isOutflow === true ? { payableId: { not: null } } : {}),
      ...(options?.isOutflow === false ? { receivableId: { not: null } } : {}),
      ...(options?.amount !== undefined
        ? { amount: { gte: options.amount - 0.01, lte: options.amount + 0.01 } }
        : {}),
      ...(options?.fromDate || options?.toDate
        ? {
            date: {
              ...(options.fromDate ? { gte: options.fromDate } : {}),
              ...(options.toDate ? { lte: options.toDate } : {}),
            },
          }
        : {}),
    },
    include: {
      payable: { include: { supplier: true } },
      receivable: { include: { customer: true } },
      allocations: true,
    },
    orderBy: { date: "desc" },
    take: 20,
  });
}
