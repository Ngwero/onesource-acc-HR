import { NextRequest } from "next/server";
import { validateApiKey } from "@/services/webhook.service";
import { requireScope } from "@/lib/api-key";
import { unauthorizedResponse, forbiddenResponse } from "@/lib/api-response";

export { requireScope } from "@/lib/api-key";

export async function getApiKeyFromRequest(request: NextRequest) {
  const header = request.headers.get("authorization");
  const rawKey =
    header?.startsWith("Bearer ") ? header.slice(7) :
    request.headers.get("x-api-key") ||
    null;

  if (!rawKey) return null;
  return validateApiKey(rawKey);
}

export async function withApiKeyAuth(
  request: NextRequest,
  requiredScope: string,
  handler: (key: { id: string; name: string; scopes: string[] }) => Promise<Response>
) {
  const key = await getApiKeyFromRequest(request);
  if (!key) return unauthorizedResponse("Invalid or missing API key");
  if (!requireScope(key.scopes, requiredScope)) {
    return forbiddenResponse(`API key missing scope: ${requiredScope}`);
  }
  return handler({ id: key.id, name: key.name, scopes: key.scopes });
}
