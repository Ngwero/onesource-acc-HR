"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, StatusBadge, formatCurrency } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { FormModal, FormField, FormActions, apiPost } from "@/components/ui/form-modal";
import { Button } from "@/components/ui/button";

export default function FixedAssetsPage() {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "", category: "", purchaseDate: "", purchaseCost: 0, salvageValue: 0, usefulLifeMonths: 60,
  });

  const load = useCallback(() => {
    fetch("/api/xero?module=fixed-assets").then((r) => r.json()).then((res) => { if (res.success) setItems(res.data); });
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (close: () => void) => {
    setLoading(true);
    const res = await apiPost("/api/xero", { module: "fixed-assets", ...form });
    setLoading(false);
    if (res.success) { load(); close(); setShowForm(false); }
    else alert(res.message);
  };

  const runDepreciation = async () => {
    setLoading(true);
    const res = await apiPost("/api/xero", { module: "run-depreciation" });
    setLoading(false);
    if (res.success) { alert(res.message); load(); }
    else alert(res.message);
  };

  return (
    <div>
      <PageHeader title="Fixed Assets" description="Asset register with depreciation tracking" actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={runDepreciation} disabled={loading}>Run Depreciation</Button>
          <Button onClick={() => setShowForm(true)}>Register Asset</Button>
        </div>
      } />

      {showForm && (
        <FormModal title="Register Fixed Asset" open onOpenChange={setShowForm}>
          {({ close }) => (
            <form onSubmit={(e) => { e.preventDefault(); handleCreate(close); }} className="space-y-3">
              <FormField label="Asset Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></FormField>
              <FormField label="Category"><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required placeholder="Vehicles, Equipment, Buildings" /></FormField>
              <FormField label="Purchase Date"><Input type="date" value={form.purchaseDate} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} required /></FormField>
              <FormField label="Purchase Cost"><Input type="number" value={form.purchaseCost} onChange={(e) => setForm({ ...form, purchaseCost: +e.target.value })} required /></FormField>
              <FormField label="Salvage Value"><Input type="number" value={form.salvageValue} onChange={(e) => setForm({ ...form, salvageValue: +e.target.value })} /></FormField>
              <FormField label="Useful Life (months)"><Input type="number" value={form.usefulLifeMonths} onChange={(e) => setForm({ ...form, usefulLifeMonths: +e.target.value })} required /></FormField>
              <FormActions onCancel={close} loading={loading} />
            </form>
          )}
        </FormModal>
      )}

      <DataTable columns={[
        { key: "assetNumber", header: "Asset #" },
        { key: "name", header: "Name" },
        { key: "category", header: "Category" },
        { key: "purchaseCost", header: "Cost", render: (i) => formatCurrency(Number(i.purchaseCost)) },
        { key: "accumulatedDepreciation", header: "Accum. Dep.", render: (i) => formatCurrency(Number(i.accumulatedDepreciation)) },
        { key: "bookValue", header: "Book Value", render: (i) => formatCurrency(Number(i.bookValue)) },
        { key: "status", header: "Status", render: (i) => <StatusBadge status={String(i.status)} /> },
      ]} data={items} />
    </div>
  );
}
