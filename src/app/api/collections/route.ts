import { prisma } from "@/lib/prisma";
import { withAuth, parsePagination } from "@/lib/api-middleware";
import { successResponse, errorResponse } from "@/lib/api-response";
import { createAuditLog } from "@/services/audit.service";
import type { Prisma, ReceivableStatus } from "@/generated/prisma/client";
import { z } from "zod";

const followUpSchema = z.object({
  receivableId: z.string().min(1),
  note: z.string().min(1).max(2000),
  channel: z.enum(["PHONE", "EMAIL", "VISIT", "WHATSAPP", "OTHER"]).default("PHONE"),
  nextFollowUpAt: z.string().datetime().optional().nullable(),
});

const OPEN_STATUSES: ReceivableStatus[] = ["UNPAID", "PARTIALLY_PAID", "OVERDUE"];

export const GET = withAuth(
  async ({ request }) => {
    const { searchParams } = new URL(request.url);
    const { page, limit, skip } = parsePagination(searchParams);
    const filter = searchParams.get("filter") || "overdue";

    const now = new Date();
    let where: Prisma.ReceivableWhereInput = {
      status: { in: OPEN_STATUSES },
      balance: { gt: 0 },
      OR: [{ status: "OVERDUE" }, { dueDate: { lt: now } }],
    };

    if (filter === "due_soon") {
      where = {
        status: { in: OPEN_STATUSES },
        balance: { gt: 0 },
        dueDate: {
          gte: now,
          lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        },
      };
    } else if (filter === "follow_up") {
      where = {
        status: { in: OPEN_STATUSES },
        balance: { gt: 0 },
        collectionFollowUps: {
          some: { nextFollowUpAt: { lte: now } },
        },
      };
    }

    const [items, total] = await Promise.all([
      prisma.receivable.findMany({
        where,
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              code: true,
              phone: true,
              email: true,
              balance: true,
              creditLimit: true,
            },
          },
          collectionFollowUps: {
            orderBy: { createdAt: "desc" },
            take: 5,
            include: { createdBy: { select: { fullName: true } } },
          },
        },
        skip,
        take: limit,
        orderBy: { dueDate: "asc" },
      }),
      prisma.receivable.count({ where }),
    ]);

    const enriched = items.map((item) => {
      const daysOverdue = Math.max(
        0,
        Math.floor((now.getTime() - new Date(item.dueDate).getTime()) / (1000 * 60 * 60 * 24))
      );
      return { ...item, daysOverdue };
    });

    return successResponse({
      items: enriched,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  },
  { module: "receivables", action: "read" }
);

export const POST = withAuth(
  async ({ user, request }) => {
    const body = await request.json();
    const parsed = followUpSchema.safeParse(body);
    if (!parsed.success) return errorResponse("Validation failed", parsed.error.issues);

    const receivable = await prisma.receivable.findUnique({
      where: { id: parsed.data.receivableId },
      include: { customer: { select: { name: true } } },
    });
    if (!receivable) return errorResponse("Receivable not found", [], 404);

    const followUp = await prisma.collectionFollowUp.create({
      data: {
        receivableId: parsed.data.receivableId,
        note: parsed.data.note,
        channel: parsed.data.channel,
        nextFollowUpAt: parsed.data.nextFollowUpAt
          ? new Date(parsed.data.nextFollowUpAt)
          : null,
        createdById: user.id,
      },
      include: { createdBy: { select: { fullName: true } } },
    });

    await createAuditLog({
      userId: user.id,
      action: "CREATE",
      module: "receivables",
      recordId: followUp.id,
      newValue: {
        receivableId: receivable.id,
        customer: receivable.customer.name,
        note: followUp.note,
        channel: followUp.channel,
      },
    });

    return successResponse(followUp, "Follow-up logged", 201);
  },
  { module: "receivables", action: "update" }
);
