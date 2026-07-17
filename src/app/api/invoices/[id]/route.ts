import { withAuth } from "@/lib/api-middleware";
import { successResponse, errorResponse, notFoundResponse } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { sendInvoiceEmail } from "@/services/email.service";

export const PATCH = withAuth(
  async ({ request }, _req, params) => {
    const id = params?.id;
    if (!id) return errorResponse("Invoice ID required");

    const body = await request.json();
    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) return notFoundResponse("Invoice not found");

    if (body.action === "void") {
      const updated = await prisma.invoice.update({
        where: { id },
        data: {
          balance: 0,
          amountPaid: 0,
          notes: `[VOIDED] ${invoice.notes || ""}`.trim(),
        },
      });
      return successResponse(updated, "Invoice voided");
    }

    if (body.action === "mark-paid") {
      const updated = await prisma.invoice.update({
        where: { id },
        data: { status: "PAID", balance: 0, amountPaid: invoice.total },
      });
      return successResponse(updated, "Invoice marked as paid");
    }

    if (body.action === "email") {
      const result = await sendInvoiceEmail(id);
      return successResponse(result, result.sent ? "Invoice emailed" : "Notification sent (SMTP not configured)");
    }

    return errorResponse("Unknown action");
  },
  { module: "invoices", action: "update" }
);
