import { withAuth } from "@/lib/api-middleware";
import { successResponse, errorResponse, forbiddenResponse } from "@/lib/api-response";
import { canPerformAction } from "@/lib/permissions";
import { BULK_ENTITIES, getBulkEntity, type BulkEntityId } from "@/lib/bulk-import-config";
import { runBulkImport } from "@/services/bulk-import.service";

export const GET = withAuth(
  async ({ user, request }) => {
    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entity");

    if (entityId) {
      const entity = getBulkEntity(entityId);
      if (!entity) return errorResponse("Unknown entity");
      if (!canPerformAction(user.role, entity.module, "create")) {
        return forbiddenResponse(`You cannot import ${entity.label}`);
      }
      return successResponse({
        ...entity,
        headers: entity.columns.map((c) => c.key),
        templateRows: [entity.sampleRow],
      });
    }

    const available = BULK_ENTITIES.filter((e) => canPerformAction(user.role, e.module, "create")).map((e) => ({
      id: e.id,
      label: e.label,
      description: e.description,
      module: e.module,
      columnCount: e.columns.length,
      groupBy: e.groupBy,
    }));

    return successResponse(available);
  },
  { module: "settings", action: "read" }
);

export const POST = withAuth(
  async ({ user, request }) => {
    const body = await request.json();
    const entityId = body.entity as BulkEntityId;
    const rows = body.rows as Record<string, unknown>[];
    const dryRun = Boolean(body.dryRun);

    if (!entityId || !Array.isArray(rows) || rows.length === 0) {
      return errorResponse("entity and rows[] are required");
    }
    if (rows.length > 500) {
      return errorResponse("Maximum 500 rows per import");
    }

    const entity = getBulkEntity(entityId);
    if (!entity) return errorResponse("Unknown entity");
    if (!canPerformAction(user.role, entity.module, "create")) {
      return forbiddenResponse(`You cannot import ${entity.label}`);
    }

    const result = await runBulkImport(entityId, rows, user.id, user.role, dryRun);
    return successResponse(
      result,
      dryRun
        ? `Validation complete: ${result.succeeded}/${result.total} rows valid`
        : `Import complete: ${result.succeeded}/${result.total} rows succeeded`
    );
  },
  { module: "settings", action: "update" }
);
