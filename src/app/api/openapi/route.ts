import { successResponse } from "@/lib/api-response";
import { WEBHOOK_EVENTS } from "@/services/webhook.service";

export async function GET() {
  return successResponse({
    openapi: "3.0.3",
    info: {
      title: "OneSource Accounting Partner API",
      version: "1.0.0",
      description: "Read-only partner API authenticated with API keys (Bearer ab_...)",
    },
    servers: [{ url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001" }],
    paths: {
      "/api/v1": {
        get: {
          summary: "List partner resources",
          parameters: [
            {
              name: "resource",
              in: "query",
              schema: { enum: ["invoices", "payables", "receivables", "payments"] },
            },
          ],
          security: [{ ApiKeyAuth: [] }],
        },
      },
      "/api/cron": {
        post: {
          summary: "Run scheduled jobs (cron secret)",
          security: [{ CronSecret: [] }],
        },
      },
    },
    components: {
      securitySchemes: {
        ApiKeyAuth: { type: "http", scheme: "bearer", description: "API key prefixed with ab_" },
        CronSecret: { type: "http", scheme: "bearer", description: "CRON_SECRET env value" },
      },
    },
    "x-webhook-events": WEBHOOK_EVENTS,
  });
}
