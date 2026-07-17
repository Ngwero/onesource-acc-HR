"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, StatusBadge, formatCurrency } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FormModal, FormField, FormActions, apiPost } from "@/components/ui/form-modal";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { xeroPatch, xeroDelete } from "@/lib/xero-actions";

export default function CreditNotesPage() {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [customers, setCustomers] = useState<Record<string, unknown>[]>([]);
  const [suppliers, setSuppliers] = useState<Record<string, unknown>[]>([]);
  const [receivables, setReceivables] = useState<Record<string, unknown>[]>([]);
  const [payables, setPayables] = useState<Record<string, unknown>[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [applyTarget, setApplyTarget] = useState<Record<string, unknown> | null>(null);
  const [applyForm, setApplyForm] = useState({ receivableId: "", payableId: "" });
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    type: "SALES", customerId: "", supplierId: "", description: "", quantity: 1, unitPrice: 0, reason: "",
  });

  const load = useCallback(() => {
    Promise.all([
      fetch("/api/xero?module=credit-notes").then((r) => r.json()),
      fetch("/api/customers").then((r) => r.json()),
      fetch("/api/suppliers").then((r) => r.json()),
      fetch("/api/receivables?limit=200").then((r) => r.json()),
      fetch("/api/payables?limit=200").then((r) => r.json()),
    ]).then(([cn, c, s, rec, pay]) => {
      if (cn.success) setItems(cn.data);
      if (c.success) setCustomers(c.data.items || []);
      if (s.success) setSuppliers(s.data.items || []);
      if (rec.success) setReceivables(rec.data.items || []);
      if (pay.success) setPayables(pay.data.items || []);
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (close: () => void) => {
    setLoading(true);
    const res = await apiPost("/api/xero", {
      module: "credit-notes",
      type: form.type,
      customerId: form.type === "SALES" ? form.customerId : undefined,
      supplierId: form.type === "PURCHASE" ? form.supplierId : undefined,
      reason: form.reason,
      items: [{ description: form.description, quantity: form.quantity, unitPrice: form.unitPrice }],
    });
    setLoading(false);
    if (res.success) { load(); close(); setShowForm(false); }
    else alert(res.message);
  };

  const openApply = (item: Record<string, unknown>) => {
    setApplyTarget(item);
    setApplyForm({ receivableId: "", payableId: "" });
  };

  const handleApply = async (close: () => void) => {
    if (!applyTarget) return;
    setLoading(true);
    const res = await xeroPatch({
      module: "credit-notes",
      id: String(applyTarget.id),
      action: "apply",
      receivableId: applyForm.receivableId || undefined,
      payableId: applyForm.payableId || undefined,
    });
    setLoading(false);
    if (res.success) { load(); close(); setApplyTarget(null); }
    else alert(res.message);
  };

  const openReceivables = receivables.filter((r) => {
    if (!applyTarget || applyTarget.type !== "SALES") return false;
    if (!["UNPAID", "PARTIALLY_PAID", "OVERDUE"].includes(String(r.status))) return false;
    return !applyTarget.customerId || r.customerId === applyTarget.customerId;
  });

  const openPayables = payables.filter((p) => {
    if (!applyTarget || applyTarget.type !== "PURCHASE") return false;
    if (!["UNPAID", "PARTIALLY_PAID", "OVERDUE"].includes(String(p.status))) return false;
    return !applyTarget.supplierId || p.supplierId === applyTarget.supplierId;
  });

  return (
    <div>
      <PageHeader title="Credit Notes" description="Sales and purchase credit notes — apply to open AR/AP balances" actions={
        <Button onClick={() => setShowForm(true)}>New Credit Note</Button>
      } />

      {showForm && (
        <FormModal title="New Credit Note" open onOpenChange={setShowForm}>
          {({ close }) => (
            <form onSubmit={(e) => { e.preventDefault(); handleCreate(close); }} className="space-y-3">
              <FormField label="Type">
                <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option value="SALES">Sales Credit Note</option>
                  <option value="PURCHASE">Purchase Credit Note</option>
                </Select>
              </FormField>
              {form.type === "SALES" ? (
                <FormField label="Customer">
                  <Select value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} required>
                    <option value="">Select customer</option>
                    {customers.map((c) => <option key={String(c.id)} value={String(c.id)}>{String(c.name)}</option>)}
                  </Select>
                </FormField>
              ) : (
                <FormField label="Supplier">
                  <Select value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })} required>
                    <option value="">Select supplier</option>
                    {suppliers.map((s) => <option key={String(s.id)} value={String(s.id)}>{String(s.name)}</option>)}
                  </Select>
                </FormField>
              )}
              <FormField label="Description"><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required /></FormField>
              <FormField label="Quantity"><Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: +e.target.value })} /></FormField>
              <FormField label="Unit Price"><Input type="number" value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: +e.target.value })} /></FormField>
              <FormField label="Reason"><Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></FormField>
              <FormActions onCancel={close} loading={loading} />
            </form>
          )}
        </FormModal>
      )}

      {applyTarget && (
        <FormModal title={`Apply ${String(applyTarget.creditNoteNumber)}`} open onOpenChange={() => setApplyTarget(null)}>
          {({ close }) => (
            <form onSubmit={(e) => { e.preventDefault(); handleApply(close); }} className="space-y-3">
              <p className="text-sm text-gray-600">
                Total {formatCurrency(Number(applyTarget.total))} · Applied {formatCurrency(Number(applyTarget.appliedAmount || 0))}
              </p>
              {applyTarget.type === "SALES" ? (
                <FormField label="Receivable">
                  <Select value={applyForm.receivableId} onChange={(e) => setApplyForm({ ...applyForm, receivableId: e.target.value })} required>
                    <option value="">Select open receivable</option>
                    {openReceivables.map((r) => (
                      <option key={String(r.id)} value={String(r.id)}>
                        {String(r.receivableNumber)} — {formatCurrency(Number(r.balance))} due {formatDate(String(r.dueDate))}
                      </option>
                    ))}
                  </Select>
                </FormField>
              ) : (
                <FormField label="Payable">
                  <Select value={applyForm.payableId} onChange={(e) => setApplyForm({ ...applyForm, payableId: e.target.value })} required>
                    <option value="">Select open payable</option>
                    {openPayables.map((p) => (
                      <option key={String(p.id)} value={String(p.id)}>
                        {String(p.payableNumber)} — {formatCurrency(Number(p.balance))} due {formatDate(String(p.dueDate))}
                      </option>
                    ))}
                  </Select>
                </FormField>
              )}
              <FormActions onCancel={close} loading={loading} />
            </form>
          )}
        </FormModal>
      )}

      <DataTable columns={[
        { key: "creditNoteNumber", header: "Credit Note #" },
        { key: "type", header: "Type" },
        { key: "date", header: "Date", render: (i) => formatDate(String(i.date)) },
        { key: "customer", header: "Customer", render: (i) => String((i.customer as { name?: string })?.name || "-") },
        { key: "supplier", header: "Supplier", render: (i) => String((i.supplier as { name?: string })?.name || "-") },
        { key: "total", header: "Total", render: (i) => formatCurrency(Number(i.total)) },
        { key: "appliedAmount", header: "Applied", render: (i) => formatCurrency(Number(i.appliedAmount || 0)) },
        { key: "status", header: "Status", render: (i) => <StatusBadge status={String(i.status)} /> },
        { key: "id", header: "Actions", render: (i) => {
          const remaining = Number(i.total) - Number(i.appliedAmount || 0);
          const canApply = String(i.status) === "CONFIRMED" && remaining > 0.01;
          return (
            <div className="flex gap-2">
              {canApply && (
                <button type="button" onClick={() => openApply(i)} className="text-xs text-green-700 hover:underline">
                  Apply
                </button>
              )}
              <button
                type="button"
                onClick={async () => {
                  if (!confirm("Cancel this credit note?")) return;
                  const res = await xeroDelete("credit-notes", String(i.id));
                  if (res.success) load();
                  else alert(res.message);
                }}
                className="text-xs text-red-600 hover:underline"
              >
                Cancel
              </button>
            </div>
          );
        } },
      ]} data={items} />
    </div>
  );
}
