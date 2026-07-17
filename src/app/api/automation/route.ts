import { withAuth } from "@/lib/api-middleware";
import { successResponse, errorResponse } from "@/lib/api-response";
import { getAutomationStatus, runScheduledJobs } from "@/services/automation.service";

export const GET = withAuth(
  async () => successResponse(await getAutomationStatus()),
  { module: "settings", action: "read" }
);

export const POST = withAuth(
  async ({ user, request }) => {
    const body = await request.json().catch(() => ({}));

    if (body.action !== "run-jobs") {
      return errorResponse("Unknown action");
    }

    try {
      const result = await runScheduledJobs({
        userId: user.id,
        skipEmail: body.skipEmail === true,
      });
      return successResponse(result, "Scheduled jobs completed");
    } catch (err) {
      return errorResponse(err instanceof Error ? err.message : "Job run failed");
    }
  },
  { module: "settings", action: "update" }
);
