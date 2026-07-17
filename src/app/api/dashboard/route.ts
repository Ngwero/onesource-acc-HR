import { prisma } from "@/lib/prisma";
import { withAuth, parseDateRange } from "@/lib/api-middleware";
import { successResponse } from "@/lib/api-response";
import { decimalToNumber } from "@/lib/utils";
import { getStockValuation, getLowStockAlerts } from "@/services/inventory.service";

async function sumSalesInRange(start: Date, end: Date) {
  const [local, exp] = await Promise.all([
    prisma.sale.aggregate({
      where: { status: "CONFIRMED", saleDate: { gte: start, lte: end } },
      _sum: { totalAmount: true },
    }),
    prisma.exportSale.aggregate({
      where: { status: "CONFIRMED", createdAt: { gte: start, lte: end } },
      _sum: { ugxEquivalent: true },
    }),
  ]);
  return Number(local._sum.totalAmount || 0) + Number(exp._sum.ugxEquivalent || 0);
}

async function sumExpensesInRange(start: Date, end: Date) {
  const result = await prisma.expense.aggregate({
    where: { status: { in: ["APPROVED", "PAID"] }, date: { gte: start, lte: end } },
    _sum: { ugxEquivalent: true },
  });
  return Number(result._sum.ugxEquivalent || 0);
}

async function sumPurchasesInRange(start: Date, end: Date) {
  const result = await prisma.purchase.aggregate({
    where: { status: "CONFIRMED", purchaseDate: { gte: start, lte: end } },
    _sum: { totalAmount: true },
  });
  return Number(result._sum.totalAmount || 0);
}

export const GET = withAuth(
  async ({ request }) => {
    const { searchParams } = new URL(request.url);
    const { startDate, endDate } = parseDateRange(searchParams);
    const dateFilter = startDate
      ? { gte: startDate, lte: endDate || new Date() }
      : undefined;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - 6);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const [
      sales,
      purchases,
      expenses,
      payables,
      receivables,
      shipments,
      stockBatches,
      lowStock,
      company,
      todaySales,
      weekSales,
      monthSales,
      monthPurchases,
      monthExpenses,
      prevMonthSales,
      prevMonthPurchases,
      prevMonthExpenses,
    ] = await Promise.all([
      prisma.sale.findMany({
        where: { status: "CONFIRMED", ...(dateFilter && { saleDate: dateFilter }) },
        include: { items: true },
      }),
      prisma.purchase.findMany({
        where: { status: "CONFIRMED", ...(dateFilter && { purchaseDate: dateFilter }) },
      }),
      prisma.expense.findMany({
        where: {
          status: { in: ["APPROVED", "PAID"] },
          ...(dateFilter && { date: dateFilter }),
        },
        include: { category: true },
      }),
      prisma.payable.findMany({
        where: { status: { in: ["UNPAID", "PARTIALLY_PAID", "OVERDUE"] } },
      }),
      prisma.receivable.findMany({
        where: { status: { in: ["UNPAID", "PARTIALLY_PAID", "OVERDUE"] } },
      }),
      prisma.exportShipment.findMany(),
      getStockValuation(),
      getLowStockAlerts(),
      prisma.companySetting.findFirst(),
      sumSalesInRange(startOfToday, now),
      sumSalesInRange(startOfWeek, now),
      sumSalesInRange(startOfMonth, now),
      sumPurchasesInRange(startOfMonth, now),
      sumExpensesInRange(startOfMonth, now),
      sumSalesInRange(startOfPrevMonth, endOfPrevMonth),
      sumPurchasesInRange(startOfPrevMonth, endOfPrevMonth),
      sumExpensesInRange(startOfPrevMonth, endOfPrevMonth),
    ]);

    const totalLocalSales = sales.reduce((s, sale) => s + Number(sale.totalAmount), 0);
    const totalPurchases = purchases.reduce((s, p) => s + Number(p.totalAmount), 0);
    const totalExpenses = expenses.reduce((s, e) => s + Number(e.ugxEquivalent), 0);

    const exportSales = await prisma.exportSale.findMany({
      where: { status: "CONFIRMED", ...(dateFilter && { createdAt: dateFilter }) },
    });
    const totalExportSales = exportSales.reduce((s, e) => s + Number(e.ugxEquivalent), 0);
    const totalSales = totalLocalSales + totalExportSales;
    const grossProfit = totalSales - totalPurchases;
    const netProfit = grossProfit - totalExpenses;

    const monthNet = monthSales - monthPurchases - monthExpenses;
    const prevMonthNet = prevMonthSales - prevMonthPurchases - prevMonthExpenses;
    const netProfitChangePct =
      prevMonthNet === 0
        ? monthNet > 0
          ? 100
          : 0
        : ((monthNet - prevMonthNet) / Math.abs(prevMonthNet)) * 100;

    const stockValue = stockBatches.reduce((s, b) => s + b.value, 0);
    const stockAvailable = stockBatches.reduce((s, b) => s + Number(b.quantity), 0);

    const pendingPayables = payables.reduce((s, p) => s + Number(p.balance), 0);
    const pendingReceivables = receivables.reduce((s, r) => s + Number(r.balance), 0);

    const shipmentsInProgress = shipments.filter((s) =>
      ["PLANNING", "PACKED", "DISPATCHED", "IN_TRANSIT"].includes(s.status)
    ).length;
    const completedShipments = shipments.filter((s) => s.status === "DELIVERED").length;

    const damagedMovements = await prisma.stockMovement.findMany({
      where: {
        movementType: { in: ["DAMAGE", "REJECTION"] },
        ...(dateFilter && { date: dateFilter }),
      },
    });
    const damagedStock = damagedMovements.reduce((s, m) => s + Number(m.quantity), 0);

    const overdueInvoices = await prisma.receivable.count({ where: { status: "OVERDUE" } });
    const unpaidInvoices = await prisma.receivable.count({
      where: { status: { in: ["UNPAID", "PARTIALLY_PAID"] } },
    });

    const cashAccount = await prisma.chartOfAccount.findUnique({ where: { code: "1100" } });
    const bankAccount = await prisma.chartOfAccount.findUnique({ where: { code: "1110" } });
    const cashBankBalance =
      Number(cashAccount?.balance || 0) + Number(bankAccount?.balance || 0);

    const saleItems = await prisma.saleItem.groupBy({
      by: ["produceId"],
      _sum: { quantity: true, totalAmount: true },
      orderBy: { _sum: { totalAmount: "desc" } },
      take: 5,
    });

    const topProduce = await Promise.all(
      saleItems.map(async (item) => {
        const produce = await prisma.produce.findUnique({ where: { id: item.produceId } });
        return {
          name: produce?.name || "Unknown",
          quantity: decimalToNumber(item._sum.quantity),
          revenue: decimalToNumber(item._sum.totalAmount),
        };
      })
    );

    const expenseByCategory = new Map<string, number>();
    for (const e of expenses) {
      const name = e.category?.name || "Other";
      expenseByCategory.set(name, (expenseByCategory.get(name) || 0) + Number(e.ugxEquivalent));
    }
    const expenseCategories = [...expenseByCategory.entries()]
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
    const expenseOther = [...expenseByCategory.entries()]
      .slice(5)
      .reduce((s, [, amount]) => s + amount, 0);
    if (expenseOther > 0) expenseCategories.push({ name: "Other", amount: expenseOther });

    const monthlyData = await getMonthlyTrends();
    const salesSeries = await getSalesSeriesByProduce(topProduce.slice(0, 3).map((p) => p.name));

    return successResponse({
      companyName: company?.companyName || "One Source",
      summary: {
        totalSales,
        totalLocalSales,
        totalExportSales,
        totalPurchases,
        totalExpenses,
        grossProfit,
        netProfit,
        monthNetProfit: monthNet,
        netProfitChangePct,
        todaySales,
        weekSales,
        monthSales,
        stockValue,
        stockAvailable,
        pendingPayables,
        pendingReceivables,
        shipmentsInProgress,
        completedShipments,
        damagedStock,
        unpaidInvoices,
        overdueInvoices,
        cashBankBalance,
      },
      topProduce,
      expenseCategories,
      salesSeries,
      lowStockAlerts: lowStock.length,
      monthlyTrends: monthlyData,
    });
  },
  { module: "dashboard", action: "read" }
);

