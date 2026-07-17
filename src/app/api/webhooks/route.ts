import { randomBytes } from "crypto";
import { withAuth } from "@/lib/api-middleware";
import { successResponse, errorResponse } from "@/lib/api-response";
import { createApiKey, WEBHOOK_EVENTS } from "@/services/webhook.service";
import { prisma } from "@/lib/prisma";

export const GET = withAuth(
  async ({ request }) => {
    const { searchParams } = new URL(request.url);
    const view = searchParams.get("view");

    if (view === "events") {
      return successResponse(WEBHOOK_EVENTS);
    }

    if (view === "deliveries") {
      const deliveries = await prisma.webhookDelivery.findMany({
        include: { endpoint: { select: { name: true, url: true } } },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      return successResponse(deliveries);
    }

    const [keys, endpoints] = await Promise.all([
      prisma.apiKey.findMany({
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          keyPrefix: true,
          scopes: true,
          isActive: true,
          lastUsedAt: true,
          createdAt: true,
        },
      }),
      prisma.webhookEndpoint.findMany({ orderBy: { createdAt: "desc" } }),
    ]);

    return successResponse({ apiKeys: keys, webhooks: endpoints });
  },
  { module: "settings", action: "read" }
);

export const POST = withAuth(
  async ({ user, request }) => {
    const body = await request.json();

    switch (body.action) {
      case "create-api-key": {
        const created = await createApiKey({
          name: body.name,
          scopes: body.scopes || ["read:*"],
          createdById: user.id,
        });
        return successResponse(
          {
            id: created.id,
            name: created.name,
            keyPrefix: created.keyPrefix,
            scopes: created.scopes,
            rawKey: created.rawKey,
          },
          "API key created — copy the raw key now; it won't be shown again",
          201
        );
      }
      case "create-webhook": {
        const secret = body.secret || randomBytes(16).toString("hex");
        const endpoint = await prisma.webhookEndpoint.create({
          data: {
            name: body.name,
            url: body.url,
            secret,
            events: body.events || ["PAYMENT_POSTED"],
            createdById: user.id,
          },
        });
        return successResponse({ ...endpoint, secret }, "Webhook endpoint created", 201);
      }
      case "deactivate-api-key": {
        await prisma.apiKey.update({
          where: { id: body.id },
          data: { isActive: false },
        });
        return successResponse(null, "API key deactivated");
      }
      case "deactivate-webhook": {
        await prisma.webhookEndpoint.update({
          where: { id: body.id },
          data: { isActive: false },
        });
        return successResponse(null, "Webhook deactivated");
      }
      default:
        return errorResponse("Unknown action");
    }
  },
  { module: "settings", action: "update" }
);
