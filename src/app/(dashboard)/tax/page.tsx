"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, formatCurrency } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { FormModal, FormField, FormActions, apiPost } from "@/components/ui/form-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ModuleActions } from "@/lib/xero-actions";

export default function TaxPage() {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [vatReturn, setVatReturn] = useState<Record<string, unknown> | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", rate: 0, description: "" });
  const [vatFrom, setVatFrom] = useState(`${new Date().getFullYear()}-01-01`);
  const [vatTo, setVatTo] = useState(new Date().toISOString().split("T")[0]);

  const load = useCallback(() => {
    fetch("/api/xero?module=tax").then((r) => r.json()).then((res) => { if (res.success) setItems(res.data); });
  }, []);

  const loadVatReturn = useCallback(() => {
    fetch(`/api/reports?report=vat-return&from=${vatFrom}&to=${vatTo}`)
      .then((r) => r.json())
      .then((res) => { if (res.success) setVatReturn(res.data); });
  }, [vatFrom, vatTo]);

  useEffect(() => { load(); loadVatReturn(); }, [load, loadVatReturn]);

  const handleCreate = async (close: () => void) => {
    setLoading(true);
    const res = await apiPost("/api/xero", { module: "tax", ...form });
    setLoading(false);
    if (res.success) { load(); close(); setShowForm(false); }
    else alert(res.message);
  };

  return (
    <div>
      <PageHeader title="Tax / VAT" description="Tax codes, VAT return from GL account 2300, and filing summary" actions={
        <Button onClick={() => setShowForm(true)}>Add Tax Code</Button>
      } />

      <Card className="mb-6">
        <CardHeader><CardTitle className="text-lg">VAT Return (GL — Account 2300)</CardTitle></CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <FormField label="From"><Input type="date" value={vatFrom} onChange={(e) => setVatFrom(e.target.value)} /></FormField>
            <FormField label="To"><Input type="date" value={vatTo} onChange={(e) => setVatTo(e.target.value)} /></FormField>
            <Button variant="outline" onClick={loadVatReturn}>Refresh</Button>
          </div>
          {vatReturn && (
            <>
              <div className="mb-4 grid gap-3 md:grid-cols-5">
                <div className="rounded border p-3"><p className="text-xs text-gray-500">Opening</p><p className="font-semibold">{formatCurrency(Number(vatReturn.openingBalance))}</p></div>
                <div className="rounded border p-3"><p className="text-xs text-gray-500">Output VAT</p><p className="font-semibold text-green-700">{formatCurrency(Number(vatReturn.outputVat))}</p></div>
                <div className="rounded border p-3"><p className="text-xs text-gray-500">Input VAT</p><p className="font-semibold text-blue-700">{formatCurrency(Number(vatReturn.inputVat))}</p></div>
                <div className="rounded border p-3"><p className="text-xs text-gray-500">Net Payable</p><p className="font-semibold">{formatCurrency(Number(vatReturn.netVatPayable))}</p></div>
                <div className="rounded border p-3"><p className="text-xs text-gray-500">Closing</p><p className="font-semibold">{formatCurrency(Number(vatReturn.closingBalance))}</p></div>
              </div>
              <DataTable columns={[
                { key: "date", header: "Date" },
                { key: "journalNumber", header: "Journal" },
                { key: "type", header: "Type" },
                { key: "description", header: "Description" },
                { key: "amount", header: "Amount", render: (i) => formatCurrency(Number(i.amount)) },
              ]} data={(vatReturn.detail as Record<string, unknown>[]) || []} emptyMessage="No VAT activity in period" />
            </>
          )}
        </CardContent>
      </Card>

      {showForm && (
        <FormModal title="New Tax Code" open={showForm} onOpenChange={setShowForm}>
          {({ close }) => (
            <form onSubmit={(e) => { e.preventDefault(); handleCreate(close); }} className="space-y-3">
              <FormField label="Code"><Input value={form.code} onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))} required placeholder="VAT18" /></FormField>
              <FormField label="Name"><Input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} required placeholder="VAT 18%" /></FormField>
              <FormField label="Rate (%)"><Input type="number" step="0.01" value={form.rate} onChange={(e) => setForm((prev) => ({ ...prev, rate: +e.target.value }))} required /></FormField>
              <FormField label="Description"><Input value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} /></FormField>
              <FormActions onCancel={close} loading={loading} />
            </form>
          )}
        </FormModal>
      )}

      <h2 className="mb-3 text-lg font-semibold">Tax Codes</h2>
      <DataTable columns={[
        { key: "code", header: "Code" },
        { key: "name", header: "Name" },
        { key: "rate", header: "Rate %", render: (i) => `${i.rate}%` },
        { key: "description", header: "Description" },
        { key: "id", header: "Actions", render: (i) => <ModuleActions module="tax" id={String(i.id)} onDone={load} label="Deactivate" /> },
      ]} data={items} />
    </div>
  );
}
