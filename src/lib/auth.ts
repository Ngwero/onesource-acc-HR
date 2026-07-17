import { hashPassword, verifyPassword } from "./password";
import { cookies } from "next/headers";
import { prisma } from "./prisma";
import { signToken, verifyToken, COOKIE_NAME, JWT_SECRET } from "./jwt";
import type { UserRole } from "@/generated/prisma/client";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
}

export interface TokenPayload extends AuthUser {
  iat?: number;
  exp?: number;
}

export { hashPassword, verifyPassword, COOKIE_NAME, JWT_SECRET };

export async function createAuthToken(user: AuthUser): Promise<string> {
  return signToken(user);
}

export async function setAuthCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
}

export async function clearAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
}

export async function getAuthUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload) return null;

  const user = await prisma.user.findFirst({
    where: { id: payload.id, status: "ACTIVE", deletedAt: null },
    select: { id: true, email: true, fullName: true, role: true },
  });

  return user;
}

export async function getTokenFromRequest(request: Request): Promise<string | null> {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  const cookieHeader = request.headers.get("cookie");
  if (cookieHeader) {
    const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
    if (match) return match[1];
  }
  return null;
}

export async function getAuthUserFromRequest(
  request: Request
): Promise<AuthUser | null> {
  const token = await getTokenFromRequest(request);
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;
  const user = await prisma.user.findFirst({
    where: { id: payload.id, status: "ACTIVE", deletedAt: null },
    select: { id: true, email: true, fullName: true, role: true },
  });
  return user;
}
