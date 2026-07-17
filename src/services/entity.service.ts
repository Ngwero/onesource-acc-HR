import { prisma } from "@/lib/prisma";
import { getDefaultEntityId } from "@/lib/entity-context";

export async function listEntities() {
  return prisma.entity.findMany({
    where: { isActive: true },
    include: { parentEntity: { select: { code: true, name: true } } },
    orderBy: { code: "asc" },
  });
}

export async function createEntity(data: {
  code: string;
  name: string;
  parentEntityId?: string;
  defaultCurrency?: string;
}) {
  const count = await prisma.entity.count();
  return prisma.entity.create({
    data: {
      code: data.code,
      name: data.name,
      parentEntityId: data.parentEntityId,
      defaultCurrency: (data.defaultCurrency as "UGX") || "UGX",
      isDefault: count === 0,
    },
  });
}

export async function getConsolidatedTrialBalance(asOfDate?: Date) {
  const entities = await prisma.entity.findMany({ where: { isActive: true } });
  const accounts = await prisma.chartOfAccount.findMany({
    where: { isActive: true },
    orderBy: { code: "asc" },
  });

  const merged = new Map<
    string,
    { code: string; name: string; type: string; balance: number; byEntity: Record<string, number> }
  >();

  for (const account of accounts) {
    merged.set(account.code, {
      code: account.code,
      name: account.name,
      type: account.accountType,
      balance: 0,
      byEntity: {},
    });
  }

  for (const entity of entities) {
    const lines = await prisma.journalEntryLine.findMany({
      where: {
        journalEntry: {
          status: "POSTED",
          entityId: entity.id,
          ...(asOfDate ? { date: { lte: asOfDate } } : {}),
        },
      },
      include: {
        debitAccount: true,
        creditAccount: true,
        journalEntry: true,
      },
    });

    const activity = new Map<string, { debits: number; credits: number; type: string }>();
    for (const acc of accounts) activity.set(acc.id, { debits: 0, credits: 0, type: acc.accountType });

    for (const line of lines) {
      const amt = Number(line.amount);
      if (line.debitAccountId) {
        const cur = activity.get(line.debitAccountId)!;
        cur.debits += amt;
      }
      if (line.creditAccountId) {
        const cur = activity.get(line.creditAccountId)!;
        cur.credits += amt;
      }
    }

    for (const acc of accounts) {
      const { debits, credits, type } = activity.get(acc.id)!;
      const isDebitNormal = type === "ASSET" || type === "EXPENSE" || type === "COGS";
      const balance = isDebitNormal ? debits - credits : credits - debits;
      if (Math.abs(balance) < 0.001) continue;

      const row = merged.get(acc.code)!;
      row.balance += balance;
      row.byEntity[entity.code] = balance;
    }
  }

  return {
    source: "consolidated_general_ledger" as const,
    asOfDate: (asOfDate || new Date()).toISOString().split("T")[0],
    entities: entities.map((e) => ({ code: e.code, name: e.name })),
    rows: Array.from(merged.values()).filter((r) => Math.abs(r.balance) >= 0.01),
  };
}

export async function assignDefaultEntityToRecord(entityId?: string | null) {
  return entityId || (await getDefaultEntityId());
}
