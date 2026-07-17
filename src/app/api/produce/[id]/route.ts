import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-middleware";
import {
  successResponse,
  errorResponse,
  notFoundResponse,
} from "@/lib/api-response";
import { produceSchema } from "@/lib/validations";
import { createAuditLog } from "@/services/audit.service";

export const GET = withAuth(
  async ({ request }, _req, params) => {
    const produce = await prisma.produce.findFirst({
      where: { id: params?.id, deletedAt: null },
      include: { unitOfMeasure: true },
    });
    if (!produce) return notFoundResponse("Produce not found");
    return successResponse(produce);
  },
  { module: "produce", action: "read" }
);

export const PUT = withAuth(
  async ({ user, request }, _req, params) => {
    const existing = await prisma.produce.findFirst({
      where: { id: params?.id, deletedAt: null },
    });
    if (!existing) return notFoundResponse("Produce not found");

    const body = await request.json();
    const parsed = produceSchema.partial().safeParse(body);
    if (!parsed.success) return errorResponse("Validation failed", parsed.error.issues);

    const produce = await prisma.produce.update({
      where: { id: params!.id },
      data: parsed.data,
      include: { unitOfMeasure: true },
    });

    await createAuditLog({
      userId: user.id,
      action: "UPDATE",
      module: "produce",
      recordId: produce.id,
      oldValue: existing,
      newValue: produce,
    });

    return successResponse(produce, "Produce updated successfully");
  },
  { module: "produce", action: "update" }
);

export const DELETE = withAuth(
  async ({ user }, _req, params) => {
    const existing = await prisma.produce.findFirst({
      where: { id: params?.id, deletedAt: null },
    });
    if (!existing) return notFoundResponse("Produce not found");

    await prisma.produce.update({
      where: { id: params!.id },
      data: { status: "INACTIVE", deletedAt: new Date() },
    });

    await createAuditLog({
      userId: user.id,
      action: "DEACTIVATE",
      module: "produce",
      recordId: params!.id,
      oldValue: existing,
    });

    return successResponse(null, "Produce deactivated");
  },
  { module: "produce", action: "delete" }
);
