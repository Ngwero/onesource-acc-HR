import { prisma } from "@/lib/prisma";
import { withAuth, parsePagination } from "@/lib/api-middleware";
import { successResponse } from "@/lib/api-response";

export const GET = withAuth(
  async ({ request }) => {
    const { searchParams } = new URL(request.url);
    const { page, limit, skip } = parsePagination(searchParams);
    const rawStatus = searchParams.get("status")?.split("?")[0] || "PENDING";
    const status = (["PENDING", "APPROVED", "REJECTED"] as const).includes(
      rawStatus as "PENDING" | "APPROVED" | "REJECTED"
    )
      ? (rawStatus as "PENDING" | "APPROVED" | "REJECTED")
      : "PENDING";

    const [items, total] = await Promise.all([
      prisma.approvalRequest.findMany({
        where: { status },
        include: {
          requestedBy: { select: { fullName: true, email: true } },
          approver: { select: { fullName: true } },
        },
        skip,
        take: limit,
        orderBy: { requestDate: "desc" },
      }),
      prisma.approvalRequest.count({ where: { status } }),
    ]);

    return successResponse({ items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  },
  { module: "approvals", action: "read" }
);
