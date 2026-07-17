import type { UserRole } from "@/generated/prisma/client";

export const MODULES = [
  "dashboard",
  "produce",
  "suppliers",
  "customers",
  "purchases",
  "purchase_orders",
  "inventory",
  "local_sales",
  "quotes",
  "export_sales",
  "export_shipments",
  "expenses",
  "payables",
  "receivables",
  "invoices",
  "credit_notes",
  "payments",
  "bank",
  "recurring",
  "ledger",
  "reports",
  "budgets",
  "fixed_assets",
  "tax",
  "approvals",
  "audit",
  "settings",
  "users",
  "employees",
  "leave",
  "payroll",
] as const;

export type Module = (typeof MODULES)[number];

export type PermissionAction =
  | "create"
  | "read"
  | "update"
  | "delete"
  | "approve"
  | "export";

interface RolePermissions {
  modules: Module[];
  canApprove: boolean;
  readOnly: boolean;
}

const ALL_MODULES = [...MODULES] as Module[];

const FINANCE_MODULES: Module[] = [
  "dashboard",
  "expenses",
  "payables",
  "receivables",
  "invoices",
  "credit_notes",
  "payments",
  "bank",
  "recurring",
  "ledger",
  "reports",
  "budgets",
  "fixed_assets",
  "tax",
  "payroll",
  "audit",
];

const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  SUPER_ADMIN: { modules: ALL_MODULES, canApprove: true, readOnly: false },
  ADMIN: { modules: ALL_MODULES, canApprove: true, readOnly: false },
  ACCOUNTANT: { modules: FINANCE_MODULES, canApprove: false, readOnly: false },
  PROCUREMENT_OFFICER: {
    modules: ["dashboard", "produce", "suppliers", "purchases", "purchase_orders", "inventory", "employees", "leave"],
    canApprove: false,
    readOnly: false,
  },
  SALES_OFFICER: {
    modules: ["dashboard", "customers", "local_sales", "quotes", "invoices", "credit_notes", "payments", "receivables"],
    canApprove: false,
    readOnly: false,
  },
  WAREHOUSE_OFFICER: {
    modules: ["dashboard", "produce", "inventory", "reports"],
    canApprove: false,
    readOnly: false,
  },
  EXPORT_OFFICER: {
    modules: ["dashboard", "customers", "export_sales", "export_shipments", "inventory", "quotes"],
    canApprove: false,
    readOnly: false,
  },
  MANAGER: { modules: ALL_MODULES, canApprove: true, readOnly: false },
  AUDITOR: {
    modules: [...ALL_MODULES.filter((m) => m !== "users"), "employees", "leave", "payroll"],
    canApprove: false,
    readOnly: true,
  },
};

export function canAccessModule(role: UserRole, module: Module): boolean {
  return ROLE_PERMISSIONS[role]?.modules.includes(module) ?? false;
}

export function isReadOnly(role: UserRole): boolean {
  return ROLE_PERMISSIONS[role]?.readOnly ?? true;
}

export function canApprove(role: UserRole): boolean {
  return ROLE_PERMISSIONS[role]?.canApprove ?? false;
}

/** Password reset requests may only be approved by Super Admin or Admin. */
export function canApprovePasswordReset(role: UserRole): boolean {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

export function canPerformAction(
  role: UserRole,
  module: Module,
  action: PermissionAction
): boolean {
  if (!canAccessModule(role, module)) return false;
  if (isReadOnly(role)) return action === "read" || action === "export";
  if (action === "approve") return canApprove(role);
  if (action === "delete" && role !== "SUPER_ADMIN" && role !== "ADMIN") return false;
  return true;
}

export function getRoleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    SUPER_ADMIN: "Super Admin",
    ADMIN: "Admin",
    ACCOUNTANT: "Accountant",
    PROCUREMENT_OFFICER: "Procurement Officer",
    SALES_OFFICER: "Sales Officer",
    WAREHOUSE_OFFICER: "Warehouse Officer",
    EXPORT_OFFICER: "Export Officer",
    MANAGER: "Manager/Director",
    AUDITOR: "Auditor",
  };
  return labels[role] || role;
}

export function getRoleDescription(role: UserRole): string {
  const descriptions: Record<UserRole, string> = {
    SUPER_ADMIN: "Full system control — manages all roles, permissions, and users",
    ADMIN: "Full module access — manages users except Super Admins",
    MANAGER: "Operational oversight — approves workflows, manages staff roles",
    ACCOUNTANT: "Finance modules — ledger, payables, receivables, reports",
    PROCUREMENT_OFFICER: "Purchasing — suppliers, POs, inventory receipts",
    SALES_OFFICER: "Sales — customers, quotes, invoices, local sales",
    WAREHOUSE_OFFICER: "Inventory — stock levels, movements, adjustments",
    EXPORT_OFFICER: "Export — export sales, shipments, allocation",
    AUDITOR: "Read-only access to all modules for audit review",
  };
  return descriptions[role] || "";
}

export { ROLE_PERMISSIONS };
