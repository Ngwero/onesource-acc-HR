import { prisma } from "@/lib/prisma";
import { withAuth, parsePagination } from "@/lib/api-middleware";
import { successResponse, errorResponse } from "@/lib/api-response";
import { customerSchema } from "@/lib/validations";
import { createAuditLog } from "@/services/audit.service";

export const GET = withAuth(
  async ({ request }) => {
    const { searchParams } = new URL(request.url);
    const { page, limit, skip, search, sortBy, sortOrder } = parsePagination(searchParams);

    const where: Record<string, unknown> = { deletedAt: null };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { code: { contains: search, mode: "insensitive" } },
        { country: { contains: search, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.customer.findMany({ where, include: { currency: true }, skip, take: limit, orderBy: { [sortBy]: sortOrder } }),
      prisma.customer.count({ where }),
    ]);

    return successResponse({ items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  },
  { module: "customers", action: "read" }
);

export const POST = withAuth(
  async ({ user, request }) => {
    const body = await request.json();
    const parsed = customerSchema.safeParse(body);
    if (!parsed.success) return errorResponse("Validation failed", parsed.error.issues);

    const customer = await prisma.customer.create({ data: { ...parsed.data, email: parsed.data.email || null } });
    await createAuditLog({ userId: user.id, action: "CREATE", module: "customers", recordId: customer.id, newValue: customer });
    return successResponse(customer, "Customer created", 201);
  },
  { module: "customers", action: "create" }
);
