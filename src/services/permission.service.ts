import { prisma } from "@/lib/prisma";
import { MODULES, ROLE_PERMISSIONS, type Module } from "@/lib/permissions";
import type { UserRole } from "@/generated/prisma/client";

type PermissionRow = {
  module: string;
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canApprove: boolean;
  canExport: boolean;
};

let cache: Map<UserRole, PermissionRow[]> | null = null;
let cacheAt = 0;
const CACHE_MS = 30_000;

function defaultRowsForRole(role: UserRole): PermissionRow[] {
  const config = ROLE_PERMISSIONS[role];
  if (!config) return [];

  return MODULES.map((module) => {
    const hasAccess = config.modules.includes(module);
    const readOnly = config.readOnly;
    return {
      module,
      canRead: hasAccess,
      canCreate: hasAccess && !readOnly,
      canUpdate: hasAccess && !readOnly,
      canDelete: hasAccess && !readOnly && (role === "SUPER_ADMIN" || role === "ADMIN"),
      canApprove: hasAccess && config.canApprove,
      canExport: hasAccess,
    };
  });
}

export async function seedDefaultPermissions() {
  for (const role of Object.keys(ROLE_PERMISSIONS) as UserRole[]) {
    for (const row of defaultRowsForRole(role)) {
      await prisma.permission.upsert({
        where: { role_module: { role, module: row.module } },
        create: { role, ...row },
        update: row,
      });
    }
  }
  invalidatePermissionCache();
}

export function invalidatePermissionCache() {
  cache = null;
  cacheAt = 0;
}

export async function getPermissionsForRole(role: UserRole): Promise<PermissionRow[]> {
  if (cache && Date.now() - cacheAt < CACHE_MS) {
    const cached = cache.get(role);
    if (cached) return cached;
  }

  const rows = await prisma.permission.findMany({ where: { role } });
  if (rows.length === 0) {
    return defaultRowsForRole(role);
  }

  if (!cache) cache = new Map();
  cache.set(role, rows);
  cacheAt = Date.now();
  return rows;
}

export async function getAllRolePermissions() {
  const roles = Object.keys(ROLE_PERMISSIONS) as UserRole[];
  const result: Record<string, PermissionRow[]> = {};
  for (const role of roles) {
    result[role] = await getPermissionsForRole(role);
  }
  return result;
}

export async function updatePermission(
  role: UserRole,
  module: string,
  data: Partial<Omit<PermissionRow, "module">>
) {
  const updated = await prisma.permission.upsert({
    where: { role_module: { role, module } },
    create: {
      role,
      module,
      canCreate: data.canCreate ?? false,
      canRead: data.canRead ?? true,
      canUpdate: data.canUpdate ?? false,
      canDelete: data.canDelete ?? false,
      canApprove: data.canApprove ?? false,
      canExport: data.canExport ?? false,
    },
    update: data,
  });
  invalidatePermissionCache();
  return updated;
}

export async function checkDbPermission(
  role: UserRole,
  module: Module,
  action: "create" | "read" | "update" | "delete" | "approve" | "export"
): Promise<boolean | null> {
  const rows = await getPermissionsForRole(role);
  const row = rows.find((r) => r.module === module);
  if (!row) return null;
  if (!row.canRead && action !== "read") return false;
  switch (action) {
    case "read": return row.canRead;
    case "create": return row.canCreate;
    case "update": return row.canUpdate;
    case "delete": return row.canDelete;
    case "approve": return row.canApprove;
    case "export": return row.canExport;
    default: return false;
  }
}
