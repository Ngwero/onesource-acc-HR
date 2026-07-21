import { withAuth } from "@/lib/api-middleware";
import { successResponse } from "@/lib/api-response";
import { createAuthToken, setAuthCookie } from "@/lib/auth";
import { getSessionIdleMinutes } from "@/lib/session-idle";

export const POST = withAuth(
  async ({ user }) => {
    const token = await createAuthToken(user);
    await setAuthCookie(token);
    return successResponse({
      refreshed: true,
      sessionIdleMinutes: await getSessionIdleMinutes(),
    });
  },
  { module: "dashboard", action: "read" }
);

export const GET = withAuth(
  async () => {
    return successResponse({
      sessionIdleMinutes: await getSessionIdleMinutes(),
    });
  },
  { module: "dashboard", action: "read" }
);
