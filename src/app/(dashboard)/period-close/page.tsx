"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormModal, FormField, FormActions, apiPost } from "@/components/ui/form-modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatDate } from "@/lib/utils";

type Period = Record<string, unknown>;

export default function PeriodClosePage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(false);
  const [showYearEnd, setShowYearEnd] = useState(false);
  const [yearEndYear, setYearEndYear] = useState(new Date().getFullYear());

  const load = useCallback(() => {
    fetch(`/api/periods?year=${year}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setPeriods(res.data.periods || []);
      });
  }, [year]);

  useEffect(() => { load(); }, [load]);

  const initPeriods = async () => {
    setLoading(true);
    const res = await apiPost("/api/periods", { action: "init", year });
    setLoading(false);
    if (res.success) load();
    else alert(res.message);
  };

  const closePeriod = async (periodId: string, name: string) => {
    if (!confirm(`Close period ${name}? No further posting will be allowed.`)) return;
    setLoading(true);
    const res = await apiPost("/api/periods", { action: "close", periodId });
    setLoading(false);
    if (res.success) load();
    else alert(res.message);
  };

  const reopenPeriod = async (periodId: string, name: string) => {
    if (!confirm(`Reopen period ${name}?`)) return;
    setLoading(true);
    const res = await apiPost("/api/periods", { action: "reopen", periodId });
    setLoading(false);
    if (res.success) load();
    else alert(res.message);
  };

  const runYearEnd = async (close: () => void) => {
    if (!confirm(`Run year-end close for ${yearEndYear}? This locks all periods and posts net income to Retained Earnings (3200).`)) return;
    setLoading(true);
    const res = await apiPost("/api/periods", { action: "year-end", year: yearEndYear });
    setLoading(false);
    if (res.success) {
      alert(`Year-end complete. Net income: ${res.data?.netIncome ?? "—"}`);
      close();
      setShowYearEnd(false);
      load();
    } else alert(res.message);
  };

  const openCount = periods.filter((p) => p.status === "OPEN").length;
  const closedCount = periods.filter((p) => p.status === "CLOSED").length;
  const lockedCount = periods.filter((p) => p.status === "LOCKED").length;

  return (
    <div>
      <PageHeader
        title="Period Close"
        description="Manage fiscal periods, month-end close, and year-end roll-forward to retained earnings"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={initPeriods} disabled={loading}>Initialize Periods</Button>
            <Button onClick={() => setShowYearEnd(true)} disabled={loading}>Year-End Close</Button>
          </div>
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <Card><CardContent className="p-4"><p className="text-xs text-gray-500">Year</p><Select value={String(year)} onChange={(e) => setYear(+e.target.value)} className="mt-1">{[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}</Select></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-gray-500">Open</p><p className="text-2xl font-bold text-green-700">{openCount}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-gray-500">Closed</p><p className="text-2xl font-bold text-amber-600">{closedCount}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-gray-500">Locked</p><p className="text-2xl font-bold text-gray-700">{lockedCount}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Fiscal Periods — {year}</CardTitle></CardHeader>
        <CardContent>
          <DataTable
            columns={[
              { key: "name", header: "Period" },
              { key: "startDate", header: "Start", render: (i) => formatDate(String(i.startDate)) },
              { key: "endDate", header: "End", render: (i) => formatDate(String(i.endDate)) },
              { key: "status", header: "Status" },
              { key: "closedAt", header: "Closed", render: (i) => i.closedAt ? formatDate(String(i.closedAt)) : "—" },
              {
                key: "id",
                header: "Actions",
                render: (i) => (
                  <div className="flex gap-2">
                    {i.status === "OPEN" && (
                      <Button size="sm" variant="outline" onClick={() => closePeriod(String(i.id), String(i.name))}>Close</Button>
                    )}
                    {i.status === "CLOSED" && (
                      <Button size="sm" variant="outline" onClick={() => reopenPeriod(String(i.id), String(i.name))}>Reopen</Button>
                    )}
                    {i.status === "LOCKED" && <span className="text-xs text-gray-400">Locked</span>}
                  </div>
                ),
              },
            ]}
            data={periods}
            emptyMessage="No periods — click Initialize Periods"
          />
        </CardContent>
      </Card>

      {showYearEnd && (
        <FormModal title="Year-End Close" open onOpenChange={setShowYearEnd}>
          {({ close }) => (
            <form onSubmit={(e) => { e.preventDefault(); runYearEnd(close); }} className="space-y-3">
              <p className="text-sm text-gray-600">
                Closes all open periods, posts income/expense balances to Retained Earnings (3200), and locks the fiscal year.
              </p>
              <FormField label="Fiscal Year">
                <Input type="number" value={yearEndYear} onChange={(e) => setYearEndYear(+e.target.value)} required />
              </FormField>
              <FormActions onCancel={close} loading={loading} />
            </form>
          )}
        </FormModal>
      )}
    </div>
  );
}
