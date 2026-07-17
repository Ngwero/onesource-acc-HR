import { withAuth } from "@/lib/api-middleware";
import { successResponse, errorResponse } from "@/lib/api-response";
import { payRunSchema } from "@/lib/validations";
import { listPayRuns, createPayRun } from "@/services/hr.service";

export const GET = withAuth(
  async () => successResponse(await listPayRuns()),
  { module: "payroll", action: "read" }
);

export const POST = withAuth(
  async ({ user, request }) => {
    const body = await request.json();
    const parsed = payRunSchema.safeParse(body);
    if (!parsed.success) return errorResponse("Validation failed", parsed.error.issues);

    try {
      const payRun = await createPayRun(parsed.data, user.id);
      return successResponse(payRun, "Pay run created", 201);
    } catch (err) {
      return errorResponse(err instanceof Error ? err.message : "Failed to create pay run");
    }
  },
  { module: "payroll", action: "create" }
);
