import { NextResponse } from "next/server";

export function successResponse<T>(data: T, message = "Success", status = 200) {
  return NextResponse.json({ success: true, message, data }, { status });
}

export function errorResponse(
  message: string,
  errors: unknown[] = [],
  status = 400
) {
  return NextResponse.json({ success: false, message, errors }, { status });
}

export function unauthorizedResponse(message = "Unauthorized") {
  return errorResponse(message, [], 401);
}

export function forbiddenResponse(message = "Forbidden") {
  return errorResponse(message, [], 403);
}

export function notFoundResponse(message = "Not found") {
  return errorResponse(message, [], 404);
}

export function serverErrorResponse(message = "Internal server error") {
  return errorResponse(message, [], 500);
}
