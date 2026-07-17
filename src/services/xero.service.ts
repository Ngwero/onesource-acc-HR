import { prisma } from "@/lib/prisma";
import { generateDocumentNumber } from "@/lib/utils";
import { postSalesCreditNoteJournal, postPurchaseCreditNoteJournal } from "./accounting.service";

export function calculateTax(subtotal: number, taxRate: number) {
  return Math.round(subtotal * (taxRate / 100) * 100) / 100;
}

export async function getTaxCodes() {
  return prisma.taxCode.findMany({ where: { isActive: true }, orderBy: { code: "asc" } });
}

export async function createQuote(data: {
  customerId: string;
  expiryDate: string;
  items: Array<{ description: string; quantity: number; unitPrice: number }>;
  taxCodeId?: string;
  notes?: string;
  userId: string;
}) {
  const quoteNumber = await generateDocumentNumber("QUO", prisma);
  let subtotal = 0;
  const itemsData = data.items.map((item) => {
    const total = item.quantity * item.unitPrice;
    subtotal += total;
    return { ...item, total };
  });

  let taxAmount = 0;
  if (data.taxCodeId) {
    const taxCode = await prisma.taxCode.findUnique({ where: { id: data.taxCodeId } });
    if (taxCode) taxAmount = calculateTax(subtotal, Number(taxCode.rate));
  }

  return prisma.quote.create({
    data: {
      quoteNumber,
      customerId: data.customerId,
      expiryDate: new Date(data.expiryDate),
      subtotal,
      taxCodeId: data.taxCodeId,
      taxAmount,
      total: subtotal + taxAmount,
      notes: data.notes,
      createdById: data.userId,
      items: { create: itemsData },
    },
    include: { customer: true, items: true, taxCode: true },
  });
}

export async function convertQuoteToSale(quoteId: string, userId: string) {
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: { items: true, customer: true },
  });
  if (!quote) throw new Error("Quote not found");
  if (quote.status === "CONVERTED") throw new Error("Quote already converted");
  if (quote.items.length === 0) throw new Error("Quote has no items");

  const defaultProduce = await prisma.produce.findFirst({ where: { status: "ACTIVE", deletedAt: null } });
  if (!defaultProduce) throw new Error("No produce available for sale conversion");

  const saleNumber = await generateDocumentNumber("SAL", prisma);
  const invoiceNumber = await generateDocumentNumber("INV", prisma);

  const sale = await prisma.sale.create({
    data: {
      saleNumber,
      invoiceNumber,
      customerId: quote.customerId,
      totalAmount: quote.total,
      taxAmount: quote.taxAmount,
      paymentStatus: "UNPAID",
      status: "DRAFT",
      createdById: userId,
      items: {
        create: quote.items.map((item) => ({
          produceId: defaultProduce.id,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalAmount: item.total,
        })),
      },
    },
  });

  await prisma.quote.update({
    where: { id: quoteId },
    data: { status: "CONVERTED", convertedToSaleId: sale.id },
  });

  return sale;
}

export async function createCreditNote(data: {
  type: "SALES" | "PURCHASE";
  customerId?: string;
  supplierId?: string;
  items: Array<{ description: string; quantity: number; unitPrice: number }>;
  reason?: string;
  taxCodeId?: string;
  userId: string;
}) {
  const creditNoteNumber = await generateDocumentNumber("CN", prisma);
  let subtotal = 0;
  const itemsData = data.items.map((item) => {
    const total = item.quantity * item.unitPrice;
    subtotal += total;
    return { ...item, total };
  });

  let taxAmount = 0;
  if (data.taxCodeId) {
    const taxCode = await prisma.taxCode.findUnique({ where: { id: data.taxCodeId } });
    if (taxCode) taxAmount = calculateTax(subtotal, Number(taxCode.rate));
  }

  const total = subtotal + taxAmount;

  const creditNote = await prisma.creditNote.create({
    data: {
      creditNoteNumber,
      type: data.type,
      customerId: data.customerId,
      supplierId: data.supplierId,
      subtotal,
      taxCodeId: data.taxCodeId,
      taxAmount,
      total,
      reason: data.reason,
      status: "CONFIRMED",
      createdById: data.userId,
      items: { create: itemsData },
    },
    include: { items: true, customer: true, supplier: true },
  });

  if (data.type === "SALES" && data.customerId) {
    await prisma.customer.update({
      where: { id: data.customerId },
      data: { balance: { decrement: total } },
    });
    await postSalesCreditNoteJournal(subtotal, taxAmount, data.userId, creditNoteNumber);
  } else if (data.type === "PURCHASE" && data.supplierId) {
    await prisma.supplier.update({
      where: { id: data.supplierId },
      data: { balance: { decrement: total } },
    });
    await postPurchaseCreditNoteJournal(subtotal, taxAmount, data.userId, creditNoteNumber);
  }

  return creditNote;
}

export async function getCashFlowForecast(days = 90) {
  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() + days);

  const bankAccounts = await prisma.bankAccount.findMany({ where: { isActive: true } });
  const openingCash = bankAccounts.reduce((s, b) => s + Number(b.currentBalance), 0);

  const receivables = await prisma.receivable.findMany({
    where: { status: { in: ["UNPAID", "PARTIALLY_PAID", "OVERDUE"] }, dueDate: { lte: end } },
  });
  const payables = await prisma.payable.findMany({
    where: { status: { in: ["UNPAID", "PARTIALLY_PAID", "OVERDUE"] }, dueDate: { lte: end } },
  });
  const recurring = await prisma.recurringTemplate.findMany({ where: { isActive: true } });

  const inflows = receivables.reduce((s, r) => s + Number(r.balance), 0);
  const outflows = payables.reduce((s, p) => s + Number(p.balance), 0);
  const recurringOut = recurring
    .filter((r) => r.type === "EXPENSE" || r.type === "BILL")
    .reduce((s, r) => s + Number(r.amount), 0);

  const weeklyForecast = [];
  for (let w = 0; w < Math.ceil(days / 7); w++) {
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() + w * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const weekIn = receivables
      .filter((r) => new Date(r.dueDate) >= weekStart && new Date(r.dueDate) < weekEnd)
      .reduce((s, r) => s + Number(r.balance), 0);
    const weekOut = payables
      .filter((p) => new Date(p.dueDate) >= weekStart && new Date(p.dueDate) < weekEnd)
      .reduce((s, p) => s + Number(p.balance), 0);

    weeklyForecast.push({
      week: `Week ${w + 1}`,
      start: weekStart.toISOString().split("T")[0],
      inflows: weekIn,
      outflows: weekOut,
      net: weekIn - weekOut,
    });
  }

  return {
    openingCash,
    projectedInflows: inflows,
    projectedOutflows: outflows + recurringOut,
    projectedClosing: openingCash + inflows - outflows - recurringOut,
    weeklyForecast,
    bankAccounts: bankAccounts.map((b) => ({
      name: b.name,
      balance: Number(b.currentBalance),
    })),
  };
}
