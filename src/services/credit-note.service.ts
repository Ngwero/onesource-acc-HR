import { prisma } from "@/lib/prisma";
import { createAuditLog } from "./audit.service";

function receivableStatus(amount: number, balance: number) {
  if (balance <= 0.01) return "PAID" as const;
  if (balance < amount - 0.01) return "PARTIALLY_PAID" as const;
  return "UNPAID" as const;
}

function payableStatus(amount: number, balance: number) {
  if (balance <= 0.01) return "PAID" as const;
  if (balance < amount - 0.01) return "PARTIALLY_PAID" as const;
  return "UNPAID" as const;
}

export async function applyCreditNote(
  creditNoteId: string,
  data: { receivableId?: string; payableId?: string; invoiceId?: string },
  userId: string
) {
  const creditNote = await prisma.creditNote.findUnique({
    where: { id: creditNoteId },
    include: { customer: true, supplier: true },
  });

  if (!creditNote) throw new Error("Credit note not found");
  if (creditNote.status !== "CONFIRMED") throw new Error("Only confirmed credit notes can be applied");

  const remaining = Number(creditNote.total) - Number(creditNote.appliedAmount);
  if (remaining <= 0.01) throw new Error("Credit note is fully applied");

  if (creditNote.type === "SALES") {
    let receivableId = data.receivableId;

    if (data.invoiceId) {
      const invoice = await prisma.invoice.findUnique({ where: { id: data.invoiceId } });
      if (!invoice) throw new Error("Invoice not found");
      if (creditNote.customerId && invoice.customerId !== creditNote.customerId) {
        throw new Error("Invoice customer does not match credit note");
      }

      const receivable = invoice.saleId
        ? await prisma.receivable.findFirst({ where: { saleId: invoice.saleId } })
        : await prisma.receivable.findFirst({
            where: {
              customerId: invoice.customerId,
              invoiceNumber: invoice.invoiceNumber,
              status: { in: ["UNPAID", "PARTIALLY_PAID", "OVERDUE"] },
            },
          });

      if (!receivable) throw new Error("No open receivable found for this invoice");
      receivableId = receivable.id;
    }

    if (!receivableId) throw new Error("Receivable or invoice is required for sales credit notes");

    const receivable = await prisma.receivable.findUnique({
      where: { id: receivableId },
      include: { customer: true },
    });
    if (!receivable) throw new Error("Receivable not found");
    if (creditNote.customerId && receivable.customerId !== creditNote.customerId) {
      throw new Error("Receivable customer does not match credit note");
    }
    if (!["UNPAID", "PARTIALLY_PAID", "OVERDUE"].includes(receivable.status)) {
      throw new Error("Receivable has no outstanding balance");
    }

    const applyAmount = Math.min(remaining, Number(receivable.balance));
    if (applyAmount <= 0) throw new Error("Nothing to apply");

    const newBalance = Number(receivable.balance) - applyAmount;
    const newAmountPaid = Number(receivable.amountPaid) + applyAmount;

    await prisma.$transaction(async (tx) => {
      await tx.receivable.update({
        where: { id: receivable.id },
        data: {
          balance: newBalance,
          amountPaid: newAmountPaid,
          status: receivableStatus(Number(receivable.amount), newBalance),
        },
      });

      if (data.invoiceId) {
        const invoice = await tx.invoice.findUnique({ where: { id: data.invoiceId } });
        if (invoice) {
          const invBalance = Number(invoice.balance) - applyAmount;
          await tx.invoice.update({
            where: { id: data.invoiceId },
            data: {
              balance: invBalance,
              amountPaid: Number(invoice.amountPaid) + applyAmount,
              status: invBalance <= 0.01 ? "PAID" : "PARTIALLY_PAID",
            },
          });
        }
      }

      await tx.creditNote.update({
        where: { id: creditNoteId },
        data: {
          appliedAmount: Number(creditNote.appliedAmount) + applyAmount,
          linkedReceivableId: receivable.id,
          linkedInvoiceId: data.invoiceId || creditNote.linkedInvoiceId,
        },
      });
    });

    await createAuditLog({
      userId,
      action: "CREDIT_NOTE_APPLIED",
      module: "credit_notes",
      recordId: creditNoteId,
      newValue: { receivableId, applyAmount, invoiceId: data.invoiceId },
    });

    return prisma.creditNote.findUnique({
      where: { id: creditNoteId },
      include: { customer: true, supplier: true, items: true },
    });
  }

  if (creditNote.type === "PURCHASE") {
    if (!data.payableId) throw new Error("Payable is required for purchase credit notes");

    const payable = await prisma.payable.findUnique({
      where: { id: data.payableId },
      include: { supplier: true },
    });
    if (!payable) throw new Error("Payable not found");
    if (creditNote.supplierId && payable.supplierId !== creditNote.supplierId) {
      throw new Error("Payable supplier does not match credit note");
    }
    if (!["UNPAID", "PARTIALLY_PAID", "OVERDUE"].includes(payable.status)) {
      throw new Error("Payable has no outstanding balance");
    }

    const applyAmount = Math.min(remaining, Number(payable.balance));
    if (applyAmount <= 0) throw new Error("Nothing to apply");

    const newBalance = Number(payable.balance) - applyAmount;
    const newAmountPaid = Number(payable.amountPaid) + applyAmount;

    await prisma.$transaction([
      prisma.payable.update({
        where: { id: payable.id },
        data: {
          balance: newBalance,
          amountPaid: newAmountPaid,
          status: payableStatus(Number(payable.amount), newBalance),
        },
      }),
      prisma.creditNote.update({
        where: { id: creditNoteId },
        data: {
          appliedAmount: Number(creditNote.appliedAmount) + applyAmount,
          linkedPayableId: payable.id,
        },
      }),
    ]);

    await createAuditLog({
      userId,
      action: "CREDIT_NOTE_APPLIED",
      module: "credit_notes",
      recordId: creditNoteId,
      newValue: { payableId: payable.id, applyAmount },
    });

    return prisma.creditNote.findUnique({
      where: { id: creditNoteId },
      include: { customer: true, supplier: true, items: true },
    });
  }

  throw new Error("Unsupported credit note type");
}
