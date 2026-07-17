import { withAuth } from "@/lib/api-middleware";
import { successResponse, errorResponse } from "@/lib/api-response";
import { attendanceSchema, bulkAttendanceSchema } from "@/lib/validations";
import {
  listAttendance,
  upsertAttendance,
  markBulkAttendance,
} from "@/services/hr.service";

export const GET = withAuth(
  async ({ request }) => {
    const { searchParams } = new URL(request.url);
    return successResponse(
      await listAttendance({
        from: searchParams.get("from") || undefined,
        to: searchParams.get("to") || undefined,
        employeeId: searchParams.get("employeeId") || undefined,
      })
    );
  },
  { module: "employees", action: "read" }
);

export const POST = withAuth(
  async ({ user, request }) => {
    const body = await request.json();

    if (body.action === "bulk") {
      const parsed = bulkAttendanceSchema.safeParse(body);
      if (!parsed.success) return errorResponse("Validation failed", parsed.error.issues);
      try {
        const result = await markBulkAttendance(parsed.data, user.id);
        return successResponse(result, `Marked ${result.count} employees`, 201);
      } catch (err) {
        return errorResponse(err instanceof Error ? err.message : "Bulk attendance failed");
      }
    }

    const parsed = attendanceSchema.safeParse(body);
    if (!parsed.success) return errorResponse("Validation failed", parsed.error.issues);

    try {
      const record = await upsertAttendance(parsed.data, user.id);
      return successResponse(record, "Attendance saved", 201);
    } catch (err) {
      return errorResponse(err instanceof Error ? err.message : "Attendance failed");
    }
  },
  { module: "employees", action: "create" }
);
