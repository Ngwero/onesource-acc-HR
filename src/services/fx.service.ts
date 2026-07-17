import { prisma } from "@/lib/prisma";
import { postExchangeGainLoss } from "./accounting.service";
import { createAuditLog } from "./audit.service";

export async function runFxRevaluation(userId: string) {
  const receivables = await prisma.receivable.findMany({
    where: {
      currency: { not: "UGX" },
      status: { in: ["UNPAID", "PARTIALLY_PAID", "OVERDUE"] },
    },
    include: { customer: true },
  });

  let posted = 0;
  let skipped = 0;
  const adjustments: Array<{ receivableNumber: string; diff: number; currency: string }> = [];

  for (const receivable of receivables) {
    const currency = await prisma.currency.findUnique({
      where: { code: receivable.currency },
      include: {
        exchangeRates: { orderBy: { effectiveDate: "desc" }, take: 1 },
      },
    });

    const latestRate = currency?.exchangeRates[0];
    if (!latestRate) {
      skipped++;
      continue;
    }

    const bookedRate = Number(receivable.exchangeRate);
    const newRate = Number(latestRate.rate);
    if (Math.abs(bookedRate - newRate) < 0.000001) {
      skipped++;
      continue;
    }

    const balance = Number(receivable.balance);
    const foreignAmount = balance / bookedRate;
    const revaluedBalance = foreignAmount * newRate;
    const diff = revaluedBalance - balance;

    if (Math.abs(diff) < 1) {
      skipped++;
      continue;
    }

    await postExchangeGainLoss(Math.abs(diff), diff > 0, userId, receivable.receivableNumber);

    await prisma.receivable.update({
      where: { id: receivable.id },
      data: {
        balance: revaluedBalance,
        amount: Number(receivable.amount) + diff,
        exchangeRate: newRate,
      },
    });

    await prisma.customer.update({
      where: { id: receivable.customerId },
      data: { balance: { increment: diff } },
    });

    adjustments.push({
      receivableNumber: receivable.receivableNumber,
      diff,
      currency: receivable.currency,
    });
    posted++;
  }

  if (posted > 0) {
    await createAuditLog({
      userId,
      action: "FX_REVALUATION",
      module: "ledger",
      recordId: "fx-revaluation",
      newValue: { posted, skipped, adjustments },
    });
  }

  return { posted, skipped, adjustments };
}
