import { prisma } from "@/lib/prisma";
import { withAuth, parsePagination } from "@/lib/api-middleware";
import { successResponse } from "@/lib/api-response";
import { evaluateCreditLimit } from "@/lib/credit-limit";

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

    const creditSaleIds = items
      .filter((i) => i.requestType === "CREDIT_SALE" && i.recordModule === "local_sales")
      .map((i) => i.recordId);

    const sales =
      creditSaleIds.length > 0
        ? await prisma.sale.findMany({
            where: { id: { in: creditSaleIds } },
            include: {
              customer: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                  balance: true,
                  creditLimit: true,
                },
              },
            },
          })
        : [];

    const saleById = new Map(sales.map((s) => [s.id, s]));

    const enriched = items.map((item) => {
      if (item.requestType !== "CREDIT_SALE" || item.recordModule !== "local_sales") {
        return { ...item, context: null };
      }

      const sale = saleById.get(item.recordId);
      if (!sale?.customer) {
        return { ...item, context: null };
      }

      const balance = Number(sale.customer.balance) || 0;
      const creditLimit = Number(sale.customer.creditLimit) || 0;
      const amount = Number(sale.totalAmount) || 0;
      const credit = evaluateCreditLimit({
        balance,
        creditLimit,
        additionalAmount: amount,
      });

      return {
        ...item,
        context: {
          kind: "CREDIT_SALE" as const,
          saleId: sale.id,
          saleNumber: sale.saleNumber,
          saleStatus: sale.status,
          customerId: sale.customer.id,
          customerName: sale.customer.name,
          customerCode: sale.customer.code,
          credit,
        },
      };
    });

    return successResponse({
      items: enriched,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  },
  { module: "approvals", action: "read" }
);
