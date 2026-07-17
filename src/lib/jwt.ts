import { SignJWT, jwtVerify } from "jose";

export const JWT_SECRET = process.env.JWT_SECRET || "agribooks-dev-secret-change-in-production";
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
export const COOKIE_NAME = "agribooks_token";

const secret = new TextEncoder().encode(JWT_SECRET);

export interface TokenPayload {
  id: string;
  email: string;
  fullName: string;
  role: string;
  iat?: number;
  exp?: number;
}

export async function signToken(user: Omit<TokenPayload, "iat" | "exp">): Promise<string> {
  return new SignJWT({
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRES_IN)
    .sign(secret);
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as TokenPayload;
  } catch {
    return null;
  }
}