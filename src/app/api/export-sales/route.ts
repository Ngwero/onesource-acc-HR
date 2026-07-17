import { withAuth } from "@/lib/api-middleware";
import { successResponse, errorResponse } from "@/lib/api-response";
import { createExportSale, confirmExportSale } from "@/services/export.service";
import { prisma } from "@/lib/prisma";

export const GET = withAuth(
  async () => {
    const items = await prisma.exportSale.findMany({
      include: { customer: true, produce: true, shipment: true },
      orderBy: { createdAt: "desc" },
    });
    return successResponse(items);
  },
  { module: "export_sales", action: "read" }
);

export const POST = withAuth(
  async ({ user, request }) => {
    const body = await request.json();
    if (body.action === "confirm") {
      const sale = await confirmExportSale(body.id, user.id);
      return successResponse(sale, "Export sale confirmed");
    }
    const sale = await createExportSale({ ...body, userId: user.id });
    return successResponse(sale, "Export sale created", 201);
  },
  { module: "export_sales", action: "create" }
);
