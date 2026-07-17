import { withAuth, parsePagination } from "@/lib/api-middleware";
import { successResponse, errorResponse } from "@/lib/api-response";
import { saleSchema } from "@/lib/validations";
import { createSale, confirmSale } from "@/services/sale.service";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/services/audit.service";

export const GET = withAuth(
  async ({ request }) => {
    const { searchParams } = new URL(request.url);
    const { page, limit, skip, sortBy, sortOrder } = parsePagination(searchParams);

    const [items, total] = await Promise.all([
      prisma.sale.findMany({
        include: { customer: true, items: { include: { produce: true } } },
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.sale.count(),
    ]);

    return successResponse({ items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  },
  { module: "local_sales", action: "read" }
);

export const POST = withAuth(
  async ({ user, request }) => {
    const body = await request.json();
    const parsed = saleSchema.safeParse(body);
    if (!parsed.success) return errorResponse("Validation failed", parsed.error.issues);

    const sale = await createSale(parsed.data, user.id);
    await createAuditLog({ userId: user.id, action: "CREATE", module: "local_sales", recordId: sale.id, newValue: sale });
    return successResponse(sale, "Sale created", 201);
  },
  { module: "local_sales", action: "create" }
);
