import { prisma } from "@/lib/prisma";
import { generateDocumentNumber } from "@/lib/utils";
import type { RecurringFrequency } from "@/generated/prisma/client";
import { dispatchWebhooks } from "./webhook.service";

function nextDate(current: Date, frequency: RecurringFrequency): Date {
  const d = new Date(current);
  switch (frequency) {
    case "WEEKLY":
      d.setDate(d.getDate() + 7);
      break;
    case "MONTHLY":
      d.setMonth(d.getMonth() + 1);
      break;
    case "QUARTERLY":
      d.setMonth(d.getMonth() + 3);
      break;
    case "YEARLY":
      d.setFullYear(d.getFullYear() + 1);
      break;
  }
  return d;
}

export async function runDueRecurringTemplates(userId: string) {
  const now = new Date();
  const templates = await prisma.recurringTemplate.findMany({
    where: { isActive: true, nextRunDate: { lte: now } },
    include: { customer: true, supplier: true },
  });

  const results: { templateId: string; name: string; documentNumber?: string }[] = [];

  for (const tpl of templates) {
    let documentNumber: string | undefined;

    if (tpl.type === "INVOICE" && tpl.customerId) {
      const invoiceNumber = await generateDocumentNumber("INV", prisma);
      await prisma.invoice.create({
        data: {
          invoiceNumber,
          customerId: tpl.customerId,
          dueDate: nextDate(now, tpl.frequency),
          subtotal: tpl.amount,
          tax: 0,
          discount: 0,
          total: tpl.amount,
          balance: tpl.amount,
          status: "UNPAID",
          notes: tpl.description || `Recurring: ${tpl.name}`,
        },
      });
      await dispatchWebhooks("INVOICE_CREATED", {
        invoiceNumber,
        customerId: tpl.customerId,
        total: Number(tpl.amount),
        source: "recurring",
      });
      documentNumber = invoiceNumber;
    } else if (tpl.type === "BILL" && tpl.supplierId) {
      const expenseNumber = await generateDocumentNumber("EXP", prisma);
      const category = await prisma.expenseCategory.findFirst();
      await prisma.expense.create({
        data: {
          expenseNumber,
          categoryId: category?.id || (await prisma.expenseCategory.findFirstOrThrow()).id,
          description: tpl.description || tpl.name,
          amount: tpl.amount,
          ugxEquivalent: tpl.amount,
          currency: "UGX",
          date: now,
          status: "SUBMITTED",
          createdById: userId,
        },
      });
      documentNumber = expenseNumber;
    }

    await prisma.recurringTemplate.update({
      where: { id: tpl.id },
      data: { lastRunDate: now, nextRunDate: nextDate(tpl.nextRunDate, tpl.frequency) },
    });

    results.push({ templateId: tpl.id, name: tpl.name, documentNumber });
  }

  return { processed: results.length, results };
}
