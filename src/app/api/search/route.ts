import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-middleware";
import { successResponse } from "@/lib/api-response";

export const GET = withAuth(
  async ({ request }) => {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim();
    if (!q || q.length < 2) {
      return successResponse({ results: [] });
    }

    const [suppliers, customers, produce, purchases, sales] = await Promise.all([
      prisma.supplier.findMany({
        where: {
          deletedAt: null,
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { code: { contains: q, mode: "insensitive" } },
          ],
        },
        take: 5,
      }),
      prisma.customer.findMany({
        where: {
          deletedAt: null,
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { code: { contains: q, mode: "insensitive" } },
          ],
        },
        take: 5,
      }),
      prisma.produce.findMany({
        where: {
          deletedAt: null,
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { code: { contains: q, mode: "insensitive" } },
          ],
        },
        take: 5,
      }),
      prisma.purchase.findMany({
        where: { purchaseNumber: { contains: q, mode: "insensitive" } },
        take: 5,
        include: { supplier: true },
      }),
      prisma.sale.findMany({
        where: { saleNumber: { contains: q, mode: "insensitive" } },
        take: 5,
        include: { customer: true },
      }),
    ]);

    return successResponse({
      results: [
        ...suppliers.map((s) => ({ type: "supplier", id: s.id, label: `${s.code} — ${s.name}`, href: `/suppliers?search=${encodeURIComponent(s.code)}` })),
        ...customers.map((c) => ({ type: "customer", id: c.id, label: `${c.code} — ${c.name}`, href: `/customers?search=${encodeURIComponent(c.code)}` })),
        ...produce.map((p) => ({ type: "produce", id: p.id, label: `${p.code} — ${p.name}`, href: `/produce?search=${encodeURIComponent(p.code)}` })),
        ...purchases.map((p) => ({ type: "purchase", id: p.id, label: p.purchaseNumber, href: `/purchases?search=${encodeURIComponent(p.purchaseNumber)}` })),
        ...sales.map((s) => ({ type: "sale", id: s.id, label: s.saleNumber, href: `/local-sales?search=${encodeURIComponent(s.saleNumber)}` })),
      ],
    });
  },
  { module: "dashboard", action: "read" }
);
