import { createHash, randomBytes } from "crypto";

export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

export function generateApiKey(): { rawKey: string; prefix: string; hash: string } {
  const rawKey = `ab_${randomBytes(24).toString("hex")}`;
  const prefix = rawKey.slice(0, 12);
  const hash = hashApiKey(rawKey);
  return { rawKey, prefix, hash };
}

export function requireScope(scopes: string[], required: string) {
  if (scopes.includes("*") || scopes.includes(required)) return true;
  const [action] = required.split(":");
  return scopes.includes(`${action}:*`);
}
