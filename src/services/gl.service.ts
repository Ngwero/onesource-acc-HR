import { prisma } from "@/lib/prisma";
import type { AccountType } from "@/generated/prisma/client";
import { computePeriodVariance } from "@/lib/pl-variance";
import { signedGlBalance } from "@/lib/gl-balance";

export { computePeriodVariance, signedGlBalance };

export interface GlAccountBalance {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  balance: number;
  debits: number;
  credits: number;
}

/** Raw debit column — always increases when the account is debited */
function applyDebit(amount: number, debits: number, credits: number) {
  return { debits: debits + amount, credits };
}

/** Raw credit column — always increases when the account is credited */
function applyCredit(amount: number, debits: number, credits: number) {
  return { debits, credits: credits + amount };
}

function signedBalance(type: AccountType, debits: number, credits: number, code?: string): number {
  return signedGlBalance(type, debits, credits, code);
}

export async function computeGlBalances(options?: {
  asOfDate?: Date;
  fromDate?: Date;
  toDate?: Date;
}): Promise<GlAccountBalance[]> {
  const accounts = await prisma.chartOfAccount.findMany({
    where: { isActive: true },
    orderBy: { code: "asc" },
  });

  const dateFilter: { gte?: Date; lte?: Date } = {};
  if (options?.fromDate) dateFilter.gte = options.fromDate;
  if (options?.toDate) dateFilter.lte = options.toDate;
  if (options?.asOfDate && !options.fromDate) dateFilter.lte = options.asOfDate;

  const lines = await prisma.journalEntryLine.findMany({
    where: {
      journalEntry: {
        status: "POSTED",
        ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {}),
      },
    },
  });

  const activity = new Map<string, { debits: number; credits: number }>();
  for (const acc of accounts) activity.set(acc.id, { debits: 0, credits: 0 });

  for (const line of lines) {
    const amt = Number(line.amount);
    if (line.debitAccountId) {
      const acc = accounts.find((a) => a.id === line.debitAccountId);
      if (!acc) continue;
      const cur = activity.get(acc.id)!;
      activity.set(acc.id, applyDebit(amt, cur.debits, cur.credits));
    }
    if (line.creditAccountId) {
      const acc = accounts.find((a) => a.id === line.creditAccountId);
      if (!acc) continue;
      const cur = activity.get(acc.id)!;
      activity.set(acc.id, applyCredit(amt, cur.debits, cur.credits));
    }
  }

  return accounts.map((a) => {
    const { debits, credits } = activity.get(a.id)!;
    return {
      id: a.id,
      code: a.code,
      name: a.name,
      type: a.accountType,
      debits,
      credits,
      balance: signedBalance(a.accountType, debits, credits, a.code),
    };
  });
}

export async function getTrialBalanceFromGl(asOfDate?: Date) {
  const balances = await computeGlBalances(asOfDate ? { asOfDate } : undefined);
  return balances
    .filter((b) => Math.abs(b.balance) > 0.001 || b.debits > 0 || b.credits > 0)
    .map((b) => ({
      code: b.code,
      name: b.name,
      type: b.type,
      debits: b.debits,
      credits: b.credits,
      balance: b.balance,
    }));
}

export async function getProfitAndLossFromGl(fromDate: Date, toDate: Date) {
  const periodBalances = await computeGlBalances({ fromDate, toDate });

  let revenue = 0;
  let cogs = 0;
  let expenses = 0;

  for (const acc of periodBalances) {
    if (acc.type === "INCOME") revenue += acc.balance;
    if (acc.type === "COGS") cogs += acc.balance;
    if (acc.type === "EXPENSE") expenses += acc.balance;
  }

  return {
    revenue,
    costOfGoodsSold: cogs,
    grossProfit: revenue - cogs,
    expenses,
    netProfit: revenue - cogs - expenses,
    source: "general_ledger" as const,
    fromDate: fromDate.toISOString().split("T")[0],
    toDate: toDate.toISOString().split("T")[0],
    detail: periodBalances.filter((b) => ["INCOME", "COGS", "EXPENSE"].includes(b.type) && Math.abs(b.balance) > 0.001),
  };
}

