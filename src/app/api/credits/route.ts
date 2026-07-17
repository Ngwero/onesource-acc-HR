import { withAuth } from "@/lib/api-middleware";
import { successResponse, errorResponse } from "@/lib/api-response";
import { applyCustomerCredit, applySupplierCredit } from "@/services/credit.service";

export const POST = withAuth(
  async ({ user, request }) => {
    const body = await request.json();

    try {
      if (body.action === "apply-customer-credit") {
        const result = await applyCustomerCredit(
          body.customerId,
          body.receivableId,
          body.amount,
          user.id
        );
        return successResponse(result, "Customer credit applied");
      }

      if (body.action === "apply-supplier-credit") {
        const result = await applySupplierCredit(
          body.supplierId,
          body.payableId,
          body.amount,
          user.id
        );
        return successResponse(result, "Supplier credit applied");
      }

      return errorResponse("Unknown action");
    } catch (err) {
      return errorResponse(err instanceof Error ? err.message : "Credit action failed");
    }
  },
  { module: "payments", action: "create" }
);
