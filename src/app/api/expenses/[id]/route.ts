import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-middleware";
import { successResponse, errorResponse, notFoundResponse } from "@/lib/api-response";
import { postExpenseJournal } from "@/services/accounting.service";
import { createAuditLog } from "@/services/audit.service";

const EXPENSE_ACCOUNT_MAP: Record<string, string> = {
  TRANSPORT: "5200", FUEL: "5210", PACKAGING: "5220", LABOUR: "5230",
  WAREHOUSE: "5240", COLD_STORAGE: "5250", CERTIFICATION: "5260",
  INSPECTION: "5270", INSURANCE: "5280", MARKETING: "5290", OFFICE: "5300",   BANK: "5320", MISC: "5900",
};

export const PATCH = withAuth(
  async ({ user, request }, _req, params) => {
    const body = await request.json();
    const expense = await prisma.expense.findUnique({
      where: { id: params!.id },
      include: { category: true },
    });
    if (!expense) return notFoundResponse("Expense not found");

    if (body.action === "approve") {
      if (expense.status !== "DRAFT" && expense.status !== "SUBMITTED") {
        return errorResponse("Only draft expenses can be approved");
      }
      const accountCode = EXPENSE_ACCOUNT_MAP[expense.category.code] || "5900";
      const updated = await prisma.expense.update({
        where: { id: params!.id },
        data: { status: "APPROVED", approvedById: user.id, approvedAt: new Date() },
        include: { category: true },
      });
      await postExpenseJournal(Number(expense.ugxEquivalent), accountCode, false, user.id, expense.expenseNumber);
      await createAuditLog({ userId: user.id, action: "APPROVE", module: "expenses", recordId: expense.id, newValue: updated });
      return successResponse(updated, "Expense approved and posted to ledger");
    }

    if (body.action === "reject") {
      const updated = await prisma.expense.update({
        where: { id: params!.id },
        data: { status: "REJECTED", approvedById: user.id, approvedAt: new Date() },
      });
      return successResponse(updated, "Expense rejected");
    }

    return errorResponse("Unknown action");
  },
  { module: "expenses", action: "update" }
);
