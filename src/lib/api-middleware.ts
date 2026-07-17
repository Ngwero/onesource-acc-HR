import { NextRequest } from "next/server";
import { getAuthUserFromRequest } from "@/lib/auth";
import {
  canAccessModule,
  canPerformAction,
  isReadOnly,
  type Module,
  type PermissionAction,
} from "@/lib/permissions";
import { checkDbPermission } from "@/services/permission.service";
import {
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/api-response";
import type { UserRole } from "@/generated/prisma/client";

export interface ApiContext {
  user: {
    id: string;
    email: string;
    fullName: string;
    role: UserRole;
  };
  request: NextRequest;
}

type RouteHandler = (
  ctx: ApiContext,
  request: NextRequest,
  params?: Record<string, string>
) => Promise<Response>;

export function withAuth(
  handler: RouteHandler,
  options?: { module?: Module; action?: PermissionAction }
) {
  return async (
    request: NextRequest,
    context?: { params?: Promise<Record<string, string>> }
  ) => {
    const user = await getAuthUserFromRequest(request);
    if (!user) return unauthorizedResponse();

    // Super Admin always has full access (avoids stale DB permission rows blocking user mgmt)
    if (user.role !== "SUPER_ADMIN" && options?.module) {
      const dbAccess = await checkDbPermission(user.role, options.module, "read");
      const hasAccess = dbAccess ?? canAccessModule(user.role, options.module);
      if (!hasAccess) {
        return forbiddenResponse("You do not have access to this module");
      }
      if (options.action) {
        const dbAction = await checkDbPermission(user.role, options.module, options.action);
        const allowed = dbAction ?? canPerformAction(user.role, options.module, options.action);
        if (!allowed) {
          return forbiddenResponse(`You cannot ${options.action} in this module`);
        }
      } else if (isReadOnly(user.role) && request.method !== "GET") {
        return forbiddenResponse("Read-only access");
      }
    }

    const params = context?.params ? await context.params : undefined;
    return handler({ user, request }, request, params);
  };
}

export function getClientInfo(request: NextRequest) {
  return {
    ipAddress:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown",
    userAgent: request.headers.get("user-agent") || "unknown",
  };
}

export function parsePagination(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
  const skip = (page - 1) * limit;
  const search = searchParams.get("search") || "";
  const sortBy = searchParams.get("sortBy") || "createdAt";
  const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";
  return { page, limit, skip, search, sortBy, sortOrder };
}

export function parseDateRange(searchParams: URLSearchParams) {
  const from = searchParams.get("from") || searchParams.get("startDate");
  const to = searchParams.get("to") || searchParams.get("endDate");
  const filter = searchParams.get("filter");

  const now = new Date();
  let startDate: Date | undefined;
  let endDate: Date | undefined = now;

  if (from) startDate = new Date(from);
  if (to) endDate = new Date(to);

  if (!from && filter) {
    switch (filter) {
      case "today":
        startDate = new Date(now.setHours(0, 0, 0, 0));
        break;
      case "week":
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        break;
      case "month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "quarter":
        startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        break;
      case "year":
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
    }
  }

  return { startDate, endDate };
}
