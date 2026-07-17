import { prisma } from "@/lib/prisma";
import { withAuth, parsePagination } from "@/lib/api-middleware";
import {
  successResponse,
  errorResponse,
  notFoundResponse,
} from "@/lib/api-response";
import { produceSchema } from "@/lib/validations";
import { createAuditLog } from "@/services/audit.service";
import { isReadOnly } from "@/lib/permissions";
import * as XLSX from "xlsx";

export const GET = withAuth(
  async ({ request }) => {
    const { searchParams } = new URL(request.url);
    const { page, limit, skip, search, sortBy, sortOrder } = parsePagination(searchParams);
    const category = searchParams.get("category");
    const status = searchParams.get("status");

    const where: Record<string, unknown> = { deletedAt: null };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { code: { contains: search, mode: "insensitive" } },
        { category: { contains: search, mode: "insensitive" } },
      ];
    }
    if (category) where.category = category;
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      prisma.produce.findMany({
        where,
        include: { unitOfMeasure: true },
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.produce.count({ where }),
    ]);

    return successResponse({ items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  },
  { module: "produce", action: "read" }
);

export const POST = withAuth(
  async ({ user, request }) => {
    const body = await request.json();
    const parsed = produceSchema.safeParse(body);
    if (!parsed.success) return errorResponse("Validation failed", parsed.error.issues);

    const existing = await prisma.produce.findUnique({ where: { code: parsed.data.code } });
    if (existing) return errorResponse("Produce code already exists");

    const produce = await prisma.produce.create({
      data: parsed.data,
      include: { unitOfMeasure: true },
    });

    await createAuditLog({
      userId: user.id,
      action: "CREATE",
      module: "produce",
      recordId: produce.id,
      newValue: produce,
    });

    return successResponse(produce, "Produce created successfully", 201);
  },
  { module: "produce", action: "create" }
);
