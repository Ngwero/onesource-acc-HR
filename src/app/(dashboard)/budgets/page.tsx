"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, formatCurrency } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FormModal, FormField, FormActions, apiPost } from "@/components/ui/form-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReportTable } from "@/components/ui/report-table";

export default function BudgetsPage() {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [accounts, setAccounts] = useState<Record<string, unknown>[]>([]);
  const [vsActual, setVsActual] = useState<Record<string, unknown>[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "", fiscalYear: new Date().getFullYear(), startDate: "", endDate: "",
    accountId: "", amount: 0, period: "ANNUAL",
  });

  const load = useCallback(() => {
    Promise.all([
      fetch("/api/xero?module=budgets").then((r) => r.json()),
      fetch("/api/ledger?view=accounts").then((r) => r.json()),
      fetch("/api/xero?module=budget-vs-actual").then((r) => r.json()),
    ]).then(([b, a, va]) => {
      if (b.success) setItems(b.data);
      if (a.success) setAccounts(a.data || []);
      if (va.success) setVsActual(va.data || []);
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (close: () => void) => {
    setLoading(true);
    const res = await apiPost("/api/xero", {
      module: "budgets",
      name: form.name,
      fiscalYear: form.fiscalYear,
      startDate: form.startDate,
      endDate: form.endDate,
      lines: [{ accountId: form.accountId, amount: form.amount, period: form.period }],
    });
    setLoading(false);
    if (res.success) { load(); close(); setShowForm(false); }
    else alert(res.message);
  };

  return (
    <div>
      <PageHeader title="Budgets" description="Budget vs actual reporting by account and period" actions={
        <Button onClick={() => setShowForm(true)}>New Budget</Button>
      } />

      {showForm && (
        <FormModal title="New Budget" open onOpenChange={setShowForm}>
          {({ close }) => (
            <form onSubmit={(e) => { e.preventDefault(); handleCreate(close); }} className="space-y-3">
              <FormField label="Budget Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></FormField>
              <FormField label="Fiscal Year"><Input type="number" value={form.fiscalYear} onChange={(e) => setForm({ ...form, fiscalYear: +e.target.value })} /></FormField>
              <FormField label="Start Date"><Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required /></FormField>
              <FormField label="End Date"><Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} required /></FormField>
              <FormField label="Account">
                <Select value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })} required>
                  <option value="">Select account</option>
                  {accounts.map((a) => <option key={String(a.id)} value={String(a.id)}>{String(a.code)} — {String(a.name)}</option>)}
                </Select>
              </FormField>
              <FormField label="Budget Amount"><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: +e.target.value })} required /></FormField>
              <FormField label="Period">
                <Select value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })}>
                  <option value="ANNUAL">Annual</option>
                  <option value="QUARTERLY">Quarterly</option>
                  <option value="MONTHLY">Monthly</option>
                </Select>
              </FormField>
              <FormActions onCancel={close} loading={loading} />
            </form>
          )}
        </FormModal>
      )}

      <DataTable columns={[
        { key: "name", header: "Budget Name" },
        { key: "fiscalYear", header: "Fiscal Year" },
        { key: "startDate", header: "Start" },
        { key: "endDate", header: "End" },
        { key: "lines", header: "Lines", render: (i) => String((i.lines as unknown[])?.length || 0) },
      ]} data={items} />

      {vsActual.length > 0 && (
        <Card className="mt-6">
          <CardHeader><CardTitle>Budget vs Actual</CardTitle></CardHeader>
          <CardContent><ReportTable data={vsActual} /></CardContent>
        </Card>
      )}
    </div>
  );
}
