import { prisma } from "@/lib/prisma";
import { withAuth, parsePagination } from "@/lib/api-middleware";
import { successResponse, errorResponse } from "@/lib/api-response";
import { expenseSchema } from "@/lib/validations";
import { generateDocumentNumber } from "@/lib/utils";
import { createAuditLog } from "@/services/audit.service";
import { postExpenseJournal } from "@/services/accounting.service";

const EXPENSE_ACCOUNT_MAP: Record<string, string> = {
  TRANSPORT: "5200",
  FUEL: "5210",
  PACKAGING: "5220",
  LABOUR: "5230",
  WAREHOUSE: "5240",
  COLD_STORAGE: "5250",
  CERTIFICATION: "5260",
  INSPECTION: "5270",
  INSURANCE: "5280",
  MARKETING: "5290",
  OFFICE: "5300",
  BANK: "5320",
  MISC: "5900",
};

export const GET = withAuth(
  async ({ request }) => {
    const { searchParams } = new URL(request.url);
    const { page, limit, skip, sortBy, sortOrder } = parsePagination(searchParams);
    const status = searchParams.get("status");

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      prisma.expense.findMany({
        where,
        include: { category: true, supplier: true, createdBy: { select: { fullName: true } } },
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.expense.count({ where }),
    ]);

    return successResponse({ items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  },
  { module: "expenses", action: "read" }
);

export const POST = withAuth(
  async ({ user, request }) => {
    const body = await request.json();
    const parsed = expenseSchema.safeParse(body);
    if (!parsed.success) return errorResponse("Validation failed", parsed.error.issues);

    const expenseNumber = await generateDocumentNumber("EXP", prisma);
    const rate = parsed.data.exchangeRate || 1;
    const ugxEquivalent = parsed.data.amount * rate;

    const expense = await prisma.expense.create({
      data: {
        expenseNumber,
        categoryId: parsed.data.categoryId,
        supplierId: parsed.data.supplierId,
        date: parsed.data.date ? new Date(parsed.data.date) : new Date(),
        amount: parsed.data.amount,
        currency: parsed.data.currency || "UGX",
        exchangeRate: rate,
        ugxEquivalent,
        paymentMethod: parsed.data.paymentMethod || "BANK_TRANSFER",
        produceId: parsed.data.produceId,
        shipmentId: parsed.data.shipmentId,
        department: parsed.data.department,
        description: parsed.data.description,
        createdById: user.id,
      },
      include: { category: true },
    });

    await createAuditLog({ userId: user.id, action: "CREATE", module: "expenses", recordId: expense.id, newValue: expense });
    return successResponse(expense, "Expense created", 201);
  },
  { module: "expenses", action: "create" }
);
