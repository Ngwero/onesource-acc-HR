import { prisma } from "@/lib/prisma";
import { withAuth, parsePagination } from "@/lib/api-middleware";
import { successResponse } from "@/lib/api-response";

export const GET = withAuth(
  async ({ request }) => {
    const { searchParams } = new URL(request.url);
    const { page, limit, skip } = parsePagination(searchParams);
    const status = searchParams.get("status");

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const [items, total, aging] = await Promise.all([
      prisma.payable.findMany({
        where,
        include: { supplier: true },
        skip,
        take: limit,
        orderBy: { dueDate: "asc" },
      }),
      prisma.payable.count({ where }),
      getPayableAging(),
    ]);

    return successResponse({ items, aging, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  },
  { module: "payables", action: "read" }
);

async function getPayableAging() {
  const now = new Date();
  const payables = await prisma.payable.findMany({
    where: { status: { in: ["UNPAID", "PARTIALLY_PAID", "OVERDUE"] } },
  });

  const aging = { current: 0, days30: 0, days60: 0, days90: 0, over90: 0 };
  for (const p of payables) {
    const balance = Number(p.balance);
    const days = Math.floor((now.getTime() - new Date(p.dueDate).getTime()) / (1000 * 60 * 60 * 24));
    if (days <= 0) aging.current += balance;
    else if (days <= 30) aging.days30 += balance;
    else if (days <= 60) aging.days60 += balance;
    else if (days <= 90) aging.days90 += balance;
    else aging.over90 += balance;
  }
  return aging;
}
