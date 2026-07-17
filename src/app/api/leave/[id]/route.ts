import { withAuth } from "@/lib/api-middleware";
import { successResponse, errorResponse } from "@/lib/api-response";
import { reviewLeaveRequest } from "@/services/hr.service";
import { canApprove } from "@/lib/permissions";

export const PATCH = withAuth(
  async ({ user, request }, _req, params) => {
    const body = await request.json();
    const action = body.action as "approve" | "reject";
    if (!["approve", "reject"].includes(action)) {
      return errorResponse("action must be approve or reject");
    }
    if (!canApprove(user.role)) {
      return errorResponse("You do not have approval permissions", [], 403);
    }

    try {
      const updated = await reviewLeaveRequest(params!.id, action, user.id, body.comments);
      return successResponse(updated, `Leave request ${action}d`);
    } catch (err) {
      return errorResponse(err instanceof Error ? err.message : "Review failed");
    }
  },
  { module: "leave", action: "approve" }
);
