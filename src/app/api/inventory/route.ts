import { prisma } from "@/lib/prisma";
import { withAuth, parsePagination } from "@/lib/api-middleware";
import { successResponse, errorResponse } from "@/lib/api-response";
import { getStockValuation, getLowStockAlerts, receiveStock, deductStock } from "@/services/inventory.service";
import { stockMovementSchema } from "@/lib/validations";
import type { GradeType, MovementType } from "@/generated/prisma/client";

export const POST = withAuth(
  async ({ user, request }) => {
    const body = await request.json();
    const parsed = stockMovementSchema.safeParse(body);
    if (!parsed.success) return errorResponse("Validation failed", parsed.error.issues);

    const grade = (parsed.data.grade || "A") as GradeType;
    const movementType = parsed.data.movementType as MovementType;
    const locationId = parsed.data.fromLocationId || parsed.data.toLocationId;
    if (!locationId) return errorResponse("Location is required");

    const outbound = ["SALE_DISPATCH", "DAMAGE", "EXPORT_ALLOCATION", "REJECTION"].includes(movementType);

    if (outbound) {
      await deductStock({
        produceId: parsed.data.produceId,
        grade,
        locationId,
        quantity: parsed.data.quantity,
        movementType,
        userId: user.id,
        referenceDoc: parsed.data.referenceDoc,
        reason: parsed.data.reason,
      });
      return successResponse(null, "Stock deducted");
    }

    const batch = await prisma.inventoryBatch.findFirst({
      where: { produceId: parsed.data.produceId, grade, locationId },
    });
    await receiveStock({
      produceId: parsed.data.produceId,
      grade,
      locationId,
      quantity: parsed.data.quantity,
      unitCost: batch ? Number(batch.unitCost) : 0,
      userId: user.id,
      referenceDoc: parsed.data.referenceDoc,
    });
    return successResponse(null, "Stock added");
  },
  { module: "inventory", action: "create" }
);

export const GET = withAuth(
  async ({ request }) => {
    const { searchParams } = new URL(request.url);
    const view = searchParams.get("view");

    if (view === "valuation") {
      const valuation = await getStockValuation();
      return successResponse(valuation);
    }

    if (view === "alerts") {
      const alerts = await getLowStockAlerts();
      return successResponse(alerts);
    }

    const { page, limit, skip } = parsePagination(searchParams);
    const locationId = searchParams.get("locationId");
    const produceId = searchParams.get("produceId");

    const where: Record<string, unknown> = { quantity: { gt: 0 } };
    if (locationId) where.locationId = locationId;
    if (produceId) where.produceId = produceId;

    const [items, total, movements] = await Promise.all([
      prisma.inventoryBatch.findMany({
        where,
        include: { produce: true, location: true },
        skip,
        take: limit,
        orderBy: { dateReceived: "desc" },
      }),
      prisma.inventoryBatch.count({ where }),
      prisma.stockMovement.findMany({
        include: {
          produce: true,
          fromLocation: true,
          toLocation: true,
          createdBy: { select: { fullName: true } },
        },
        take: 50,
        orderBy: { date: "desc" },
      }),
    ]);

    return successResponse({
      batches: { items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } },
      recentMovements: movements,
    });
  },
  { module: "inventory", action: "read" }
);
