import { NextRequest } from "next/server";
import { runScheduledJobs } from "@/services/automation.service";
import { successResponse, unauthorizedResponse, errorResponse } from "@/lib/api-response";

function verifyCronSecret(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const auth = request.headers.get("authorization");
  const headerSecret =
    auth?.startsWith("Bearer ") ? auth.slice(7) : request.headers.get("x-cron-secret");

  return headerSecret === secret;
}

export async function POST(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return unauthorizedResponse("Invalid cron secret");
  }

  try {
    const body = await request.json().catch(() => ({}));
    const result = await runScheduledJobs({
      skipEmail: body.skipEmail === true,
    });
    return successResponse(result, "Scheduled jobs completed");
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Cron run failed");
  }
}

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return unauthorizedResponse("Invalid cron secret");
  }
  return successResponse({
    ok: true,
    message: "POST to this endpoint to run scheduled jobs",
    jobs: ["markOverdue", "recurring", "depreciation", "overdueReminders"],
  });
}
