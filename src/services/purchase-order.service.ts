import { prisma } from "@/lib/prisma";
import { createPurchase, confirmPurchase } from "./purchase.service";
import { createAuditLog } from "./audit.service";
import {
  assertThreeWayMatch,
  computeThreeWayVariance,
  type ThreeWayLine,
} from "@/lib/three-way-match";

export async function approvePurchaseOrder(poId: string, userId: string) {
  const po = await prisma.purchaseOrder.findUnique({ where: { id: poId } });
  if (!po) throw new Error("Purchase order not found");
  if (!["DRAFT", "SENT"].includes(po.status)) {
    throw new Error("Only draft or sent POs can be approved");
  }

  const updated = await prisma.purchaseOrder.update({
    where: { id: poId },
    data: { status: "APPROVED", approvedById: userId, approvedAt: new Date() },
    include: { supplier: true, items: true },
  });

  await createAuditLog({
    userId,
    action: "APPROVE",
    module: "purchase_orders",
    recordId: poId,
    newValue: { poNumber: po.poNumber },
  });

  return updated;
}

export async function createReceiptFromPo(
  poId: string,
  data: {
    userId: string;
    transportCost?: number;
    loadingCost?: number;
    items: Array<{
      poItemId: string;
      acceptedQuantity: number;
      rejectedQuantity?: number;
      rejectionReason?: string;
    }>;
  }
) {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: poId },
    include: { items: true, supplier: true },
  });
  if (!po) throw new Error("Purchase order not found");
  if (!["APPROVED", "PARTIALLY_RECEIVED"].includes(po.status)) {
    throw new Error("PO must be approved before receiving goods");
  }

  const purchaseItems = data.items.map((line) => {
    const poItem = po.items.find((i) => i.id === line.poItemId);
    if (!poItem) throw new Error(`PO line ${line.poItemId} not found`);
    if (!poItem.produceId) {
      throw new Error(`PO line "${poItem.description}" has no produce — add produce to the PO line first`);
    }

    const remaining = Number(poItem.quantity) - Number(poItem.quantityReceived);
    if (line.acceptedQuantity > remaining + 0.001) {
      throw new Error(
        `Accepted quantity ${line.acceptedQuantity} exceeds remaining ${remaining} on ${poItem.description}`
      );
    }

    return {
      produceId: poItem.produceId,
      quantity: line.acceptedQuantity,
      unitPrice: Number(poItem.unitPrice),
      acceptedQuantity: line.acceptedQuantity,
      rejectedQuantity: line.rejectedQuantity || 0,
      rejectionReason: line.rejectionReason,
    };
  });

  const purchase = await createPurchase(
    {
      supplierId: po.supplierId,
      purchaseOrderId: poId,
      transportCost: data.transportCost,
      loadingCost: data.loadingCost,
      notes: `Goods receipt against ${po.poNumber}`,
      items: purchaseItems,
    },
    data.userId
  );

  await createAuditLog({
    userId: data.userId,
    action: "CREATE_RECEIPT",
    module: "purchase_orders",
    recordId: poId,
    newValue: { purchaseNumber: purchase.purchaseNumber },
  });

  return purchase;
}

export async function getPoThreeWayMatch(poId: string) {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: poId },
    include: {
      supplier: true,
      items: { include: { produce: true } },
      purchases: {
        where: { status: "CONFIRMED" },
        include: { items: true, payables: true },
      },
    },
  });
  if (!po) throw new Error("Purchase order not found");

  const lines = po.items.map((poItem) => {
    const relatedPurchases = po.purchases.filter((p) =>
      p.items.some((pi) => pi.produceId === poItem.produceId)
    );
    const receivedQty = relatedPurchases.reduce((sum, p) => {
      const item = p.items.find((pi) => pi.produceId === poItem.produceId);
      return sum + Number(item?.acceptedQuantity || item?.quantity || 0);
    }, 0);
    const billedQty = relatedPurchases.reduce((sum, p) => {
      const item = p.items.find((pi) => pi.produceId === poItem.produceId);
      return sum + (p.status === "CONFIRMED" ? Number(item?.acceptedQuantity || item?.quantity || 0) : 0);
    }, 0);
    const billedUnitPrice =
      relatedPurchases.find((p) => p.items.some((pi) => pi.produceId === poItem.produceId))?.items.find(
        (pi) => pi.produceId === poItem.produceId
      )?.unitPrice || poItem.unitPrice;

    const line: ThreeWayLine = {
      description: poItem.description,
      orderedQty: Number(poItem.quantity),
      receivedQty,
      billedQty,
      unitPrice: Number(poItem.unitPrice),
      billedUnitPrice: Number(billedUnitPrice),
    };

    return computeThreeWayVariance(line);
  });

  const allMatched = lines.every((l) => l.isMatched);
  const totalOrdered = po.items.reduce((s, i) => s + Number(i.quantity), 0);
  const totalReceived = po.items.reduce((s, i) => s + Number(i.quantityReceived), 0);

  return {
    poNumber: po.poNumber,
    supplier: po.supplier.name,
    status: po.status,
    lines,
    summary: {
      totalOrdered,
      totalReceived,
      fullyReceived: totalReceived >= totalOrdered - 0.001,
      allMatched,
    },
  };
}

export async function confirmPurchaseWithThreeWayMatch(purchaseId: string, userId: string) {
  const purchase = await prisma.purchase.findUnique({
    where: { id: purchaseId },
    include: { items: true, purchaseOrder: { include: { items: true } } },
  });
  if (!purchase) throw new Error("Purchase not found");
  if (!purchase.purchaseOrderId || !purchase.purchaseOrder) {
    return confirmPurchase(purchaseId, userId);
  }

  const variances = purchase.purchaseOrder.items
    .filter((poItem) => purchase.items.some((pi) => pi.produceId === poItem.produceId))
    .map((poItem) => {
      const purchaseItem = purchase.items.find((pi) => pi.produceId === poItem.produceId);
      return computeThreeWayVariance({
        description: poItem.description,
        orderedQty: Number(poItem.quantity),
        receivedQty: Number(purchaseItem?.acceptedQuantity || purchaseItem?.quantity || 0),
        billedQty: Number(purchaseItem?.acceptedQuantity || purchaseItem?.quantity || 0),
        unitPrice: Number(poItem.unitPrice),
        billedUnitPrice: Number(purchaseItem?.unitPrice || poItem.unitPrice),
      });
    });

  assertThreeWayMatch(variances);

  const confirmed = await confirmPurchase(purchaseId, userId);

  await prisma.$transaction(async (tx) => {
    for (const item of purchase.items) {
      const poItem = purchase.purchaseOrder!.items.find((pi) => pi.produceId === item.produceId);
      if (!poItem) continue;
      const received = Number(item.acceptedQuantity || item.quantity);
      await tx.purchaseOrderItem.update({
        where: { id: poItem.id },
        data: { quantityReceived: { increment: received } },
      });
    }

    const updatedItems = await tx.purchaseOrderItem.findMany({
      where: { purchaseOrderId: purchase.purchaseOrderId! },
    });
    const fullyReceived = updatedItems.every(
      (i) => Number(i.quantityReceived) >= Number(i.quantity) - 0.001
    );
    const anyReceived = updatedItems.some((i) => Number(i.quantityReceived) > 0);

    await tx.purchaseOrder.update({
      where: { id: purchase.purchaseOrderId! },
      data: {
        status: fullyReceived ? "RECEIVED" : anyReceived ? "PARTIALLY_RECEIVED" : "APPROVED",
      },
    });
  });

  return confirmed;
}
