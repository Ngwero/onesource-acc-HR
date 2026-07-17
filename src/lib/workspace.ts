export const WORKSPACE_COOKIE = "onesource_workspace";
export type Workspace = "accounting" | "hr";

/** UI routes that belong to the HR system (not Accounting). */
export const HR_PATH_PREFIXES = [
  "/hr",
  "/employees",
  "/leave",
  "/attendance",
  "/payroll",
] as const;

export function isHrPath(pathname: string): boolean {
  return HR_PATH_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

export function isWorkspace(value: string | undefined | null): value is Workspace {
  return value === "accounting" || value === "hr";
}

export const WORKSPACE_HOME: Record<Workspace, string> = {
  accounting: "/dashboard",
  hr: "/hr",
};
