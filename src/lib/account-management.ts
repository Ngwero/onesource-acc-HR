import type { UserRole } from "@/generated/prisma/client";

export const ALL_USER_ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "ACCOUNTANT",
  "PROCUREMENT_OFFICER",
  "SALES_OFFICER",
  "WAREHOUSE_OFFICER",
  "EXPORT_OFFICER",
  "AUDITOR",
];

const ROLE_RANK: Record<UserRole, number> = {
  SUPER_ADMIN: 100,
  ADMIN: 90,
  MANAGER: 80,
  ACCOUNTANT: 50,
  PROCUREMENT_OFFICER: 50,
  SALES_OFFICER: 50,
  WAREHOUSE_OFFICER: 50,
  EXPORT_OFFICER: 50,
  AUDITOR: 40,
};

export function isSuperAdmin(role: UserRole): boolean {
  return role === "SUPER_ADMIN";
}

export function canManageAccounts(role: UserRole): boolean {
  return role === "SUPER_ADMIN" || role === "ADMIN" || role === "MANAGER";
}

export function getAssignableRoles(actorRole: UserRole): UserRole[] {
  if (actorRole === "SUPER_ADMIN") return ALL_USER_ROLES;
  if (actorRole === "ADMIN") return ALL_USER_ROLES.filter((r) => r !== "SUPER_ADMIN");
  if (actorRole === "MANAGER") {
    return ["ACCOUNTANT", "PROCUREMENT_OFFICER", "SALES_OFFICER", "WAREHOUSE_OFFICER", "EXPORT_OFFICER", "AUDITOR"];
  }
  return [];
}

export function canAssignRole(actorRole: UserRole, targetRole: UserRole): boolean {
  return getAssignableRoles(actorRole).includes(targetRole);
}

export function canManageTargetUser(
  actorRole: UserRole,
  targetRole: UserRole,
  actorId: string,
  targetId: string
): boolean {
  if (actorId === targetId) return false;
  if (!canManageAccounts(actorRole)) return false;
  if (isSuperAdmin(actorRole)) return true;
  if (targetRole === "SUPER_ADMIN") return false;
  if (actorRole === "ADMIN") return true;
  if (actorRole === "MANAGER") return ROLE_RANK[targetRole] < ROLE_RANK.MANAGER;
  return false;
}

export function canEditPermissions(role: UserRole): boolean {
  return role === "SUPER_ADMIN";
}
