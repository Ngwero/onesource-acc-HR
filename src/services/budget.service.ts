import { prisma } from "@/lib/prisma";

export async function getBudgetVsActual(budgetId?: string) {
  const budgets = await prisma.budget.findMany({
    where: budgetId ? { id: budgetId } : undefined,
    include: { lines: { include: { account: true } } },
    orderBy: { fiscalYear: "desc" },
  });

  const rows: {
    budgetName: string;
    fiscalYear: number;
    accountCode: string;
    accountName: string;
    budgetAmount: number;
    actualAmount: number;
    variance: number;
    variancePct: number;
  }[] = [];

  for (const budget of budgets) {
    for (const line of budget.lines) {
      const journalLines = await prisma.journalEntryLine.findMany({
        where: {
          OR: [{ debitAccountId: line.accountId }, { creditAccountId: line.accountId }],
          journalEntry: {
            status: "POSTED",
            date: { gte: budget.startDate, lte: budget.endDate },
          },
        },
      });

      let actual = 0;
      for (const jl of journalLines) {
        if (jl.debitAccountId === line.accountId) actual += Number(jl.amount);
        if (jl.creditAccountId === line.accountId) actual -= Number(jl.amount);
      }

      const budgetAmt = Number(line.amount);
      const variance = budgetAmt - actual;
      rows.push({
        budgetName: budget.name,
        fiscalYear: budget.fiscalYear,
        accountCode: line.account.code,
        accountName: line.account.name,
        budgetAmount: budgetAmt,
        actualAmount: actual,
        variance,
        variancePct: budgetAmt ? (variance / budgetAmt) * 100 : 0,
      });
    }
  }

  return rows;
}
