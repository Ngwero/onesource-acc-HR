import { prisma } from "@/lib/prisma";
import { createAuditLog } from "./audit.service";

function payableStatus(amount: number, amountPaid: number) {
  if (amountPaid >= amount - 0.01) return "PAID" as const;
  if (amountPaid > 0) return "PARTIALLY_PAID" as const;
  return "UNPAID" as const;
}

function receivableStatus(amount: number, amountPaid: number) {
  if (amountPaid >= amount - 0.01) return "PAID" as const;
  if (amountPaid > 0) return "PARTIALLY_PAID" as const;
  return "UNPAID" as const;
}

export async function applySupplierCredit(
  supplierId: string,
  payableId: string,
  amount: number,
  userId: string
) {
  const [supplier, payable] = await Promise.all([
    prisma.supplier.findUnique({ where: { id: supplierId } }),
    prisma.payable.findUnique({ where: { id: payableId } }),
  ]);

  if (!supplier) throw new Error("Supplier not found");
  if (!payable) throw new Error("Payable not found");
  if (payable.supplierId !== supplierId) throw new Error("Payable does not belong to supplier");
  if (Number(supplier.creditBalance) + 0.01 < amount) {
    throw new Error("Insufficient supplier credit balance");
  }
  if (amount > Number(payable.balance) + 0.01) {
    throw new Error("Amount exceeds payable balance");
  }

  const newPaid = Number(payable.amountPaid) + amount;
  const newBalance = Number(payable.balance) - amount;

  await prisma.$transaction([
    prisma.supplier.update({
      where: { id: supplierId },
      data: { creditBalance: { decrement: amount }, balance: { decrement: amount } },
    }),
    prisma.payable.update({
      where: { id: payableId },
      data: {
        amountPaid: newPaid,
        balance: newBalance,
        status: payableStatus(Number(payable.amount), newPaid),
      },
    }),
  ]);

  await createAuditLog({
    userId,
    action: "SUPPLIER_CREDIT_APPLIED",
    module: "payables",
    recordId: payableId,
    newValue: { supplierId, amount },
  });

  return prisma.payable.findUnique({ where: { id: payableId }, include: { supplier: true } });
}

export async function applyCustomerCredit(
  customerId: string,
  receivableId: string,
  amount: number,
  userId: string
) {
  const [customer, receivable] = await Promise.all([
    prisma.customer.findUnique({ where: { id: customerId } }),
    prisma.receivable.findUnique({ where: { id: receivableId } }),
  ]);

  if (!customer) throw new Error("Customer not found");
  if (!receivable) throw new Error("Receivable not found");
  if (receivable.customerId !== customerId) throw new Error("Receivable does not belong to customer");
  if (Number(customer.creditBalance) + 0.01 < amount) {
    throw new Error("Insufficient customer credit balance");
  }
  if (amount > Number(receivable.balance) + 0.01) {
    throw new Error("Amount exceeds receivable balance");
  }

  const newPaid = Number(receivable.amountPaid) + amount;
  const newBalance = Number(receivable.balance) - amount;

  await prisma.$transaction([
    prisma.customer.update({
      where: { id: customerId },
      data: { creditBalance: { decrement: amount }, balance: { decrement: amount } },
    }),
    prisma.receivable.update({
      where: { id: receivableId },
      data: {
        amountPaid: newPaid,
        balance: newBalance,
        status: receivableStatus(Number(receivable.amount), newPaid),
      },
    }),
  ]);

  await createAuditLog({
    userId,
    action: "CUSTOMER_CREDIT_APPLIED",
    module: "receivables",
    recordId: receivableId,
    newValue: { customerId, amount },
  });

  return prisma.receivable.findUnique({ where: { id: receivableId }, include: { customer: true } });
}
