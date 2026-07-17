import { withAuth } from "@/lib/api-middleware";
import { successResponse } from "@/lib/api-response";
import { createExportShipment, updateShipmentStatus } from "@/services/export.service";
import { prisma } from "@/lib/prisma";

export const GET = withAuth(
  async () => {
    const items = await prisma.exportShipment.findMany({
      include: { customer: true, produce: true, costs: true, exportSales: true },
      orderBy: { createdAt: "desc" },
    });
    return successResponse(items);
  },
  { module: "export_shipments", action: "read" }
);

export const POST = withAuth(
  async ({ user, request }) => {
    const body = await request.json();
    if (body.action === "update-status") {
      const shipment = await updateShipmentStatus(body.id, body.status, user.id);
      return successResponse(shipment, "Shipment status updated");
    }
    const shipment = await createExportShipment({ ...body, userId: user.id });
    return successResponse(shipment, "Export shipment created", 201);
  },
  { module: "export_shipments", action: "create" }
);
