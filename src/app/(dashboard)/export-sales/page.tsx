"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, StatusBadge, formatCurrency } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FormModal, FormField, FormActions, apiPost } from "@/components/ui/form-modal";
import { Button } from "@/components/ui/button";

export default function ExportSalesPage() {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [customers, setCustomers] = useState<Record<string, unknown>[]>([]);
  const [produce, setProduce] = useState<Record<string, unknown>[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    customerId: "", produceId: "", quantity: 0, currency: "USD", exchangeRate: 3800, unitExportPrice: 0, paymentTerms: 30,
  });

  const load = useCallback(() => {
    Promise.all([
      fetch("/api/export-sales").then((r) => r.json()),
      fetch("/api/customers").then((r) => r.json()),
      fetch("/api/produce").then((r) => r.json()),
    ]).then(([e, c, p]) => {
      if (e.success) setItems(e.data);
      if (c.success) setCustomers(c.data.items || []);
      if (p.success) setProduce(p.data.items || []);
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (close: () => void) => {
    setLoading(true);
    const res = await apiPost("/api/export-sales", form);
    setLoading(false);
    if (res.success) { load(); close(); setShowForm(false); }
    else alert(res.message);
  };

  const handleConfirm = async (id: string) => {
    const res = await apiPost("/api/export-sales", { action: "confirm", id });
    if (res.success) { alert("Export sale confirmed — stock deducted, receivable created"); load(); }
    else alert(res.message);
  };

  return (
    <div>
      <PageHeader title="Export Sales" description="International sales with multi-currency support" actions={
        <Button onClick={() => setShowForm(true)}>New Export Sale</Button>
      } />

      {showForm && (
        <FormModal title="New Export Sale" open onOpenChange={setShowForm}>
          {({ close }) => (
            <form onSubmit={(e) => { e.preventDefault(); handleCreate(close); }} className="space-y-3">
              <FormField label="Customer">
                <Select value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} required>
                  <option value="">Select customer</option>
                  {customers.map((c) => <option key={String(c.id)} value={String(c.id)}>{String(c.name)}</option>)}
                </Select>
              </FormField>
              <FormField label="Produce">
                <Select value={form.produceId} onChange={(e) => setForm({ ...form, produceId: e.target.value })} required>
                  <option value="">Select produce</option>
                  {produce.map((p) => <option key={String(p.id)} value={String(p.id)}>{String(p.name)}</option>)}
                </Select>
              </FormField>
              <FormField label="Quantity (kg)"><Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: +e.target.value })} required /></FormField>
              <FormField label="Currency">
                <Select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                  <option value="USD">USD</option><option value="EUR">EUR</option><option value="GBP">GBP</option><option value="KES">KES</option>
                </Select>
              </FormField>
              <FormField label="Exchange Rate"><Input type="number" value={form.exchangeRate} onChange={(e) => setForm({ ...form, exchangeRate: +e.target.value })} /></FormField>
              <FormField label="Unit Export Price"><Input type="number" step="0.01" value={form.unitExportPrice} onChange={(e) => setForm({ ...form, unitExportPrice: +e.target.value })} required /></FormField>
              <FormActions onCancel={close} loading={loading} />
            </form>
          )}
        </FormModal>
      )}

      <DataTable columns={[
        { key: "exportSaleNumber", header: "Sale #" },
        { key: "customer", header: "Customer", render: (i) => String((i.customer as { name?: string })?.name || "-") },
        { key: "produce", header: "Produce", render: (i) => String((i.produce as { name?: string })?.name || "-") },
        { key: "quantity", header: "Qty" },
        { key: "totalForeignAmount", header: "Foreign", render: (i) => `${i.currency} ${Number(i.totalForeignAmount).toLocaleString()}` },
        { key: "ugxEquivalent", header: "UGX", render: (i) => formatCurrency(Number(i.ugxEquivalent)) },
        { key: "status", header: "Status", render: (i) => <StatusBadge status={String(i.status)} /> },
        { key: "id", header: "Action", render: (i) => i.status === "DRAFT" ? <Button size="sm" onClick={() => handleConfirm(String(i.id))}>Confirm</Button> : null },
      ]} data={items} />
    </div>
  );
}
