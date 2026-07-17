"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, StatusBadge, formatCurrency } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FormModal, FormField, FormActions, apiPost } from "@/components/ui/form-modal";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

type LineItem = { produceId: string; quantity: number; unitPrice: number; grade: string };

export default function LocalSalesPage() {
  const searchParams = useSearchParams();
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [customers, setCustomers] = useState<Record<string, unknown>[]>([]);
  const [produce, setProduce] = useState<Record<string, unknown>[]>([]);
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    customerId: "", saleDate: "", paymentMethod: "CASH", discount: 0,
    lines: [{ produceId: "", quantity: 0, unitPrice: 0, grade: "A" }] as LineItem[],
  });

  const load = useCallback(() => {
    Promise.all([
      fetch(`/api/sales?limit=100`).then((r) => r.json()),
      fetch("/api/customers?limit=100").then((r) => r.json()),
      fetch("/api/produce?limit=100").then((r) => r.json()),
    ]).then(([s, c, p]) => {
      if (s.success) {
        const all = s.data.items || [];
        setItems(search ? all.filter((i: Record<string, unknown>) => String(i.saleNumber).toLowerCase().includes(search.toLowerCase())) : all);
      }
      if (c.success) setCustomers(c.data.items || []);
      if (p.success) setProduce(p.data.items || []);
    });
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (close: () => void) => {
    setLoading(true);
    const res = await apiPost("/api/sales", {
      customerId: form.customerId,
      saleDate: form.saleDate || undefined,
      paymentMethod: form.paymentMethod,
      discount: form.discount,
      items: form.lines.filter((l) => l.produceId && l.quantity > 0),
    });
    setLoading(false);
    if (res.success) { load(); close(); setShowForm(false); }
    else alert(res.message);
  };

  const handleConfirm = async (id: string) => {
    const res = await fetch(`/api/sales/${id}/confirm`, { method: "POST" }).then((r) => r.json());
    if (res.success) { alert("Sale confirmed — stock deducted, receivable created if credit"); load(); }
    else alert(res.message);
  };

  const updateLine = (i: number, patch: Partial<LineItem>) => {
    const lines = [...form.lines];
    lines[i] = { ...lines[i], ...patch };
    setForm({ ...form, lines });
  };

  return (
    <div>
      <PageHeader title="Local Sales" description="Manage local produce sales and invoices" actions={
        <Button onClick={() => setShowForm(true)}>New Sale</Button>
      } />
      <div className="mb-4 flex gap-2">
        <Input placeholder="Search sales..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
        <Button variant="outline" onClick={() => setSearch("")}>Clear</Button>
      </div>

      {showForm && (
        <FormModal title="New Local Sale" open onOpenChange={setShowForm}>
          {({ close }) => (
            <form onSubmit={(e) => { e.preventDefault(); handleCreate(close); }} className="space-y-3">
              <FormField label="Customer">
                <Select value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} required>
                  <option value="">Select customer</option>
                  {customers.map((c) => <option key={String(c.id)} value={String(c.id)}>{String(c.name)}</option>)}
                </Select>
              </FormField>
              <FormField label="Sale Date"><Input type="date" value={form.saleDate} onChange={(e) => setForm({ ...form, saleDate: e.target.value })} /></FormField>
              <FormField label="Payment Method">
                <Select value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>
                  <option value="CASH">Cash</option><option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="MOBILE_MONEY">Mobile Money</option><option value="CHEQUE">Cheque</option>
                </Select>
              </FormField>
              {form.lines.map((line, i) => (
                <div key={i} className="grid gap-2 rounded border border-green-100 p-3 sm:grid-cols-4">
                  <Select value={line.produceId} onChange={(e) => updateLine(i, { produceId: e.target.value })} required>
                    <option value="">Produce</option>
                    {produce.map((p) => <option key={String(p.id)} value={String(p.id)}>{String(p.name)}</option>)}
                  </Select>
                  <Input type="number" placeholder="Qty" value={line.quantity || ""} onChange={(e) => updateLine(i, { quantity: +e.target.value })} />
                  <Input type="number" placeholder="Unit price" value={line.unitPrice || ""} onChange={(e) => updateLine(i, { unitPrice: +e.target.value })} />
                  <Select value={line.grade} onChange={(e) => updateLine(i, { grade: e.target.value })}>
                    <option value="A">A</option><option value="B">B</option>
                  </Select>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => setForm({ ...form, lines: [...form.lines, { produceId: "", quantity: 0, unitPrice: 0, grade: "A" }] })}>+ Add line</Button>
              <FormField label="Discount"><Input type="number" value={form.discount} onChange={(e) => setForm({ ...form, discount: +e.target.value })} /></FormField>
              <FormActions onCancel={close} loading={loading} />
            </form>
          )}
        </FormModal>
      )}

      <DataTable columns={[
        { key: "saleNumber", header: "Sale #" },
        { key: "saleDate", header: "Date", render: (i) => formatDate(String(i.saleDate)) },
        { key: "customer", header: "Customer", render: (i) => String((i.customer as { name?: string })?.name || "-") },
        { key: "totalAmount", header: "Amount", render: (i) => formatCurrency(Number(i.totalAmount)) },
        { key: "paymentStatus", header: "Payment", render: (i) => <StatusBadge status={String(i.paymentStatus)} /> },
        { key: "status", header: "Status", render: (i) => <StatusBadge status={String(i.status)} /> },
        { key: "id", header: "Actions", render: (i) => i.status === "DRAFT" ? (
          <Button size="sm" onClick={() => handleConfirm(String(i.id))}>Confirm</Button>
        ) : null },
      ]} data={items} />
    </div>
  );
}
