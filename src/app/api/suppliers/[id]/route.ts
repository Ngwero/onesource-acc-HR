import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-middleware";
import { successResponse, errorResponse, notFoundResponse } from "@/lib/api-response";
import { supplierSchema } from "@/lib/validations";
import { createAuditLog } from "@/services/audit.service";

export const GET = withAuth(
  async ({ }, _req, params) => {
    const supplier = await prisma.supplier.findFirst({
      where: { id: params?.id, deletedAt: null },
      include: { purchases: { orderBy: { purchaseDate: "desc" }, take: 10 }, payables: true },
    });
    if (!supplier) return notFoundResponse("Supplier not found");
    return successResponse(supplier);
  },
  { module: "suppliers", action: "read" }
);

export const PUT = withAuth(
  async ({ user, request }, _req, params) => {
    const existing = await prisma.supplier.findFirst({ where: { id: params?.id, deletedAt: null } });
    if (!existing) return notFoundResponse("Supplier not found");
    const body = await request.json();
    const parsed = supplierSchema.partial().safeParse(body);
    if (!parsed.success) return errorResponse("Validation failed", parsed.error.issues);
    const supplier = await prisma.supplier.update({
      where: { id: params!.id },
      data: { ...parsed.data, email: parsed.data.email || null },
    });
    await createAuditLog({ userId: user.id, action: "UPDATE", module: "suppliers", recordId: supplier.id, oldValue: existing, newValue: supplier });
    return successResponse(supplier, "Supplier updated");
  },
  { module: "suppliers", action: "update" }
);

export const DELETE = withAuth(
  async ({ user }, _req, params) => {
    const existing = await prisma.supplier.findFirst({ where: { id: params?.id, deletedAt: null } });
    if (!existing) return notFoundResponse("Supplier not found");
    await prisma.supplier.update({ where: { id: params!.id }, data: { status: "INACTIVE", deletedAt: new Date() } });
    await createAuditLog({ userId: user.id, action: "DEACTIVATE", module: "suppliers", recordId: params!.id, oldValue: existing });
    return successResponse(null, "Supplier deactivated");
  },
  { module: "suppliers", action: "delete" }
);
