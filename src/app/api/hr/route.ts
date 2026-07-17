import { withAuth } from "@/lib/api-middleware";
import { successResponse, errorResponse } from "@/lib/api-response";
import { getHrSummary, ensureLeavePolicies } from "@/services/hr.service";

export const GET = withAuth(
  async ({ request }) => {
    try {
      const { searchParams } = new URL(request.url);
      if (searchParams.get("view") === "policies") {
        return successResponse(await ensureLeavePolicies());
      }
      return successResponse(await getHrSummary());
    } catch (err) {
      console.error("HR summary error:", err);
      return errorResponse(
        err instanceof Error ? err.message : "Failed to load HR summary",
        [],
        500
      );
    }
  },
  { module: "employees", action: "read" }
);

export const POST = withAuth(
  async () => {
    try {
      const policies = await ensureLeavePolicies();
      return successResponse(policies, "Leave policies ready");
    } catch (err) {
      return errorResponse(err instanceof Error ? err.message : "Failed");
    }
  },
  { module: "employees", action: "update" }
);
