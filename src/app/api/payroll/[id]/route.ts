import { withAuth } from "@/lib/api-middleware";
import { successResponse, errorResponse } from "@/lib/api-response";
import {
  approvePayRun,
  payPayRun,
  cancelPayRun,
  getPayRun,
} from "@/services/hr.service";
import { canApprove } from "@/lib/permissions";

export const GET = withAuth(
  async (_ctx, _req, params) => {
    try {
      return successResponse(await getPayRun(params!.id));
    } catch (err) {
      return errorResponse(err instanceof Error ? err.message : "Not found", [], 404);
    }
  },
  { module: "payroll", action: "read" }
);

export const PATCH = withAuth(
  async ({ user, request }, _req, params) => {
    const body = await request.json();
    const action = body.action as string;

    if (
      !canApprove(user.role) &&
      (action === "approve" || action === "pay" || action === "cancel")
    ) {
      return errorResponse("You do not have approval permissions", [], 403);
    }

    try {
      if (action === "approve") {
        const payRun = await approvePayRun(params!.id, user.id);
        return successResponse(payRun, "Pay run approved");
      }
      if (action === "pay") {
        const payRun = await payPayRun(params!.id, user.id);
        return successResponse(payRun, "Pay run paid and posted to GL");
      }
      if (action === "cancel") {
        const payRun = await cancelPayRun(params!.id, user.id);
        return successResponse(payRun, "Pay run cancelled");
      }
      return errorResponse("Unknown action — use approve, pay, or cancel");
    } catch (err) {
      return errorResponse(err instanceof Error ? err.message : "Payroll action failed");
    }
  },
  { module: "payroll", action: "approve" }
);
