import { prisma } from "@/lib/prisma";
import { withAuth, parsePagination } from "@/lib/api-middleware";
import { successResponse, errorResponse, notFoundResponse } from "@/lib/api-response";
import { supplierSchema } from "@/lib/validations";
import { createAuditLog } from "@/services/audit.service";

export const GET = withAuth(
  async ({ request }) => {
    const { searchParams } = new URL(request.url);
    const { page, limit, skip, search, sortBy, sortOrder } = parsePagination(searchParams);
    const supplierType = searchParams.get("supplierType");
    const status = searchParams.get("status");

    const where: Record<string, unknown> = { deletedAt: null };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { code: { contains: search, mode: "insensitive" } },
        { location: { contains: search, mode: "insensitive" } },
      ];
    }
    if (supplierType) where.supplierType = supplierType;
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      prisma.supplier.findMany({ where, skip, take: limit, orderBy: { [sortBy]: sortOrder } }),
      prisma.supplier.count({ where }),
    ]);

    return successResponse({ items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  },
  { module: "suppliers", action: "read" }
);

export const POST = withAuth(
  async ({ user, request }) => {
    const body = await request.json();
    const parsed = supplierSchema.safeParse(body);
    if (!parsed.success) return errorResponse("Validation failed", parsed.error.issues);

    const supplier = await prisma.supplier.create({ data: { ...parsed.data, email: parsed.data.email || null } });

    await createAuditLog({ userId: user.id, action: "CREATE", module: "suppliers", recordId: supplier.id, newValue: supplier });
    return successResponse(supplier, "Supplier created", 201);
  },
  { module: "suppliers", action: "create" }
);
