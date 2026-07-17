import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { postJournalEntry } from "../src/services/accounting.service";
import {
  getTrialBalanceFromGl,
  getProfitAndLossFromGl,
  getBalanceSheetFromGl,
  syncGlBalancesFromJournals,
} from "../src/services/gl.service";

async function main() {
  console.log("users", await prisma.user.count());
  const admin = await prisma.user.findFirst({ where: { role: "SUPER_ADMIN" } });
  if (!admin) throw new Error("no admin");

  const je = await postJournalEntry({
    description: "quick health JE",
    reference: "HEALTHCHECK",
    userId: admin.id,
    lines: [
      { debitAccountCode: "1300", creditAccountCode: "4100", amount: 10000 },
      { debitAccountCode: "5200", creditAccountCode: "1110", amount: 2000 },
    ],
  });
  console.log("PASS | journal", je.journalNumber);

  await syncGlBalancesFromJournals();
  const now = new Date();
  const tb = await getTrialBalanceFromGl(now);
  const d = tb.reduce((s, r) => s + r.debits, 0);
  const c = tb.reduce((s, r) => s + r.credits, 0);
  console.log(Math.abs(d - c) < 1 ? "PASS" : "FAIL", "| TB D=C", d, c);

  const pl = await getProfitAndLossFromGl(new Date(now.getFullYear(), 0, 1), now);
  console.log("PASS | P&L", { revenue: pl.revenue, expenses: pl.expenses, net: pl.netProfit });

  const bs = await getBalanceSheetFromGl(now);
  console.log(
    bs.totals.isBalanced ? "PASS" : "FAIL",
    "| BS A=L+E",
    bs.totals.assets,
    bs.totals.liabilitiesAndEquity
  );

  const open = await prisma.fiscalPeriod.count({ where: { status: "OPEN" } });
  console.log(open > 0 ? "PASS" : "FAIL", "| open periods", open);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
