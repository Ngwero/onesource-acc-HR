import { withAuth } from "@/lib/api-middleware";
import { successResponse, errorResponse } from "@/lib/api-response";
import {
  listFiscalPeriods,
  ensureFiscalPeriods,
  closeFiscalPeriod,
  reopenFiscalPeriod,
  yearEndClose,
} from "@/services/period.service";

export const GET = withAuth(
  async ({ request }) => {
    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get("year");
    const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

    const periods = await listFiscalPeriods(year);
    return successResponse({ year, periods });
  },
  { module: "ledger", action: "read" }
);

export const POST = withAuth(
  async ({ user, request }) => {
    const body = await request.json();

    try {
      switch (body.action) {
        case "init": {
          const year = body.year || new Date().getFullYear();
          const result = await ensureFiscalPeriods(year);
          return successResponse(result, `Initialized fiscal periods for ${year}`);
        }
        case "close": {
          const period = await closeFiscalPeriod(body.periodId, user.id, body.notes);
          return successResponse(period, `Period ${period.name} closed`);
        }
        case "reopen": {
          const period = await reopenFiscalPeriod(body.periodId, user.id);
          return successResponse(period, `Period ${period.name} reopened`);
        }
        case "year-end": {
          const year = body.year || new Date().getFullYear();
          const result = await yearEndClose(year, user.id);
          return successResponse(result, `Year-end close completed for ${year}`);
        }
        default:
          return errorResponse("Unknown action");
      }
    } catch (err) {
      return errorResponse(err instanceof Error ? err.message : "Period action failed");
    }
  },
  { module: "ledger", action: "approve" }
);
