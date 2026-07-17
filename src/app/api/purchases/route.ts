import { withAuth, parsePagination } from "@/lib/api-middleware";
import { successResponse, errorResponse } from "@/lib/api-response";
import { purchaseSchema } from "@/lib/validations";
import { createPurchase, confirmPurchase } from "@/services/purchase.service";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/services/audit.service";

export const GET = withAuth(
  async ({ request }) => {
    const { searchParams } = new URL(request.url);
    const { page, limit, skip, search, sortBy, sortOrder } = parsePagination(searchParams);
    const status = searchParams.get("status");
    const paymentStatus = searchParams.get("paymentStatus");

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (paymentStatus) where.paymentStatus = paymentStatus;
    if (search) {
      where.OR = [{ purchaseNumber: { contains: search, mode: "insensitive" } }];
    }

    const [items, total] = await Promise.all([
      prisma.purchase.findMany({
        where,
        include: { supplier: true, items: { include: { produce: true } }, createdBy: { select: { fullName: true } } },
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.purchase.count({ where }),
    ]);

    return successResponse({ items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  },
  { module: "purchases", action: "read" }
);

export const POST = withAuth(
  async ({ user, request }) => {
    const body = await request.json();
    const parsed = purchaseSchema.safeParse(body);
    if (!parsed.success) return errorResponse("Validation failed", parsed.error.issues);

    const purchase = await createPurchase(parsed.data, user.id);
    await createAuditLog({ userId: user.id, action: "CREATE", module: "purchases", recordId: purchase!.id, newValue: purchase });
    return successResponse(purchase, "Purchase created", 201);
  },
  { module: "purchases", action: "create" }
);
