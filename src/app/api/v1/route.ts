import { NextRequest } from "next/server";
import { withApiKeyAuth } from "@/lib/api-key-auth";
import { successResponse } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const resource = searchParams.get("resource") || "invoices";

  return withApiKeyAuth(request, `read:${resource}`, async () => {
    switch (resource) {
      case "invoices": {
        const items = await prisma.invoice.findMany({
          include: { customer: { select: { name: true, code: true } } },
          orderBy: { date: "desc" },
          take: 100,
        });
        return successResponse(items);
      }
      case "payables": {
        const items = await prisma.payable.findMany({
          include: { supplier: { select: { name: true, code: true } } },
          orderBy: { dueDate: "asc" },
          take: 100,
        });
        return successResponse(items);
      }
      case "receivables": {
        const items = await prisma.receivable.findMany({
          include: { customer: { select: { name: true, code: true } } },
          orderBy: { dueDate: "asc" },
          take: 100,
        });
        return successResponse(items);
      }
      case "payments": {
        const items = await prisma.payment.findMany({
          include: {
            allocations: true,
            payable: { select: { payableNumber: true } },
            receivable: { select: { receivableNumber: true } },
          },
          orderBy: { date: "desc" },
          take: 100,
        });
        return successResponse(items);
      }
      default:
        return successResponse({
          resources: ["invoices", "payables", "receivables", "payments"],
          usage: "GET /api/v1?resource=invoices with Authorization: Bearer ab_...",
        });
    }
  });
}
