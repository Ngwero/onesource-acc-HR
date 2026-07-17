import { prisma } from "@/lib/prisma";
import { generateDocumentNumber } from "@/lib/utils";
import { deductStock, getAvailableStock } from "./inventory.service";
import { postExportSaleJournal, postCOGSJournal } from "./accounting.service";
import { createAuditLog } from "./audit.service";

export async function createExportSale(data: {
  customerId: string;
  produceId: string;
  grade?: string;
  quantity: number;
  currency?: string;
  exchangeRate: number;
  unitExportPrice: number;
  paymentTerms?: number;
  expectedPaymentDate?: string;
  shipmentId?: string;
  userId: string;
}) {
  const totalForeign = data.quantity * data.unitExportPrice;
  const ugxEquivalent = totalForeign * data.exchangeRate;

  const exportSaleNumber = await generateDocumentNumber("EXP", prisma);

  return prisma.exportSale.create({
    data: {
      exportSaleNumber,
      customerId: data.customerId,
      produceId: data.produceId,
      grade: (data.grade || "EXPORT_GRADE") as "EXPORT_GRADE",
      quantity: data.quantity,
      currency: (data.currency || "USD") as "USD",
      exchangeRate: data.exchangeRate,
      unitExportPrice: data.unitExportPrice,
      totalForeignAmount: totalForeign,
      ugxEquivalent,
      paymentTerms: data.paymentTerms || 30,
      expectedPaymentDate: data.expectedPaymentDate ? new Date(data.expectedPaymentDate) : undefined,
      shipmentId: data.shipmentId,
      status: "DRAFT",
    },
    include: { customer: true, produce: true, shipment: true },
  });
}

export async function confirmExportSale(id: string, userId: string) {
  const sale = await prisma.exportSale.findUnique({
    where: { id },
    include: { customer: true, produce: true },
  });
  if (!sale) throw new Error("Export sale not found");

  const warehouse = await prisma.stockLocation.findFirst({ where: { code: "WH-MAIN" } });
  if (!warehouse) throw new Error("Warehouse not configured");

  const available = await getAvailableStock(sale.produceId, sale.grade, warehouse.id);
  if (available < Number(sale.quantity)) {
    throw new Error(`Insufficient stock. Available: ${available}`);
  }

  const batch = await prisma.inventoryBatch.findFirst({
    where: {
      produceId: sale.produceId,
      grade: sale.grade,
      locationId: warehouse.id,
      quantity: { gt: 0 },
    },
    orderBy: { dateReceived: "asc" },
  });
  const cogsAmount = batch ? Number(sale.quantity) * Number(batch.unitCost) : 0;

  await deductStock({
    produceId: sale.produceId,
    grade: sale.grade,
    locationId: warehouse.id,
    quantity: Number(sale.quantity),
    movementType: "EXPORT_ALLOCATION",
    userId,
    referenceDoc: sale.exportSaleNumber,
  });

  const receivableNumber = await generateDocumentNumber("REC", prisma);
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + (sale.paymentTerms || 30));

  await prisma.$transaction([
    prisma.exportSale.update({ where: { id }, data: { status: "CONFIRMED" } }),
    prisma.receivable.create({
      data: {
        receivableNumber,
        customerId: sale.customerId,
        exportSaleId: sale.id,
        invoiceNumber: sale.exportInvoiceNumber,
        amount: sale.ugxEquivalent,
        balance: sale.ugxEquivalent,
        dueDate,
        currency: sale.currency,
        exchangeRate: sale.exchangeRate,
        status: "UNPAID",
      },
    }),
    prisma.customer.update({
      where: { id: sale.customerId },
      data: { balance: { increment: Number(sale.ugxEquivalent) } },
    }),
  ]);

  await createAuditLog({ userId, action: "CONFIRM", module: "export_sales", recordId: id });

  await postExportSaleJournal(Number(sale.ugxEquivalent), userId, sale.exportSaleNumber);
  if (cogsAmount > 0) {
    await postCOGSJournal(cogsAmount, userId, sale.exportSaleNumber);
  }

  return prisma.exportSale.findUnique({
    where: { id },
    include: { customer: true, produce: true },
  });
}

export async function createExportShipment(data: {
  customerId: string;
  produceId: string;
  grade?: string;
  quantity: number;
  destinationCountry: string;
  destinationCity?: string;
  freightMethod?: string;
  packagingDetails?: string;
  numberOfPackages?: number;
  containerNumber?: string;
  billOfLading?: string;
  shipmentDate?: string;
  expectedArrivalDate?: string;
  expectedRevenue?: number;
  notes?: string;
  costs?: Array<{ costType: string; amount: number; description?: string }>;
  userId: string;
}) {
  const shipmentNumber = await generateDocumentNumber("SHP", prisma);
  const totalCost = (data.costs || []).reduce((s, c) => s + c.amount, 0);
  const expectedRevenue = data.expectedRevenue || 0;

  return prisma.exportShipment.create({
    data: {
      shipmentNumber,
      customerId: data.customerId,
      produceId: data.produceId,
      grade: (data.grade || "EXPORT_GRADE") as "EXPORT_GRADE",
      quantity: data.quantity,
      destinationCountry: data.destinationCountry,
      destinationCity: data.destinationCity,
      freightMethod: (data.freightMethod || "SEA") as "SEA",
      packagingDetails: data.packagingDetails,
      numberOfPackages: data.numberOfPackages,
      containerNumber: data.containerNumber,
      billOfLading: data.billOfLading,
      shipmentDate: data.shipmentDate ? new Date(data.shipmentDate) : undefined,
      expectedArrivalDate: data.expectedArrivalDate ? new Date(data.expectedArrivalDate) : undefined,
      expectedRevenue,
      totalCost,
      grossProfit: expectedRevenue - totalCost,
      netProfit: expectedRevenue - totalCost,
      notes: data.notes,
      status: "PLANNING",
      costs: data.costs?.length
        ? { create: data.costs.map((c) => ({ costType: c.costType, amount: c.amount, description: c.description })) }
        : undefined,
    },
    include: { customer: true, produce: true, costs: true },
  });
}

export async function updateShipmentStatus(
  id: string,
  status: "PLANNING" | "PACKED" | "DISPATCHED" | "IN_TRANSIT" | "DELIVERED" | "CANCELLED",
  userId: string
) {
  const shipment = await prisma.exportShipment.update({
    where: { id },
    data: { status },
    include: { customer: true, produce: true, costs: true },
  });
  await createAuditLog({ userId, action: "STATUS_UPDATE", module: "export_shipments", recordId: id, newValue: { status } });
  return shipment;
}
