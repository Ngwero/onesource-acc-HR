import { withAuth } from "@/lib/api-middleware";
import { successResponse, errorResponse } from "@/lib/api-response";
import { departmentSchema } from "@/lib/validations";
import { listDepartments, createDepartment } from "@/services/hr.service";

export const GET = withAuth(
  async () => successResponse(await listDepartments()),
  { module: "employees", action: "read" }
);

export const POST = withAuth(
  async ({ user, request }) => {
    const body = await request.json();
    const parsed = departmentSchema.safeParse(body);
    if (!parsed.success) return errorResponse("Validation failed", parsed.error.issues);

    try {
      const dept = await createDepartment(parsed.data, user.id);
      return successResponse(dept, "Department created", 201);
    } catch (err) {
      return errorResponse(err instanceof Error ? err.message : "Failed to create department");
    }
  },
  { module: "employees", action: "create" }
);
