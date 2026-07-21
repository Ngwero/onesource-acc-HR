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

export default function PurchasesPage() {
  const searchParams = useSearchParams();
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [suppliers, setSuppliers] = useState<Record<string, unknown>[]>([]);
  const [produce, setProduce] = useState<Record<string, unknown>[]>([]);
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    supplierId: "", purchaseDate: "", transportCost: 0, loadingCost: 0, notes: "",
    lines: [{ produceId: "", quantity: 0, unitPrice: 0, grade: "A" }] as LineItem[],
  });

  const load = useCallback(() => {
    const params = new URLSearchParams({ search, limit: "100" });
    Promise.all([
      fetch(`/api/purchases?${params}`).then((r) => r.json()),
      fetch("/api/suppliers?limit=100").then((r) => r.json()),
      fetch("/api/produce?limit=100").then((r) => r.json()),
    ]).then(([p, s, pr]) => {
      if (p.success) setItems(p.data.items || []);
      if (s.success) setSuppliers(s.data.items || []);
      if (pr.success) setProduce(pr.data.items || []);
    });
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (close: () => void) => {
    setLoading(true);
    const res = await apiPost("/api/purchases", {
      supplierId: form.supplierId,
      purchaseDate: form.purchaseDate || undefined,
      transportCost: form.transportCost,
      loadingCost: form.loadingCost,
      notes: form.notes,
      items: form.lines.filter((l) => l.produceId && l.quantity > 0),
    });
    setLoading(false);
    if (res.success) { load(); close(); setShowForm(false); }
    else alert(res.message);
  };

  const handleConfirm = async (id: string) => {
    const res = await fetch(`/api/purchases/${id}/confirm`, { method: "POST" }).then((r) => r.json());
    if (res.success) { alert("Purchase confirmed — stock received, payable created"); load(); }
    else alert(res.message);
  };

  const updateLine = (i: number, patch: Partial<LineItem>) => {
    setForm((prev) => {
      const lines = [...prev.lines];
      lines[i] = { ...lines[i], ...patch };
      return { ...prev, lines };
    });
  };

  return (
    <div>
      <PageHeader title="Purchases" description="Record produce purchases from suppliers" actions={
        <Button onClick={() => setShowForm(true)}>New Purchase</Button>
      } />
      <div className="mb-4 flex gap-2">
        <Input placeholder="Search purchases..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
        <Button variant="outline" onClick={() => setSearch("")}>Clear</Button>
      </div>

      {showForm && (
        <FormModal title="New Purchase" open={showForm} onOpenChange={setShowForm}>
          {({ close }) => (
            <form onSubmit={(e) => { e.preventDefault(); handleCreate(close); }} className="space-y-3">
              <FormField label="Supplier">
                <Select value={form.supplierId} onChange={(e) => setForm((prev) => ({ ...prev, supplierId: e.target.value }))} required>
                  <option value="">Select supplier</option>
                  {suppliers.map((s) => <option key={String(s.id)} value={String(s.id)}>{String(s.name)}</option>)}
                </Select>
              </FormField>
              <FormField label="Purchase Date"><Input type="date" value={form.purchaseDate} onChange={(e) => setForm((prev) => ({ ...prev, purchaseDate: e.target.value }))} /></FormField>
              {form.lines.map((line, i) => (
                <div key={i} className="grid gap-2 rounded border border-green-100 p-3 sm:grid-cols-4">
                  <Select value={line.produceId} onChange={(e) => updateLine(i, { produceId: e.target.value })} required>
                    <option value="">Produce</option>
                    {produce.map((p) => <option key={String(p.id)} value={String(p.id)}>{String(p.name)}</option>)}
                  </Select>
                  <Input type="number" placeholder="Qty" value={line.quantity || ""} onChange={(e) => updateLine(i, { quantity: +e.target.value })} />
                  <Input type="number" placeholder="Unit price" value={line.unitPrice || ""} onChange={(e) => updateLine(i, { unitPrice: +e.target.value })} />
                  <Select value={line.grade} onChange={(e) => updateLine(i, { grade: e.target.value })}>
                    <option value="A">Grade A</option><option value="B">B</option><option value="C">C</option>
                  </Select>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => setForm((prev) => ({ ...prev, lines: [...form.lines, { produceId: "", quantity: 0, unitPrice: 0, grade: "A" }] }))}>+ Add line</Button>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Transport Cost"><Input type="number" value={form.transportCost} onChange={(e) => setForm((prev) => ({ ...prev, transportCost: +e.target.value }))} /></FormField>
                <FormField label="Loading Cost"><Input type="number" value={form.loadingCost} onChange={(e) => setForm((prev) => ({ ...prev, loadingCost: +e.target.value }))} /></FormField>
              </div>
              <FormField label="Notes"><Input value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} /></FormField>
              <FormActions onCancel={close} loading={loading} />
            </form>
          )}
        </FormModal>
      )}

      <DataTable columns={[
        { key: "purchaseNumber", header: "Purchase #" },
        { key: "purchaseDate", header: "Date", render: (i) => formatDate(String(i.purchaseDate)) },
        { key: "supplier", header: "Supplier", render: (i) => String((i.supplier as { name?: string })?.name || "-") },
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
