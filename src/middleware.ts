import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken, COOKIE_NAME } from "@/lib/jwt";
import {
  WORKSPACE_COOKIE,
  isHrPath,
  isWorkspace,
  WORKSPACE_HOME,
} from "@/lib/workspace";

const publicPaths = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/forgot-password",
  "/api/auth/verify-otp",
  "/api/auth/verify-login-otp",
  "/api/auth/reset-password",
  "/api/cron",
  "/api/v1",
  "/api/openapi",
];

/** Shared routes allowed in either Accounting or HR workspace. */
function isSharedAppPath(pathname: string) {
  return (
    pathname === "/apps" ||
    pathname === "/notifications" ||
    pathname.startsWith("/notifications/")
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    publicPaths.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    // Logged-in users hitting login go to system picker
    if (pathname === "/login" || pathname.startsWith("/login/")) {
      const token = request.cookies.get(COOKIE_NAME)?.value;
      if (token && (await verifyToken(token))) {
        return NextResponse.redirect(new URL("/apps", request.url));
      }
    }
    return NextResponse.next();
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token || !(await verifyToken(token))) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // API routes: auth only (workspace is a UI concern)
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const rawWorkspace = request.cookies.get(WORKSPACE_COOKIE)?.value;
  const workspace = isWorkspace(rawWorkspace) ? rawWorkspace : null;

  if (pathname === "/apps" || pathname.startsWith("/apps/")) {
    return NextResponse.next();
  }

  if (!workspace) {
    return NextResponse.redirect(new URL("/apps", request.url));
  }

  if (isSharedAppPath(pathname)) {
    return NextResponse.next();
  }

  const onHr = isHrPath(pathname);

  if (workspace === "hr" && !onHr) {
    return NextResponse.redirect(new URL(WORKSPACE_HOME.hr, request.url));
  }

  if (workspace === "accounting" && onHr) {
    return NextResponse.redirect(new URL(WORKSPACE_HOME.accounting, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:png|svg|jpg|jpeg|gif|webp|ico)$).*)"],
};
