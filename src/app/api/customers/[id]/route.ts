import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-middleware";
import { successResponse, errorResponse, notFoundResponse } from "@/lib/api-response";
import { customerSchema } from "@/lib/validations";
import { createAuditLog } from "@/services/audit.service";

export const GET = withAuth(
  async ({ }, _req, params) => {
    const customer = await prisma.customer.findFirst({
      where: { id: params?.id, deletedAt: null },
    });
    if (!customer) return notFoundResponse("Customer not found");
    return successResponse(customer);
  },
  { module: "customers", action: "read" }
);

export const PUT = withAuth(
  async ({ user, request }, _req, params) => {
    const existing = await prisma.customer.findFirst({ where: { id: params?.id, deletedAt: null } });
    if (!existing) return notFoundResponse("Customer not found");
    const body = await request.json();
    const parsed = customerSchema.partial().safeParse(body);
    if (!parsed.success) return errorResponse("Validation failed", parsed.error.issues);
    const customer = await prisma.customer.update({
      where: { id: params!.id },
      data: { ...parsed.data, email: parsed.data.email || null },
    });
    await createAuditLog({ userId: user.id, action: "UPDATE", module: "customers", recordId: customer.id, oldValue: existing, newValue: customer });
    return successResponse(customer, "Customer updated");
  },
  { module: "customers", action: "update" }
);

export const DELETE = withAuth(
  async ({ user }, _req, params) => {
    const existing = await prisma.customer.findFirst({ where: { id: params?.id, deletedAt: null } });
    if (!existing) return notFoundResponse("Customer not found");
    await prisma.customer.update({ where: { id: params!.id }, data: { status: "INACTIVE", deletedAt: new Date() } });
    await createAuditLog({ userId: user.id, action: "DEACTIVATE", module: "customers", recordId: params!.id, oldValue: existing });
    return successResponse(null, "Customer deactivated");
  },
  { module: "customers", action: "delete" }
);
