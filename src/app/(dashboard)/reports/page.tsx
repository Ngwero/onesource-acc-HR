"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { exportToExcel, exportToCSV } from "@/lib/export";
import { ReportTable, ReportObjectView } from "@/components/ui/report-table";
import { PageLoader } from "@/components/ui/page-loader";

const REPORTS = [
  { id: "profit-loss", name: "Profit & Loss (GL)", isObject: true },
  { id: "comparative-pl", name: "Comparative P&L (GL)", isObject: true },
  { id: "cash-flow-gl", name: "Cash Flow Statement (GL)", isObject: true },
  { id: "consolidated-trial-balance", name: "Consolidated Trial Balance", isObject: true },
  { id: "trial-balance", name: "Trial Balance (GL)" },
  { id: "balance-sheet", name: "Balance Sheet (GL)", isObject: true },
  { id: "gl-reconciliation", name: "Subledger vs GL Reconciliation" },
  { id: "vat-return", name: "VAT Return (GL)", isObject: true },
  { id: "payables-aging", name: "Accounts Payable Aging" },
  { id: "receivables-aging", name: "Accounts Receivable Aging" },
  { id: "sales-report", name: "Sales Report" },
  { id: "inventory-valuation", name: "Inventory Valuation" },
  { id: "budget-vs-actual", name: "Budget vs Actual" },
];

