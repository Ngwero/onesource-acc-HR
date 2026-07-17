import { withAuth } from "@/lib/api-middleware";
import { successResponse, errorResponse } from "@/lib/api-response";
import { confirmSale } from "@/services/sale.service";

export const POST = withAuth(
  async ({ user }, _req, params) => {
    try {
      const sale = await confirmSale(params!.id, user.id);
      return successResponse(sale, "Sale confirmed successfully");
    } catch (e) {
      return errorResponse(e instanceof Error ? e.message : "Confirmation failed");
    }
  },
  { module: "local_sales", action: "update" }
);
