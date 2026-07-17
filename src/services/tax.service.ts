import { prisma } from "@/lib/prisma";

export { computePurchaseInputVat } from "@/lib/vat";

const VAT_ACCOUNT_CODE = "2300";

export async function getVatReturnReport(fromDate: Date, toDate: Date) {
  const vatAccount = await prisma.chartOfAccount.findUnique({
    where: { code: VAT_ACCOUNT_CODE },
  });
  if (!vatAccount) throw new Error("VAT account 2300 not found");

  const lines = await prisma.journalEntryLine.findMany({
    where: {
      journalEntry: {
        status: "POSTED",
        date: { gte: fromDate, lte: toDate },
      },
      OR: [{ debitAccountId: vatAccount.id }, { creditAccountId: vatAccount.id }],
    },
    include: {
      journalEntry: { select: { journalNumber: true, date: true, description: true, reference: true } },
      debitAccount: { select: { code: true, name: true } },
      creditAccount: { select: { code: true, name: true } },
    },
    orderBy: { journalEntry: { date: "asc" } },
  });

  let outputVat = 0;
  let inputVat = 0;
  const detail: Array<{
    date: string;
    journalNumber: string;
    reference: string | null;
    description: string;
    type: "OUTPUT" | "INPUT";
    amount: number;
  }> = [];

  for (const line of lines) {
    const amt = Number(line.amount);
    if (line.creditAccountId === vatAccount.id) {
      outputVat += amt;
      detail.push({
        date: line.journalEntry.date.toISOString().split("T")[0],
        journalNumber: line.journalEntry.journalNumber,
        reference: line.journalEntry.reference,
        description: line.description || line.journalEntry.description,
        type: "OUTPUT",
        amount: amt,
      });
    }
    if (line.debitAccountId === vatAccount.id) {
      inputVat += amt;
      detail.push({
        date: line.journalEntry.date.toISOString().split("T")[0],
        journalNumber: line.journalEntry.journalNumber,
        reference: line.journalEntry.reference,
        description: line.description || line.journalEntry.description,
        type: "INPUT",
        amount: amt,
      });
    }
  }

  const openingLines = await prisma.journalEntryLine.findMany({
    where: {
      journalEntry: { status: "POSTED", date: { lt: fromDate } },
      OR: [{ debitAccountId: vatAccount.id }, { creditAccountId: vatAccount.id }],
    },
  });

  let openingBalance = 0;
  for (const line of openingLines) {
    const amt = Number(line.amount);
    if (line.creditAccountId === vatAccount.id) openingBalance += amt;
    if (line.debitAccountId === vatAccount.id) openingBalance -= amt;
  }

  const netVatPayable = outputVat - inputVat;
  const closingBalance = openingBalance + netVatPayable;

  return {
    source: "general_ledger" as const,
    vatAccount: VAT_ACCOUNT_CODE,
    fromDate: fromDate.toISOString().split("T")[0],
    toDate: toDate.toISOString().split("T")[0],
    openingBalance,
    outputVat,
    inputVat,
    netVatPayable,
    closingBalance,
    detail,
  };
}
