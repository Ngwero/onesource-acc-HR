import { createHmac } from "crypto";
import { prisma } from "@/lib/prisma";
import { generateApiKey, hashApiKey } from "@/lib/api-key";

export { generateApiKey, hashApiKey } from "@/lib/api-key";

export const WEBHOOK_EVENTS = [
  "PAYMENT_POSTED",
  "INVOICE_CREATED",
  "OVERDUE_INVOICE",
  "SCHEDULED_JOBS_COMPLETED",
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export async function createApiKey(data: { name: string; scopes: string[]; createdById: string }) {
  const { rawKey, prefix, hash } = generateApiKey();
  const record = await prisma.apiKey.create({
    data: {
      name: data.name,
      keyPrefix: prefix,
      keyHash: hash,
      scopes: data.scopes,
      createdById: data.createdById,
    },
  });
  return { ...record, rawKey };
}

export async function validateApiKey(rawKey: string) {
  const hash = hashApiKey(rawKey);
  const key = await prisma.apiKey.findFirst({
    where: { keyHash: hash, isActive: true },
  });
  if (!key) return null;

  await prisma.apiKey.update({
    where: { id: key.id },
    data: { lastUsedAt: new Date() },
  });

  return key;
}

export async function dispatchWebhooks(event: WebhookEvent, payload: unknown) {
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { isActive: true, events: { has: event } },
  });

  const body = JSON.stringify({
    event,
    timestamp: new Date().toISOString(),
    data: payload,
  });

  const results = [];

  for (const endpoint of endpoints) {
    const signature = createHmac("sha256", endpoint.secret).update(body).digest("hex");
    let statusCode: number | null = null;
    let success = false;
    let error: string | undefined;

    try {
      const res = await fetch(endpoint.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-AgriBooks-Event": event,
          "X-AgriBooks-Signature": signature,
        },
        body,
        signal: AbortSignal.timeout(10000),
      });
      statusCode = res.status;
      success = res.ok;
      if (!res.ok) error = await res.text().catch(() => `HTTP ${res.status}`);
    } catch (err) {
      error = err instanceof Error ? err.message : "Webhook delivery failed";
    }

    await prisma.webhookDelivery.create({
      data: {
        endpointId: endpoint.id,
        event,
        payload: payload as object,
        statusCode,
        success,
        error,
      },
    });

    results.push({ endpointId: endpoint.id, name: endpoint.name, success, statusCode, error });
  }

  return results;
}