export default function ReportsPage() {
  const [pl, setPl] = useState<Record<string, number> | null>(null);
  const [plLoading, setPlLoading] = useState(true);
  const [activeReport, setActiveReport] = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportData, setReportData] = useState<Record<string, unknown>[]>([]);
  const [reportObject, setReportObject] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    setPlLoading(true);
    fetch("/api/reports?report=profit-loss&filter=year")
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          const d = res.data as Record<string, number>;
          setPl({
            revenue: d.revenue,
            costOfGoodsSold: d.costOfGoodsSold,
            grossProfit: d.grossProfit,
            expenses: d.expenses,
            netProfit: d.netProfit,
          });
        }
      })
      .finally(() => setPlLoading(false));
  }, []);

  const loadReport = async (reportId: string) => {
    setActiveReport(reportId);
    setReportLoading(true);
    setReportData([]);
    setReportObject(null);
    const meta = REPORTS.find((r) => r.id === reportId);
    try {
      const res = await fetch(`/api/reports?report=${reportId}&filter=year`).then((r) => r.json());
      if (res.success) {
        if (meta?.isObject && !Array.isArray(res.data)) {
          setReportObject(res.data as Record<string, unknown>);
          setReportData([]);
        } else {
          setReportObject(null);
          setReportData(Array.isArray(res.data) ? res.data : [res.data]);
        }
      }
    } finally {
      setReportLoading(false);
    }
  };

  const exportReport = async (reportId: string, format: "pdf" | "excel" | "csv") => {
    if (format === "pdf") {
      window.open(`/api/reports?report=${reportId}&format=pdf&filter=year`, "_blank");
      return;
    }
    const res = await fetch(`/api/reports?report=${reportId}&filter=year`).then((r) => r.json());
    if (!res.success) return;
    const data = Array.isArray(res.data) ? res.data : [res.data];
    if (data.length === 0) return;
    const headers = Object.keys(data[0] as object);
    const rows = data.map((row: Record<string, unknown>) => headers.map((h) => String(row[h] ?? "")));
    if (format === "excel") exportToExcel(reportId, headers, rows);
    else exportToCSV(reportId, headers, rows);
  };

  return (
    <div>
      <PageHeader title="Reports" description="Financial and operational reports with PDF, Excel, and CSV export" />

      {plLoading ? (
        <Card className="mb-6">
          <CardContent className="p-2">
            <PageLoader compact label="Loading P&L summary…" />
          </CardContent>
        </Card>
      ) : pl ? (
        <Card className="mb-6">
          <CardHeader><CardTitle>Profit & Loss (GL — This Year)</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Revenue</span><span>{formatCurrency(pl.revenue || 0)}</span></div>
            <div className="flex justify-between"><span>Cost of Goods Sold</span><span>{formatCurrency(pl.costOfGoodsSold || 0)}</span></div>
            <div className="flex justify-between font-semibold text-green-700"><span>Gross Profit</span><span>{formatCurrency(pl.grossProfit || 0)}</span></div>
            <div className="flex justify-between"><span>Expenses</span><span>{formatCurrency(pl.expenses || 0)}</span></div>
            <div className="flex justify-between border-t pt-2 font-bold"><span>Net Profit</span><span className="text-green-700">{formatCurrency(pl.netProfit || 0)}</span></div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((r) => (
          <Card key={r.id} className="cursor-pointer hover:border-green-300" onClick={() => loadReport(r.id)}>
            <CardContent className="p-4">
              <p className="font-medium text-green-900">{r.name}</p>
              <div className="mt-2 flex gap-1" onClick={(e) => e.stopPropagation()}>
                <Button size="sm" variant="outline" onClick={() => exportReport(r.id, "pdf")}>PDF</Button>
                <Button size="sm" variant="outline" onClick={() => exportReport(r.id, "excel")}>Excel</Button>
                <Button size="sm" variant="outline" onClick={() => exportReport(r.id, "csv")}>CSV</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {activeReport && reportLoading && (
        <Card className="mt-6">
          <CardContent className="p-2">
            <PageLoader compact label="Loading report…" />
          </CardContent>
        </Card>
      )}

      {activeReport && !reportLoading && (reportData.length > 0 || reportObject) && (
        <Card className="mt-6">
          <CardHeader><CardTitle>{REPORTS.find((r) => r.id === activeReport)?.name}</CardTitle></CardHeader>
          <CardContent>
            {reportObject ? (
              activeReport === "balance-sheet" ? (
                <div className="grid gap-6 md:grid-cols-3">
                  {(["assets", "liabilities", "equity"] as const).map((section) => (
                    <div key={section}>
                      <h3 className="mb-2 font-semibold capitalize">{section}</h3>
                      <ReportTable data={(reportObject[section] as Record<string, unknown>[]) || []} />
                    </div>
                  ))}
                </div>
              ) : activeReport === "gl-reconciliation" ? (
                <div>
                  <p className={`mb-3 text-sm ${reportObject.isBalanced ? "text-green-700" : "text-amber-700"}`}>
                    {reportObject.isBalanced ? "Subledgers match GL accounts ✓" : "Variances detected — review and sync balances on Ledger page"}
                  </p>
                  <ReportTable data={(reportObject.rows as Record<string, unknown>[]) || []} />
                </div>
              ) : activeReport === "vat-return" ? (
                <div>
                  <div className="mb-4 grid gap-3 md:grid-cols-5">
                    {(["openingBalance", "outputVat", "inputVat", "netVatPayable", "closingBalance"] as const).map((k) => (
                      <div key={k} className="rounded border p-3">
                        <p className="text-xs text-gray-500 capitalize">{k.replace(/([A-Z])/g, " $1")}</p>
                        <p className="font-semibold">{formatCurrency(Number(reportObject[k]))}</p>
                      </div>
                    ))}
                  </div>
                  <ReportTable data={(reportObject.detail as Record<string, unknown>[]) || []} />
                </div>
              ) : activeReport === "consolidated-trial-balance" ? (
                <div>
                  <p className="mb-3 text-sm text-gray-600">
                    Entities: {((reportObject.entities as { code: string; name: string }[]) || []).map((e) => e.name).join(", ")}
                  </p>
                  <ReportTable data={(reportObject.rows as Record<string, unknown>[]) || []} />
                </div>
              ) : activeReport === "comparative-pl" ? (
                <div className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                      <CardHeader><CardTitle className="text-base">Current Period</CardTitle></CardHeader>
                      <CardContent>
                        <ReportObjectView data={(reportObject.current as Record<string, unknown>) || {}} />
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader><CardTitle className="text-base">Prior Period</CardTitle></CardHeader>
                      <CardContent>
                        <ReportObjectView data={(reportObject.prior as Record<string, unknown>) || {}} />
                      </CardContent>
                    </Card>
                  </div>
                  <div>
                    <h3 className="mb-2 font-semibold">Variance</h3>
                    <ReportTable
                      data={Object.entries((reportObject.variance as Record<string, { amount: number; percent: number | null }>) || {}).map(([metric, v]) => ({
                        metric,
                        amount: v.amount,
                        percent: v.percent != null ? `${v.percent.toFixed(1)}%` : "-",
                      }))}
                    />
                  </div>
                </div>
              ) : activeReport === "cash-flow-gl" ? (
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-4">
                    {[
                      ["Net income", (reportObject.operating as { netIncome?: number })?.netIncome],
                      ["Operating cash", (reportObject.operating as { netCashFromOperating?: number })?.netCashFromOperating],
                      ["Investing cash", (reportObject.investing as { netCashFromInvesting?: number })?.netCashFromInvesting],
                      ["Net change in cash", reportObject.netChangeInCash],
                    ].map(([label, value]) => (
                      <div key={String(label)} className="rounded border p-3">
                        <p className="text-xs text-gray-500">{String(label)}</p>
                        <p className="font-semibold">{formatCurrency(Number(value || 0))}</p>
                      </div>
                    ))}
                  </div>
                  <ReportObjectView data={reportObject} />
                </div>
              ) : (
                <ReportObjectView data={reportObject} />
              )
            ) : (
              <ReportTable data={reportData} />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