async function getMonthlyTrends() {
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const label = d.toLocaleString("en", { month: "short" });

    const [salesSum, exportSum, expenseSum, purchaseSum] = await Promise.all([
      prisma.sale.aggregate({
        where: { status: "CONFIRMED", saleDate: { gte: d, lte: end } },
        _sum: { totalAmount: true },
      }),
      prisma.exportSale.aggregate({
        where: { status: "CONFIRMED", createdAt: { gte: d, lte: end } },
        _sum: { ugxEquivalent: true },
      }),
      prisma.expense.aggregate({
        where: { status: { in: ["APPROVED", "PAID"] }, date: { gte: d, lte: end } },
        _sum: { ugxEquivalent: true },
      }),
      prisma.purchase.aggregate({
        where: { status: "CONFIRMED", purchaseDate: { gte: d, lte: end } },
        _sum: { totalAmount: true },
      }),
    ]);

    const sales =
      Number(salesSum._sum.totalAmount || 0) + Number(exportSum._sum.ugxEquivalent || 0);
    const expenses = Number(expenseSum._sum.ugxEquivalent || 0);
    const purchases = Number(purchaseSum._sum.totalAmount || 0);
    const grossProfit = sales - purchases;
    months.push({
      month: label,
      sales,
      expenses,
      purchases,
      grossProfit,
      profit: sales - expenses,
    });
  }
  return months;
}

async function getSalesSeriesByProduce(names: string[]) {
  const now = new Date();
  const months: Array<Record<string, string | number>> = [];

  const produceRows = await prisma.produce.findMany({
    where: names.length ? { name: { in: names } } : undefined,
    take: 3,
    orderBy: { name: "asc" },
  });

  const seriesNames =
    produceRows.length > 0
      ? produceRows.map((p) => p.name)
      : ["Local Sales", "Export Sales", "Other"];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const label = d.toLocaleString("en", { month: "short" });
    const point: Record<string, string | number> = { month: label };

    if (produceRows.length > 0) {
      for (const p of produceRows) {
        const agg = await prisma.saleItem.aggregate({
          where: {
            produceId: p.id,
            sale: { status: "CONFIRMED", saleDate: { gte: d, lte: end } },
          },
          _sum: { totalAmount: true },
        });
        point[p.name] = Number(agg._sum.totalAmount || 0);
      }
    } else {
      const [local, exp] = await Promise.all([
        prisma.sale.aggregate({
          where: { status: "CONFIRMED", saleDate: { gte: d, lte: end } },
          _sum: { totalAmount: true },
        }),
        prisma.exportSale.aggregate({
          where: { status: "CONFIRMED", createdAt: { gte: d, lte: end } },
          _sum: { ugxEquivalent: true },
        }),
      ]);
      point["Local Sales"] = Number(local._sum.totalAmount || 0);
      point["Export Sales"] = Number(exp._sum.ugxEquivalent || 0);
      point["Other"] = 0;
    }

    months.push(point);
  }

  return { seriesNames, data: months };
}
