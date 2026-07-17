import { prisma } from "@/lib/prisma";
import { postDepreciationJournal } from "./accounting.service";

export async function runDepreciation(userId: string) {
  const assets = await prisma.fixedAsset.findMany({
    where: { status: "ACTIVE" },
  });

  const results: { assetId: string; assetNumber: string; amount: number }[] = [];

  for (const asset of assets) {
    const depreciable = Number(asset.purchaseCost) - Number(asset.salvageValue);
    if (depreciable <= 0 || asset.usefulLifeMonths <= 0) continue;

    const monthlyDep = depreciable / asset.usefulLifeMonths;
    const remaining = Number(asset.bookValue) - Number(asset.salvageValue);
    if (remaining <= 0) continue;

    const amount = Math.min(monthlyDep, remaining);
    const newAccum = Number(asset.accumulatedDepreciation) + amount;
    const newBook = Number(asset.purchaseCost) - newAccum;

    await prisma.fixedAsset.update({
      where: { id: asset.id },
      data: {
        accumulatedDepreciation: newAccum,
        bookValue: Math.max(newBook, Number(asset.salvageValue)),
        status: newBook <= Number(asset.salvageValue) ? "FULLY_DEPRECIATED" : "ACTIVE",
      },
    });

    await postDepreciationJournal(amount, userId, asset.assetNumber, asset.name);

    results.push({ assetId: asset.id, assetNumber: asset.assetNumber, amount });
  }

  if (results.length > 0) {
    await prisma.auditLog.create({
      data: {
        userId,
        action: "UPDATE",
        module: "fixed-assets",
        recordId: "depreciation-run",
        newValue: { count: results.length, total: results.reduce((s, r) => s + r.amount, 0) },
      },
    });
  }

  return { processed: results.length, entries: results };
}
