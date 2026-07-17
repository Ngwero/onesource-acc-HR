import { withAuth } from "@/lib/api-middleware";
import { successResponse } from "@/lib/api-response";

export const GET = withAuth(async ({ user }) => {
  return successResponse({ user });
});