export async function getBalanceSheetFromGl(asOfDate?: Date) {
  const asOf = asOfDate || new Date();
  const balances = await computeGlBalances({ asOfDate: asOf });

  const mapRow = (b: GlAccountBalance) => ({
    code: b.code,
    name: b.name,
    accountType: b.type,
    balance: b.balance,
  });

  // Roll current-year earnings into equity so Assets = Liabilities + Equity mid-year
  const yearStart = new Date(asOf.getFullYear(), 0, 1);
  const pl = await getProfitAndLossFromGl(yearStart, asOf);
  const currentEarnings = pl.netProfit;

  const assetRows = balances
    .filter((b) => b.type === "ASSET")
    .map((b) => {
      // Present accum. dep. as a contra (negative) asset line for display
      if (b.code === "1210") return { ...mapRow(b), balance: -Math.abs(b.balance) };
      return mapRow(b);
    });

  const liabilityRows = balances.filter((b) => b.type === "LIABILITY").map(mapRow);
  const equityRows = balances.filter((b) => b.type === "EQUITY").map(mapRow);

  if (Math.abs(currentEarnings) > 0.001) {
    equityRows.push({
      code: "3900",
      name: "Current Year Earnings",
      accountType: "EQUITY",
      balance: currentEarnings,
    });
  }

  const assetsTotal = assetRows.reduce((s, b) => s + b.balance, 0);
  const liabilitiesTotal = liabilityRows.reduce((s, b) => s + b.balance, 0);
  const equityTotal = equityRows.reduce((s, b) => s + b.balance, 0);

  return {
    asOfDate: asOf.toISOString().split("T")[0],
    source: "general_ledger" as const,
    assets: assetRows,
    liabilities: liabilityRows,
    equity: equityRows,
    totals: {
      assets: assetsTotal,
      liabilities: liabilitiesTotal,
      equity: equityTotal,
      liabilitiesAndEquity: liabilitiesTotal + equityTotal,
      isBalanced: Math.abs(assetsTotal - (liabilitiesTotal + equityTotal)) < 1,
    },
  };
}

export async function syncGlBalancesFromJournals() {
  const balances = await computeGlBalances();
  let updated = 0;

  for (const b of balances) {
    await prisma.chartOfAccount.update({
      where: { id: b.id },
      data: { balance: b.balance },
    });
    updated++;
  }

  return { updated, syncedAt: new Date().toISOString() };
}

export async function getSubledgerReconciliation() {
  const glBalances = await computeGlBalances();
  const glByCode = Object.fromEntries(glBalances.map((b) => [b.code, b.balance]));

  const [receivableSum, payableSum, inventoryValue, bankBalance] = await Promise.all([
    prisma.receivable.aggregate({
      where: { status: { in: ["UNPAID", "PARTIALLY_PAID", "OVERDUE"] } },
      _sum: { balance: true },
    }),
    prisma.payable.aggregate({
      where: { status: { in: ["UNPAID", "PARTIALLY_PAID", "OVERDUE"] } },
      _sum: { balance: true },
    }),
    prisma.inventoryBatch.findMany({ where: { quantity: { gt: 0 } } }).then((batches) =>
      batches.reduce((s, b) => s + Number(b.quantity) * Number(b.unitCost), 0)
    ),
    prisma.bankAccount.aggregate({ where: { isActive: true }, _sum: { currentBalance: true } }),
  ]);

  const rows = [
    {
      subledger: "Accounts Receivable",
      glAccount: "1300",
      subledgerBalance: Number(receivableSum._sum.balance || 0),
      glBalance: glByCode["1300"] || 0,
      variance: Number(receivableSum._sum.balance || 0) - (glByCode["1300"] || 0),
    },
    {
      subledger: "Accounts Payable",
      glAccount: "2100",
      subledgerBalance: Number(payableSum._sum.balance || 0),
      glBalance: glByCode["2100"] || 0,
      variance: Number(payableSum._sum.balance || 0) - (glByCode["2100"] || 0),
    },
    {
      subledger: "Inventory (perpetual)",
      glAccount: "1200",
      subledgerBalance: inventoryValue,
      glBalance: glByCode["1200"] || 0,
      variance: inventoryValue - (glByCode["1200"] || 0),
    },
    {
      subledger: "Bank Accounts",
      glAccount: "1110",
      subledgerBalance: Number(bankBalance._sum.currentBalance || 0),
      glBalance: glByCode["1110"] || 0,
      variance: Number(bankBalance._sum.currentBalance || 0) - (glByCode["1110"] || 0),
    },
  ];

  return {
    reconciledAt: new Date().toISOString(),
    rows,
    isBalanced: rows.every((r) => Math.abs(r.variance) < 1),
  };
}

