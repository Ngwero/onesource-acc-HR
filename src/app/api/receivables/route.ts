import { prisma } from "@/lib/prisma";
import { withAuth, parsePagination } from "@/lib/api-middleware";
import { successResponse } from "@/lib/api-response";

export const GET = withAuth(
  async ({ request }) => {
    const { searchParams } = new URL(request.url);
    const { page, limit, skip } = parsePagination(searchParams);
    const type = searchParams.get("type");

    const where: Record<string, unknown> = {};
    if (type === "export") where.currency = { not: "UGX" };
    if (type === "local") where.currency = "UGX";

    const [items, total, aging] = await Promise.all([
      prisma.receivable.findMany({
        where,
        include: { customer: true },
        skip,
        take: limit,
        orderBy: { dueDate: "asc" },
      }),
      prisma.receivable.count({ where }),
      getReceivableAging(),
    ]);

    return successResponse({ items, aging, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  },
  { module: "receivables", action: "read" }
);

async function getReceivableAging() {
  const now = new Date();
  const receivables = await prisma.receivable.findMany({
    where: { status: { in: ["UNPAID", "PARTIALLY_PAID", "OVERDUE"] } },
  });

  const aging = { current: 0, days30: 0, days60: 0, days90: 0, over90: 0 };
  for (const r of receivables) {
    const balance = Number(r.balance);
    const days = Math.floor((now.getTime() - new Date(r.dueDate).getTime()) / (1000 * 60 * 60 * 24));
    if (days <= 0) aging.current += balance;
    else if (days <= 30) aging.days30 += balance;
    else if (days <= 60) aging.days60 += balance;
    else if (days <= 90) aging.days90 += balance;
    else aging.over90 += balance;
  }
  return aging;
}
