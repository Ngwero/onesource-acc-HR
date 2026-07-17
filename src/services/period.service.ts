import { prisma } from "@/lib/prisma";
import { computeGlBalances } from "./gl.service";
import { postJournalEntry } from "./accounting.service";
import { createAuditLog } from "./audit.service";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function endOfMonth(year: number, month: number): Date {
  return new Date(year, month, 0, 23, 59, 59, 999);
}

function startOfMonth(year: number, month: number): Date {
  return new Date(year, month - 1, 1, 0, 0, 0, 0);
}

export async function getFiscalYearStartMonth(): Promise<number> {
  const settings = await prisma.companySetting.findFirst();
  return settings?.fiscalYearStartMonth || 1;
}

export async function ensureFiscalPeriods(year: number) {
  const created = [];

  for (let month = 1; month <= 12; month++) {
    const existing = await prisma.fiscalPeriod.findUnique({
      where: { year_month: { year, month } },
    });
    if (existing) continue;

    const period = await prisma.fiscalPeriod.create({
      data: {
        year,
        month,
        name: `${MONTH_NAMES[month - 1]} ${year}`,
        startDate: startOfMonth(year, month),
        endDate: endOfMonth(year, month),
        status: "OPEN",
      },
    });
    created.push(period);
  }

  return { year, created: created.length, periods: await listFiscalPeriods(year) };
}

export async function listFiscalPeriods(year?: number) {
  if (year) {
    await ensureFiscalPeriods(year);
  }

  return prisma.fiscalPeriod.findMany({
    where: year ? { year } : undefined,
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });
}

export async function getPeriodForDate(date: Date) {
  const period = await prisma.fiscalPeriod.findFirst({
    where: {
      startDate: { lte: date },
      endDate: { gte: date },
    },
  });

  if (period) return period;

  await ensureFiscalPeriods(date.getFullYear());
  return prisma.fiscalPeriod.findFirst({
    where: {
      startDate: { lte: date },
      endDate: { gte: date },
    },
  });
}

export async function assertPeriodOpen(date: Date = new Date()) {
  const period = await getPeriodForDate(date);
  if (!period) return;

  if (period.status !== "OPEN") {
    throw new Error(
      `Accounting period "${period.name}" is ${period.status.toLowerCase()}. Posting is not allowed.`
    );
  }
}

export async function closeFiscalPeriod(periodId: string, userId: string, notes?: string) {
  const period = await prisma.fiscalPeriod.findUnique({ where: { id: periodId } });
  if (!period) throw new Error("Period not found");
  if (period.status !== "OPEN") throw new Error(`Period is already ${period.status.toLowerCase()}`);

  const draftCount = await prisma.journalEntry.count({
    where: {
      status: "DRAFT",
      date: { gte: period.startDate, lte: period.endDate },
    },
  });
  if (draftCount > 0) {
    throw new Error(`${draftCount} draft journal(s) must be posted or deleted before closing`);
  }

  const updated = await prisma.fiscalPeriod.update({
    where: { id: periodId },
    data: {
      status: "CLOSED",
      closedAt: new Date(),
      closedById: userId,
      notes,
    },
  });

  await createAuditLog({
    userId,
    action: "PERIOD_CLOSED",
    module: "ledger",
    recordId: periodId,
    newValue: { name: period.name, status: "CLOSED" },
  });

  return updated;
}

export async function reopenFiscalPeriod(periodId: string, userId: string) {
  const period = await prisma.fiscalPeriod.findUnique({ where: { id: periodId } });
  if (!period) throw new Error("Period not found");
  if (period.status === "LOCKED") throw new Error("Locked periods cannot be reopened");
  if (period.status === "OPEN") throw new Error("Period is already open");

  const updated = await prisma.fiscalPeriod.update({
    where: { id: periodId },
    data: {
      status: "OPEN",
      closedAt: null,
      closedById: null,
    },
  });

  await createAuditLog({
    userId,
    action: "PERIOD_REOPENED",
    module: "ledger",
    recordId: periodId,
    newValue: { name: period.name, status: "OPEN" },
  });

  return updated;
}

export async function yearEndClose(fiscalYear: number, userId: string) {
  await ensureFiscalPeriods(fiscalYear);

  const periods = await prisma.fiscalPeriod.findMany({
    where: { year: fiscalYear },
    orderBy: { month: "asc" },
  });

  const openPeriods = periods.filter((p) => p.status === "OPEN");
  for (const p of openPeriods) {
    await closeFiscalPeriod(p.id, userId, "Auto-closed for year-end");
  }

  const startDate = startOfMonth(fiscalYear, 1);
  const endDate = endOfMonth(fiscalYear, 12);

  const balances = await computeGlBalances({ fromDate: startDate, toDate: endDate });

  const incomeLines: Array<{ code: string; amount: number }> = [];
  const expenseLines: Array<{ code: string; amount: number }> = [];

  for (const acc of balances) {
    if (Math.abs(acc.balance) < 0.01) continue;
    if (acc.type === "INCOME" && acc.balance > 0) {
      incomeLines.push({ code: acc.code, amount: acc.balance });
    }
    if ((acc.type === "EXPENSE" || acc.type === "COGS") && acc.balance > 0) {
      expenseLines.push({ code: acc.code, amount: acc.balance });
    }
  }

  const totalIncome = incomeLines.reduce((s, l) => s + l.amount, 0);
  const totalExpenses = expenseLines.reduce((s, l) => s + l.amount, 0);
  const netIncome = totalIncome - totalExpenses;

  const journalLines = [
    ...incomeLines.map((l) => ({
      debitAccountCode: l.code,
      creditAccountCode: "3200",
      amount: l.amount,
      description: `Close ${l.code} to retained earnings`,
    })),
    ...expenseLines.map((l) => ({
      debitAccountCode: "3200",
      creditAccountCode: l.code,
      amount: l.amount,
      description: `Close ${l.code} to retained earnings`,
    })),
  ];

  let closingJournal = null;
  if (journalLines.length > 0) {
    closingJournal = await postJournalEntry({
      description: `Year-end close ${fiscalYear}`,
      reference: `YE-${fiscalYear}`,
      userId,
      lines: journalLines,
      autoPost: true,
      entryDate: endDate,
      skipPeriodCheck: true,
    });
  }

  await prisma.fiscalPeriod.updateMany({
    where: { year: fiscalYear },
    data: { status: "LOCKED", closedAt: new Date(), closedById: userId },
  });

  await ensureFiscalPeriods(fiscalYear + 1);

  await createAuditLog({
    userId,
    action: "YEAR_END_CLOSE",
    module: "ledger",
    recordId: String(fiscalYear),
    newValue: { fiscalYear, netIncome, journalNumber: closingJournal?.journalNumber },
  });

  return {
    fiscalYear,
    totalIncome,
    totalExpenses,
    netIncome,
    journalNumber: closingJournal?.journalNumber || null,
    lockedPeriods: periods.length,
  };
}
