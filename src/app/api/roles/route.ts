import { withAuth } from "@/lib/api-middleware";
import { successResponse, errorResponse, forbiddenResponse } from "@/lib/api-response";
import { getRoleLabel, getRoleDescription, MODULES } from "@/lib/permissions";
import { ALL_USER_ROLES, canEditPermissions } from "@/lib/account-management";
import { getAllRolePermissions, updatePermission } from "@/services/permission.service";
import type { UserRole } from "@/generated/prisma/client";

export const GET = withAuth(
  async () => {
    const matrix = await getAllRolePermissions();
    const roles = ALL_USER_ROLES.map((role) => ({
      role,
      label: getRoleLabel(role),
      description: getRoleDescription(role),
      permissions: matrix[role] || [],
      modules: MODULES.filter((m) => matrix[role]?.some((p) => p.module === m && p.canRead)),
    }));
    return successResponse({ roles, modules: MODULES });
  },
  { module: "users", action: "read" }
);

export const PUT = withAuth(
  async ({ user, request }) => {
    if (!canEditPermissions(user.role)) {
      return forbiddenResponse("Only Super Admin can edit role permissions");
    }

    const body = await request.json();
    const { role, module, ...flags } = body as {
      role: UserRole;
      module: string;
      canCreate?: boolean;
      canRead?: boolean;
      canUpdate?: boolean;
      canDelete?: boolean;
      canApprove?: boolean;
      canExport?: boolean;
    };

    if (role === "SUPER_ADMIN") {
      return errorResponse("Super Admin permissions cannot be modified");
    }
    if (!module) return errorResponse("Module required");

    const updated = await updatePermission(role, module, flags);
    return successResponse(updated, "Permission updated");
  },
  { module: "users", action: "update" }
);
