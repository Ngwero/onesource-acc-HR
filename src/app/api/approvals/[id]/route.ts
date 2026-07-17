import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-middleware";
import { successResponse, errorResponse } from "@/lib/api-response";
import { approvalSchema } from "@/lib/validations";
import { createAuditLog } from "@/services/audit.service";
import { canApprove, canApprovePasswordReset } from "@/lib/permissions";
import { executeApprovedRequest } from "@/services/approval.service";

export const PATCH = withAuth(
  async ({ user, request }, _req, params) => {
    if (!canApprove(user.role)) {
      return errorResponse("You do not have approval permissions", [], 403);
    }

    const approval = await prisma.approvalRequest.findUnique({
      where: { id: params!.id },
    });
    if (!approval) return errorResponse("Approval request not found", [], 404);
    if (approval.status !== "PENDING") return errorResponse("Request already processed");
    if (approval.requestedById === user.id) {
      return errorResponse("You cannot approve your own request", [], 403);
    }

    if (approval.requestType === "PASSWORD_RESET" && !canApprovePasswordReset(user.role)) {
      return errorResponse("Only Super Admin or Admin can approve password resets", [], 403);
    }

    const body = await request.json();
    const parsed = approvalSchema.safeParse(body);
    if (!parsed.success) return errorResponse("Validation failed", parsed.error.issues);

    const updated = await prisma.approvalRequest.update({
      where: { id: params!.id },
      data: {
        status: parsed.data.status,
        approverId: user.id,
        approvalDate: new Date(),
        comments: parsed.data.comments,
      },
    });

    let executionResult: unknown = null;
    if (parsed.data.status === "APPROVED") {
      try {
        executionResult = await executeApprovedRequest(updated, user.id);
      } catch (err) {
        await prisma.approvalRequest.update({
          where: { id: params!.id },
          data: { status: "PENDING", approverId: null, approvalDate: null },
        });
        const message = err instanceof Error ? err.message : "Failed to execute approved action";
        return errorResponse(message);
      }
    }

    await createAuditLog({
      userId: user.id,
      action: parsed.data.status,
      module: "approvals",
      recordId: updated.id,
      newValue: updated,
      reason: parsed.data.comments,
    });

    return successResponse(
      { approval: updated, execution: executionResult },
      parsed.data.status === "APPROVED" && executionResult
        ? "Request approved and executed"
        : `Request ${parsed.data.status.toLowerCase()}`
    );
  },
  { module: "approvals", action: "approve" }
);