function balanceForCode(balances: GlAccountBalance[], code: string): number {
  return balances.find((b) => b.code === code)?.balance || 0;
}

export async function getCashFlowFromGl(fromDate: Date, toDate: Date) {
  const pl = await getProfitAndLossFromGl(fromDate, toDate);
  const dayBeforeStart = new Date(fromDate);
  dayBeforeStart.setDate(dayBeforeStart.getDate() - 1);

  const [startBalances, endBalances] = await Promise.all([
    computeGlBalances({ asOfDate: dayBeforeStart }),
    computeGlBalances({ asOfDate: toDate }),
  ]);

  const changeAR =
    balanceForCode(endBalances, "1300") - balanceForCode(startBalances, "1300");
  const changeAP =
    balanceForCode(endBalances, "2100") - balanceForCode(startBalances, "2100");
  const changeInventory =
    balanceForCode(endBalances, "1200") - balanceForCode(startBalances, "1200");

  const depreciationAddBack = endBalances
    .filter((b) => b.code.startsWith("54") || b.name.toLowerCase().includes("depreciation"))
    .reduce((s, b) => s + b.balance, 0);

  const operatingAdjustments = {
    depreciation: depreciationAddBack,
    changeInReceivables: -changeAR,
    changeInPayables: changeAP,
    changeInInventory: -changeInventory,
  };

  const netOperating =
    pl.netProfit +
    operatingAdjustments.depreciation +
    operatingAdjustments.changeInReceivables +
    operatingAdjustments.changeInPayables +
    operatingAdjustments.changeInInventory;

  const changeFixedAssets =
    balanceForCode(endBalances, "1500") - balanceForCode(startBalances, "1500");
  const investing = -changeFixedAssets;

  const changeLoans =
    balanceForCode(endBalances, "2200") - balanceForCode(startBalances, "2200");
  const changeEquity =
    balanceForCode(endBalances, "3200") - balanceForCode(startBalances, "3200");
  const financing = changeLoans + changeEquity;

  const netChangeInCash = netOperating + investing + financing;
  const openingCash =
    balanceForCode(startBalances, "1110") + balanceForCode(startBalances, "1100");
  const closingCash =
    balanceForCode(endBalances, "1110") + balanceForCode(endBalances, "1100");

  return {
    source: "general_ledger" as const,
    method: "indirect" as const,
    fromDate: fromDate.toISOString().split("T")[0],
    toDate: toDate.toISOString().split("T")[0],
    operating: {
      netIncome: pl.netProfit,
      adjustments: operatingAdjustments,
      netCashFromOperating: netOperating,
    },
    investing: { netCashFromInvesting: investing, fixedAssetChange: changeFixedAssets },
    financing: { netCashFromFinancing: financing, loanChange: changeLoans, equityChange: changeEquity },
    netChangeInCash,
    openingCash,
    closingCash,
    reconciliationVariance: closingCash - (openingCash + netChangeInCash),
  };
}

export async function getComparativeProfitAndLoss(fromDate: Date, toDate: Date) {
  const periodMs = toDate.getTime() - fromDate.getTime();
  const priorEnd = new Date(fromDate.getTime() - 86400000);
  const priorStart = new Date(priorEnd.getTime() - periodMs);

  const [current, prior] = await Promise.all([
    getProfitAndLossFromGl(fromDate, toDate),
    getProfitAndLossFromGl(priorStart, priorEnd),
  ]);

  return {
    source: "general_ledger" as const,
    current: { ...current, label: `${current.fromDate} to ${current.toDate}` },
    prior: { ...prior, label: `${prior.fromDate} to ${prior.toDate}` },
    variance: computePeriodVariance(current, prior),
  };
}
