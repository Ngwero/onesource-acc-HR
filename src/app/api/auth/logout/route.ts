import { NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/jwt";
import { WORKSPACE_COOKIE } from "@/lib/workspace";
import { absoluteUrl } from "@/lib/request-origin";

function clearCookie(response: NextResponse, name: string) {
  response.cookies.set(name, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
}

function logoutRedirect(request: Request) {
  const response = NextResponse.redirect(absoluteUrl(request, "/login"), 303);
  clearCookie(response, COOKIE_NAME);
  clearCookie(response, WORKSPACE_COOKIE);
  return response;
}

export async function POST(request: Request) {
  return logoutRedirect(request);
}

export async function GET(request: Request) {
  return logoutRedirect(request);
}
