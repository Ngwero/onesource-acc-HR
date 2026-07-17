import { withAuth } from "@/lib/api-middleware";
import { successResponse, errorResponse, notFoundResponse } from "@/lib/api-response";
import { employeeSchema, employeeDocumentSchema } from "@/lib/validations";
import {
  getEmployee,
  updateEmployee,
  deactivateEmployee,
  terminateEmployee,
  addEmployeeDocument,
  ensureEmployeeLeaveBalances,
} from "@/services/hr.service";

export const GET = withAuth(
  async (_ctx, _req, params) => {
    try {
      const employee = await getEmployee(params!.id);
      return successResponse(employee);
    } catch {
      return notFoundResponse("Employee not found");
    }
  },
  { module: "employees", action: "read" }
);

export const PATCH = withAuth(
  async ({ user, request }, _req, params) => {
    const body = await request.json();

    if (body.action === "terminate") {
      try {
        const updated = await terminateEmployee(params!.id, user.id, body.reason);
        return successResponse(updated, "Employee terminated");
      } catch (err) {
        return errorResponse(err instanceof Error ? err.message : "Terminate failed");
      }
    }

    if (body.action === "ensure-leave-balances") {
      const balances = await ensureEmployeeLeaveBalances(params!.id);
      return successResponse(balances, "Leave balances ready");
    }

    if (body.action === "add-document") {
      const parsed = employeeDocumentSchema.safeParse(body);
      if (!parsed.success) return errorResponse("Validation failed", parsed.error.issues);
      const doc = await addEmployeeDocument(
        { ...parsed.data, employeeId: params!.id },
        user.id
      );
      return successResponse(doc, "Document added", 201);
    }

    const parsed = employeeSchema.partial().safeParse(body);
    if (!parsed.success) return errorResponse("Validation failed", parsed.error.issues);

    try {
      const updated = await updateEmployee(params!.id, parsed.data, user.id);
      return successResponse(updated, "Employee updated");
    } catch (err) {
      return errorResponse(err instanceof Error ? err.message : "Update failed");
    }
  },
  { module: "employees", action: "update" }
);

export const DELETE = withAuth(
  async ({ user }, _req, params) => {
    try {
      await deactivateEmployee(params!.id, user.id);
      return successResponse(null, "Employee deactivated");
    } catch (err) {
      return errorResponse(err instanceof Error ? err.message : "Deactivate failed");
    }
  },
  { module: "employees", action: "delete" }
);
