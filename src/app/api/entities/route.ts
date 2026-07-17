import { withAuth } from "@/lib/api-middleware";
import { successResponse, errorResponse } from "@/lib/api-response";
import { listEntities, createEntity, getConsolidatedTrialBalance } from "@/services/entity.service";

export const GET = withAuth(
  async ({ request }) => {
    const { searchParams } = new URL(request.url);
    const view = searchParams.get("view");

    if (view === "consolidated-trial-balance") {
      const asOf = searchParams.get("asOfDate");
      return successResponse(
        await getConsolidatedTrialBalance(asOf ? new Date(asOf) : undefined)
      );
    }

    return successResponse(await listEntities());
  },
  { module: "settings", action: "read" }
);

export const POST = withAuth(
  async ({ request }) => {
    const body = await request.json();
    if (!body.code || !body.name) return errorResponse("code and name are required");

    try {
      const entity = await createEntity(body);
      return successResponse(entity, "Entity created", 201);
    } catch (err) {
      return errorResponse(err instanceof Error ? err.message : "Failed to create entity");
    }
  },
  { module: "settings", action: "create" }
);
