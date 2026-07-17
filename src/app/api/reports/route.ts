import { prisma } from "@/lib/prisma";
import { withAuth, parseDateRange } from "@/lib/api-middleware";
import { successResponse } from "@/lib/api-response";
import { getTrialBalance } from "@/services/accounting.service";
import { getBudgetVsActual } from "@/services/budget.service";
import {
  getProfitAndLossFromGl,
  getBalanceSheetFromGl,
  getSubledgerReconciliation,
  getCashFlowFromGl,
  getComparativeProfitAndLoss,
} from "@/services/gl.service";
import { getVatReturnReport } from "@/services/tax.service";
import { getConsolidatedTrialBalance } from "@/services/entity.service";
import { generateReportPDF } from "@/lib/pdf";

export const GET = withAuth(
  async ({ request }) => {
    const { searchParams } = new URL(request.url);
    const report = searchParams.get("report") || "profit-loss";
    const format = searchParams.get("format");
    const { startDate, endDate } = parseDateRange(searchParams);
    const periodEnd = endDate || new Date();
    const periodStart = startDate || new Date(periodEnd.getFullYear(), 0, 1);

    let data: unknown;

    switch (report) {
      case "profit-loss":
        data = await getProfitAndLossFromGl(periodStart, periodEnd);
        break;
      case "trial-balance":
        data = await getTrialBalance(periodEnd);
        break;
      case "balance-sheet":
        data = await getBalanceSheetFromGl(periodEnd);
        break;
      case "gl-reconciliation":
        data = await getSubledgerReconciliation();
        break;
      case "vat-return":
        data = await getVatReturnReport(periodStart, periodEnd);
        break;
      case "cash-flow-gl":
        data = await getCashFlowFromGl(periodStart, periodEnd);
        break;
      case "comparative-pl":
        data = await getComparativeProfitAndLoss(periodStart, periodEnd);
        break;
      case "consolidated-trial-balance":
        data = await getConsolidatedTrialBalance(periodEnd);
        break;
      case "payables-aging": {
        const payables = await prisma.payable.findMany({
          where: { status: { in: ["UNPAID", "PARTIALLY_PAID", "OVERDUE"] } },
          include: { supplier: true },
        });
        data = payables.map((p) => ({
          supplier: p.supplier.name,
          amount: Number(p.amount),
          balance: Number(p.balance),
          dueDate: p.dueDate.toISOString().split("T")[0],
          status: p.status,
        }));
        break;
      }
      case "receivables-aging": {
        const receivables = await prisma.receivable.findMany({
          where: { status: { in: ["UNPAID", "PARTIALLY_PAID", "OVERDUE"] } },
          include: { customer: true },
        });
        data = receivables.map((r) => ({
          customer: r.customer.name,
          amount: Number(r.amount),
          balance: Number(r.balance),
          dueDate: r.dueDate.toISOString().split("T")[0],
          status: r.status,
        }));
        break;
      }
      case "sales-report": {
        const dateFilter = startDate ? { gte: startDate, lte: periodEnd } : undefined;
        data = await prisma.sale.findMany({
          where: { status: "CONFIRMED", ...(dateFilter && { saleDate: dateFilter }) },
          include: { customer: true },
          orderBy: { saleDate: "desc" },
        });
        break;
      }
      case "inventory-valuation": {
        const batches = await prisma.inventoryBatch.findMany({
          where: { quantity: { gt: 0 } },
          include: { produce: true, location: true },
        });
        data = batches.map((b) => ({
          produce: b.produce.name,
          location: b.location.name,
          quantity: Number(b.quantity),
          unitCost: Number(b.unitCost),
          value: Number(b.quantity) * Number(b.unitCost),
        }));
        break;
      }
      case "budget-vs-actual":
        data = await getBudgetVsActual(searchParams.get("budgetId") || undefined);
        break;
      default:
        data = { message: "Report not found" };
    }

    if (format === "pdf") {
      let headers: string[];
      let rows: string[][];
      if (Array.isArray(data)) {
        headers = data.length > 0 ? Object.keys(data[0] as object) : [];
        rows = data.map((row: Record<string, unknown>) => Object.values(row).map((v) => String(v)));
      } else if (data && typeof data === "object") {
        const obj = data as Record<string, unknown>;
        if (report === "profit-loss" && obj.revenue !== undefined) {
          headers = ["Item", "Amount (UGX)"];
          rows = [
            ["Revenue", String(obj.revenue)],
            ["Cost of Goods Sold", String(obj.costOfGoodsSold)],
            ["Gross Profit", String(obj.grossProfit)],
            ["Expenses", String(obj.expenses)],
            ["Net Profit", String(obj.netProfit)],
          ];
        } else if (report === "gl-reconciliation" && Array.isArray(obj.rows)) {
          headers = ["Subledger", "GL Account", "Subledger Balance", "GL Balance", "Variance"];
          rows = (obj.rows as Record<string, unknown>[]).map((r) => [
            String(r.subledger),
            String(r.glAccount),
            String(r.subledgerBalance),
            String(r.glBalance),
            String(r.variance),
          ]);
        } else {
          headers = ["Item", "Amount (UGX)"];
          rows = Object.entries(obj)
            .filter(([k, v]) => !["message", "source", "detail", "rows", "totals", "assets", "liabilities", "equity", "fromDate", "toDate", "asOfDate", "reconciledAt", "isBalanced"].includes(k) && typeof v === "number")
            .map(([k, v]) => [k.replace(/([A-Z])/g, " $1").trim(), String(v)]);
        }
      } else {
        headers = ["Report"];
        rows = [["No data"]];
      }
      const pdf = generateReportPDF(report.replace(/-/g, " ").toUpperCase(), headers, rows);
      return new Response(new Uint8Array(pdf), {
        headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${report}.pdf"` },
      });
    }

    if (format === "json-export") {
      return successResponse({ report, data, exportedAt: new Date().toISOString() });
    }

    return successResponse(data);
  },
  { module: "reports", action: "read" }
);
