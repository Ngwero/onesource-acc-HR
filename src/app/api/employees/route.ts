import { withAuth } from "@/lib/api-middleware";
import { successResponse, errorResponse } from "@/lib/api-response";
import { employeeSchema } from "@/lib/validations";
import { listEmployees, createEmployee } from "@/services/hr.service";
import type { EmploymentStatus } from "@/generated/prisma/client";

export const GET = withAuth(
  async ({ request }) => {
    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get("departmentId") || undefined;
    const status = (searchParams.get("status") || undefined) as EmploymentStatus | undefined;
    const search = searchParams.get("search") || undefined;
    return successResponse(await listEmployees({ departmentId, status, search }));
  },
  { module: "employees", action: "read" }
);

export const POST = withAuth(
  async ({ user, request }) => {
    const body = await request.json();
    const parsed = employeeSchema.safeParse(body);
    if (!parsed.success) return errorResponse("Validation failed", parsed.error.issues);

    try {
      const employee = await createEmployee(parsed.data, user.id);
      return successResponse(employee, "Employee created", 201);
    } catch (err) {
      return errorResponse(err instanceof Error ? err.message : "Failed to create employee");
    }
  },
  { module: "employees", action: "create" }
);
