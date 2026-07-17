import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import {
  WORKSPACE_COOKIE,
  isWorkspace,
  WORKSPACE_HOME,
  type Workspace,
} from "@/lib/workspace";
import { successResponse, errorResponse } from "@/lib/api-response";

function setWorkspaceCookie(response: NextResponse, workspace: Workspace) {
  response.cookies.set(WORKSPACE_COOKIE, workspace, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return errorResponse("Unauthorized", [], 401);

  try {
    const body = await request.json();
    const workspace = typeof body.workspace === "string" ? body.workspace : "";
    if (!isWorkspace(workspace)) {
      return errorResponse("Invalid workspace. Choose accounting or hr.", [], 400);
    }

    const response = successResponse(
      { workspace, home: WORKSPACE_HOME[workspace] },
      "Workspace selected"
    );
    setWorkspaceCookie(response, workspace);
    return response;
  } catch {
    return errorResponse("Failed to set workspace", [], 500);
  }
}

export async function DELETE() {
  const user = await getAuthUser();
  if (!user) return errorResponse("Unauthorized", [], 401);

  const response = successResponse(null, "Workspace cleared");
  response.cookies.set(WORKSPACE_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return response;
}
