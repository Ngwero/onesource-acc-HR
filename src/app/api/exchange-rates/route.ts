import { withAuth } from "@/lib/api-middleware";
import { successResponse, errorResponse } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

export const GET = withAuth(
  async () => {
    const rates = await prisma.exchangeRate.findMany({
      include: { currency: true },
      orderBy: { effectiveDate: "desc" },
      take: 100,
    });
    const currencies = await prisma.currency.findMany({ where: { isActive: true } });
    return successResponse({ rates, currencies });
  },
  { module: "settings", action: "read" }
);

export const POST = withAuth(
  async ({ user, request }) => {
    const body = await request.json();
    const currency = await prisma.currency.findUnique({ where: { id: body.currencyId } });
    if (!currency) return errorResponse("Currency not found");

    const rate = await prisma.exchangeRate.create({
      data: {
        currencyId: body.currencyId,
        rate: body.rate,
        effectiveDate: body.effectiveDate ? new Date(body.effectiveDate) : new Date(),
        createdBy: user.id,
      },
      include: { currency: true },
    });
    return successResponse(rate, "Exchange rate added", 201);
  },
  { module: "settings", action: "create" }
);
