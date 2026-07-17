"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, StatusBadge, formatCurrency } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FormModal, FormField, FormActions, apiPost } from "@/components/ui/form-modal";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { ModuleActions } from "@/lib/xero-actions";

export default function QuotesPage() {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [customers, setCustomers] = useState<Record<string, unknown>[]>([]);
  const [taxCodes, setTaxCodes] = useState<Record<string, unknown>[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    customerId: "", expiryDate: "", description: "", quantity: 1, unitPrice: 0, taxCodeId: "",
  });

  const load = useCallback(() => {
    Promise.all([
      fetch("/api/xero?module=quotes").then((r) => r.json()),
      fetch("/api/customers").then((r) => r.json()),
      fetch("/api/xero?module=tax").then((r) => r.json()),
    ]).then(([q, c, t]) => {
      if (q.success) setItems(q.data);
      if (c.success) setCustomers(c.data.items || []);
      if (t.success) setTaxCodes(t.data);
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (close: () => void) => {
    setLoading(true);
    const res = await apiPost("/api/xero", {
      module: "quotes",
      customerId: form.customerId,
      expiryDate: form.expiryDate,
      taxCodeId: form.taxCodeId || undefined,
      items: [{ description: form.description, quantity: form.quantity, unitPrice: form.unitPrice }],
    });
    setLoading(false);
    if (res.success) { load(); close(); setShowForm(false); }
    else alert(res.message);
  };

  const handleConvert = async (quoteId: string) => {
    const res = await apiPost("/api/xero", { module: "quotes-convert", quoteId });
    if (res.success) { alert("Converted to sale"); load(); }
    else alert(res.message);
  };

  return (
    <div>
      <PageHeader title="Quotes" description="Create and convert quotes to sales/invoices" actions={
        <Button onClick={() => setShowForm(true)}>New Quote</Button>
      } />

      {showForm && (
        <FormModal title="New Quote" open onOpenChange={setShowForm}>
          {({ close }) => (
            <form onSubmit={(e) => { e.preventDefault(); handleCreate(close); }} className="space-y-3">
              <FormField label="Customer">
                <Select value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} required>
                  <option value="">Select customer</option>
                  {customers.map((c) => <option key={String(c.id)} value={String(c.id)}>{String(c.name)}</option>)}
                </Select>
              </FormField>
              <FormField label="Expiry Date"><Input type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} required /></FormField>
              <FormField label="Description"><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required /></FormField>
              <FormField label="Quantity"><Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: +e.target.value })} /></FormField>
              <FormField label="Unit Price"><Input type="number" value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: +e.target.value })} /></FormField>
              <FormField label="Tax Code">
                <Select value={form.taxCodeId} onChange={(e) => setForm({ ...form, taxCodeId: e.target.value })}>
                  <option value="">No tax</option>
                  {taxCodes.map((t) => <option key={String(t.id)} value={String(t.id)}>{String(t.name)}</option>)}
                </Select>
              </FormField>
              <FormActions onCancel={close} loading={loading} />
            </form>
          )}
        </FormModal>
      )}

      <DataTable columns={[
        { key: "quoteNumber", header: "Quote #" },
        { key: "customer", header: "Customer", render: (i) => String((i.customer as { name?: string })?.name || "-") },
        { key: "date", header: "Date", render: (i) => formatDate(String(i.date)) },
        { key: "total", header: "Total", render: (i) => formatCurrency(Number(i.total)) },
        { key: "status", header: "Status", render: (i) => <StatusBadge status={String(i.status)} /> },
        { key: "id", header: "Actions", render: (i) => (
          <div className="flex gap-1">
            {i.status !== "CONVERTED" && <Button size="sm" onClick={() => handleConvert(String(i.id))}>Convert</Button>}
            {i.status !== "CONVERTED" && <ModuleActions module="quotes" id={String(i.id)} onDone={load} />}
          </div>
        ) },
      ]} data={items} />
    </div>
  );
}
