import { prisma } from "@/lib/prisma";
import { generateDocumentNumber } from "@/lib/utils";
import { receiveStock } from "./inventory.service";
import { postPurchaseJournal } from "./accounting.service";
import { createAuditLog } from "./audit.service";
import { computePurchaseInputVat } from "@/lib/vat";
import { allocateLandedUnitCosts } from "@/lib/landed-cost";

export async function confirmPurchase(purchaseId: string, userId: string) {
  const purchase = await prisma.purchase.findUnique({
    where: { id: purchaseId },
    include: { items: { include: { produce: true } }, supplier: true },
  });

  if (!purchase) throw new Error("Purchase not found");
  if (purchase.status !== "DRAFT") throw new Error("Only draft purchases can be confirmed");

  const warehouse = await prisma.stockLocation.findFirst({ where: { code: "WH-MAIN" } });
  if (!warehouse) throw new Error("Main warehouse not configured");

  const landedItems = purchase.items.map((item) => ({
    qty: Number(item.acceptedQuantity || item.quantity),
    unitPrice: Number(item.unitPrice),
  }));
  const unitCosts = allocateLandedUnitCosts(
    landedItems,
    Number(purchase.transportCost),
    Number(purchase.loadingCost)
  );

  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < purchase.items.length; i++) {
      const item = purchase.items[i];
      const qty = landedItems[i].qty;
      if (qty <= 0) continue;

      await receiveStock({
        produceId: item.produceId,
        grade: item.grade,
        locationId: warehouse.id,
        quantity: qty,
        unitCost: unitCosts[i],
        purchaseSource: purchase.supplier.name,
        userId,
        referenceDoc: purchase.purchaseNumber,
      });
    }

    const payableNumber = await generateDocumentNumber("PAY", tx as typeof prisma);
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (purchase.supplier.paymentTerms || 30));

    await tx.payable.create({
      data: {
        payableNumber,
        supplierId: purchase.supplierId,
        purchaseId: purchase.id,
        entityId: purchase.entityId,
        sourceDocument: purchase.purchaseNumber,
        amount: purchase.totalAmount,
        balance: purchase.totalAmount,
        dueDate,
        status: purchase.paymentStatus === "PAID" ? "PAID" : "UNPAID",
        amountPaid: purchase.paymentStatus === "PAID" ? purchase.totalAmount : 0,
        approvalStatus: "APPROVED",
      },
    });

    await tx.supplier.update({
      where: { id: purchase.supplierId },
      data: {
        balance: {
          increment:
            purchase.paymentStatus === "PAID" ? 0 : Number(purchase.totalAmount),
        },
      },
    });

    await tx.purchase.update({
      where: { id: purchaseId },
      data: {
        status: "CONFIRMED",
        approvedById: userId,
        approvedAt: new Date(),
      },
    });
  });

  const settings = await prisma.companySetting.findFirst();
  const taxRate = Number(settings?.defaultTaxRate || 0);
  const { taxAmount } = computePurchaseInputVat(Number(purchase.totalAmount), taxRate);

  await postPurchaseJournal(
    Number(purchase.totalAmount),
    purchase.paymentStatus === "PAID",
    userId,
    purchase.purchaseNumber,
    taxAmount
  );

  await createAuditLog({
    userId,
    action: "CONFIRM",
    module: "purchases",
    recordId: purchaseId,
    newValue: { purchaseNumber: purchase.purchaseNumber },
  });

  return prisma.purchase.findUnique({
    where: { id: purchaseId },
    include: { items: true, supplier: true },
  });
}

export async function createPurchase(
  data: {
    supplierId: string;
    purchaseOrderId?: string;
    purchaseDate?: string;
    transportCost?: number;
    loadingCost?: number;
    notes?: string;
    items: Array<{
      produceId: string;
      grade?: string;
      quantity: number;
      unitPrice: number;
      acceptedQuantity?: number;
      rejectedQuantity?: number;
      rejectionReason?: string;
      moistureLevel?: number;
    }>;
  },
  userId: string
) {
  const purchaseNumber = await generateDocumentNumber("PUR", prisma);
  const { getDefaultEntityId } = await import("@/lib/entity-context");
  const entityId = await getDefaultEntityId();

  let itemsTotal = 0;
  const itemsData = data.items.map((item) => {
    const total = item.quantity * item.unitPrice;
    itemsTotal += total;
    return {
      produceId: item.produceId,
      grade: (item.grade || "A") as "A" | "B" | "C" | "EXPORT_GRADE" | "LOCAL_GRADE",
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalAmount: total,
      acceptedQuantity: item.acceptedQuantity ?? item.quantity,
      rejectedQuantity: item.rejectedQuantity ?? 0,
      rejectionReason: item.rejectionReason,
      moistureLevel: item.moistureLevel,
    };
  });

  const totalAmount = itemsTotal + (data.transportCost || 0) + (data.loadingCost || 0);

  return prisma.purchase.create({
    data: {
      purchaseNumber,
      purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : new Date(),
      supplierId: data.supplierId,
      purchaseOrderId: data.purchaseOrderId,
      entityId,
      transportCost: data.transportCost || 0,
      loadingCost: data.loadingCost || 0,
      totalAmount,
      notes: data.notes,
      createdById: userId,
      items: { create: itemsData },
    },
    include: { items: { include: { produce: true } }, supplier: true },
  });
}
