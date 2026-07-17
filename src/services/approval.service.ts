import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import type { ApprovalRequest } from "@/generated/prisma/client";
import { confirmSale } from "./sale.service";
import { confirmPurchase } from "./purchase.service";
import { postDraftJournal, postExpenseJournal } from "./accounting.service";
import { createAuditLog } from "./audit.service";
import { sendPasswordResetEmail } from "./email.service";

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

export async function executeApprovedRequest(approval: ApprovalRequest, approverId: string) {
  const { requestType, recordModule, recordId } = approval;

  switch (requestType) {
    case "CREDIT_SALE":
      if (recordModule === "local_sales") {
        return confirmSale(recordId, approverId);
      }
      break;

    case "LARGE_PURCHASE":
      if (recordModule === "purchases") {
        return confirmPurchase(recordId, approverId);
      }
      break;

    case "EXPENSE": {
      const expense = await prisma.expense.findUnique({
        where: { id: recordId },
        include: { category: true },
      });
      if (!expense) throw new Error("Expense not found");
      if (expense.status !== "DRAFT" && expense.status !== "SUBMITTED") {
        throw new Error("Expense is not pending approval");
      }
      const accountCode = EXPENSE_ACCOUNT_MAP[expense.category.code] || "5900";
      await prisma.expense.update({
        where: { id: recordId },
        data: { status: "APPROVED", approvedById: approverId, approvedAt: new Date() },
      });
      await postExpenseJournal(
        Number(expense.ugxEquivalent),
        accountCode,
        false,
        approverId,
        expense.expenseNumber
      );
      await createAuditLog({
        userId: approverId,
        action: "APPROVE",
        module: "expenses",
        recordId,
        newValue: { viaApproval: approval.id },
      });
      return expense;
    }

    case "MANUAL_JOURNAL":
      if (recordModule === "ledger") {
        return postDraftJournal(recordId, approverId);
      }
      break;

    case "PASSWORD_RESET": {
      const target = await prisma.user.findFirst({
        where: { id: recordId, deletedAt: null },
      });
      if (!target) throw new Error("User not found for password reset");

      const token = crypto.randomBytes(32).toString("hex");
      const expiry = new Date(Date.now() + 60 * 60 * 1000);
      await prisma.user.update({
        where: { id: target.id },
        data: {
          resetToken: token,
          resetTokenExpiry: expiry,
          otpCode: null,
          otpExpiry: null,
        },
      });

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3002";
      const resetUrl = `${baseUrl}/reset-password?token=${token}`;
      await sendPasswordResetEmail(target.email, resetUrl);

      await createAuditLog({
        userId: approverId,
        action: "APPROVE",
        module: "users",
        recordId: target.id,
        newValue: { viaApproval: approval.id, action: "password-reset-link-sent" },
      });

      return { email: target.email, resetLinkSent: true };
    }

    default:
      return null;
  }

  return null;
}
