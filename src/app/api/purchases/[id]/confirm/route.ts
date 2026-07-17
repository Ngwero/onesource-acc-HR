import { withAuth } from "@/lib/api-middleware";
import { successResponse, errorResponse, notFoundResponse } from "@/lib/api-response";
import { confirmPurchaseWithThreeWayMatch } from "@/services/purchase-order.service";
import { prisma } from "@/lib/prisma";

export const GET = withAuth(
  async ({ }, _req, params) => {
    const purchase = await prisma.purchase.findUnique({
      where: { id: params?.id },
      include: {
        supplier: true,
        items: { include: { produce: true } },
        createdBy: { select: { fullName: true } },
        approvedBy: { select: { fullName: true } },
        payables: true,
      },
    });
    if (!purchase) return notFoundResponse("Purchase not found");
    return successResponse(purchase);
  },
  { module: "purchases", action: "read" }
);

export const POST = withAuth(
  async ({ user }, _req, params) => {
    try {
      const purchase = await confirmPurchaseWithThreeWayMatch(params!.id, user.id);
      return successResponse(purchase, "Purchase confirmed successfully");
    } catch (e) {
      return errorResponse(e instanceof Error ? e.message : "Confirmation failed");
    }
  },
  { module: "purchases", action: "update" }
);
