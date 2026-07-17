import { prisma } from "@/lib/prisma";
import { generateDocumentNumber } from "@/lib/utils";
import type { GradeType, MovementType } from "@/generated/prisma/client";
import { createAuditLog } from "./audit.service";

interface StockCheckParams {
  produceId: string;
  grade: GradeType;
  locationId: string;
  quantity: number;
}

export async function getAvailableStock(
  produceId: string,
  grade: GradeType,
  locationId?: string
): Promise<number> {
  const where: Record<string, unknown> = { produceId, grade };
  if (locationId) where.locationId = locationId;

  const batches = await prisma.inventoryBatch.findMany({ where });
  return batches.reduce((sum, b) => sum + Number(b.quantity), 0);
}

export async function ensureStockAvailable(params: StockCheckParams) {
  const available = await getAvailableStock(
    params.produceId,
    params.grade,
    params.locationId
  );
  if (available < params.quantity) {
    throw new Error(
      `Insufficient stock. Available: ${available}, Requested: ${params.quantity}`
    );
  }
}

interface ReceiveStockParams {
  produceId: string;
  grade: GradeType;
  locationId: string;
  quantity: number;
  unitCost: number;
  batchNumber?: string;
  purchaseSource?: string;
  expiryDate?: Date;
  userId: string;
  referenceDoc?: string;
}

export async function receiveStock(params: ReceiveStockParams) {
  const batchNumber = params.batchNumber || `BATCH-${Date.now()}`;

  const batch = await prisma.inventoryBatch.upsert({
    where: {
      produceId_grade_locationId_batchNumber: {
        produceId: params.produceId,
        grade: params.grade,
        locationId: params.locationId,
        batchNumber,
      },
    },
    create: {
      produceId: params.produceId,
      grade: params.grade,
      locationId: params.locationId,
      batchNumber,
      quantity: params.quantity,
      unitCost: params.unitCost,
      purchaseSource: params.purchaseSource,
      expiryDate: params.expiryDate,
    },
    update: {
      quantity: { increment: params.quantity },
    },
  });

  const movementNumber = await generateDocumentNumber("MOV", prisma);

  await prisma.stockMovement.create({
    data: {
      movementNumber,
      produceId: params.produceId,
      grade: params.grade,
      batchId: batch.id,
      toLocationId: params.locationId,
      quantity: params.quantity,
      movementType: "PURCHASE_RECEIPT",
      referenceDoc: params.referenceDoc,
      createdById: params.userId,
    },
  });

  await createAuditLog({
    userId: params.userId,
    action: "STOCK_RECEIVED",
    module: "inventory",
    recordId: batch.id,
    newValue: params,
  });

  return batch;
}

interface DeductStockParams {
  produceId: string;
  grade: GradeType;
  locationId: string;
  quantity: number;
  movementType: MovementType;
  userId: string;
  referenceDoc?: string;
  reason?: string;
}

export async function deductStock(params: DeductStockParams) {
  await ensureStockAvailable({
    produceId: params.produceId,
    grade: params.grade,
    locationId: params.locationId,
    quantity: params.quantity,
  });

  const batches = await prisma.inventoryBatch.findMany({
    where: {
      produceId: params.produceId,
      grade: params.grade,
      locationId: params.locationId,
      quantity: { gt: 0 },
    },
    orderBy: { dateReceived: "asc" },
  });

  let remaining = params.quantity;

  for (const batch of batches) {
    if (remaining <= 0) break;
    const batchQty = Number(batch.quantity);
    const deduct = Math.min(batchQty, remaining);

    await prisma.inventoryBatch.update({
      where: { id: batch.id },
      data: { quantity: { decrement: deduct } },
    });

    remaining -= deduct;
  }

  const movementNumber = await generateDocumentNumber("MOV", prisma);

  const movement = await prisma.stockMovement.create({
    data: {
      movementNumber,
      produceId: params.produceId,
      grade: params.grade,
      fromLocationId: params.locationId,
      quantity: params.quantity,
      movementType: params.movementType,
      referenceDoc: params.referenceDoc,
      reason: params.reason,
      createdById: params.userId,
    },
  });

  await createAuditLog({
    userId: params.userId,
    action: "STOCK_DEDUCTED",
    module: "inventory",
    recordId: movement.id,
    newValue: params,
  });

  return movement;
}

export async function getStockValuation() {
  const batches = await prisma.inventoryBatch.findMany({
    where: { quantity: { gt: 0 } },
    include: { produce: true, location: true },
  });

  return batches.map((b) => ({
    ...b,
    value: Number(b.quantity) * Number(b.unitCost),
  }));
}

export async function getLowStockAlerts() {
  const produce = await prisma.produce.findMany({
    where: { status: "ACTIVE", deletedAt: null },
    include: { unitOfMeasure: true },
  });

  const alerts = [];
  for (const p of produce) {
    const total = await getAvailableStock(p.id, p.grade);
    if (total <= Number(p.minimumStockLevel)) {
      alerts.push({ produce: p, currentStock: total, minimum: Number(p.minimumStockLevel) });
    }
  }
  return alerts;
}
