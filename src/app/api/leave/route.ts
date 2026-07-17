import { withAuth } from "@/lib/api-middleware";
import { successResponse, errorResponse } from "@/lib/api-response";
import { leaveRequestSchema } from "@/lib/validations";
import { listLeaveRequests, createLeaveRequest } from "@/services/hr.service";

export const GET = withAuth(
  async ({ request }) => {
    const status = new URL(request.url).searchParams.get("status") || undefined;
    return successResponse(await listLeaveRequests(status));
  },
  { module: "leave", action: "read" }
);

export const POST = withAuth(
  async ({ user, request }) => {
    const body = await request.json();
    const parsed = leaveRequestSchema.safeParse(body);
    if (!parsed.success) return errorResponse("Validation failed", parsed.error.issues);

    try {
      const leave = await createLeaveRequest(parsed.data, user.id);
      return successResponse(leave, "Leave request submitted", 201);
    } catch (err) {
      return errorResponse(err instanceof Error ? err.message : "Failed to submit leave");
    }
  },
  { module: "leave", action: "create" }
);
