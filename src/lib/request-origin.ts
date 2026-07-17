import type { NextRequest } from "next/server";

/**
 * Resolve the public site origin behind Railway/Vercel proxies.
 * `request.url` is often an internal host (e.g. https://localhost:8080).
 */
export function getRequestOrigin(request: Request | NextRequest): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (envUrl && !/localhost|127\.0\.0\.1/i.test(envUrl)) {
    return envUrl;
  }

  const headers =
    "headers" in request && typeof request.headers?.get === "function"
      ? request.headers
      : new Headers();

  const forwardedHost = headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || headers.get("host")?.split(",")[0]?.trim();
  const forwardedProto = headers.get("x-forwarded-proto")?.split(",")[0]?.trim();

  if (host && !/^localhost(:\d+)?$/i.test(host) && host !== "127.0.0.1") {
    const proto =
      forwardedProto ||
      (host.includes("localhost") ? "http" : "https");
    return `${proto}://${host}`;
  }

  try {
    return new URL(request.url).origin;
  } catch {
    return envUrl || "http://localhost:3001";
  }
}

export function absoluteUrl(request: Request | NextRequest, path: string): URL {
  const base = getRequestOrigin(request);
  return new URL(path.startsWith("/") ? path : `/${path}`, base);
}
