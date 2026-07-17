"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, StatusBadge, formatCurrency } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FormModal, FormField, FormActions, apiPost } from "@/components/ui/form-modal";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

export default function ExpensesPage() {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [categories, setCategories] = useState<Record<string, unknown>[]>([]);
  const [suppliers, setSuppliers] = useState<Record<string, unknown>[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    categoryId: "", supplierId: "", amount: 0, date: "", description: "", paymentMethod: "BANK_TRANSFER",
  });

  const load = useCallback(() => {
    Promise.all([
      fetch("/api/expenses?limit=100").then((r) => r.json()),
      fetch("/api/settings?section=master").then((r) => r.json()),
      fetch("/api/suppliers?limit=100").then((r) => r.json()),
    ]).then(([e, m, s]) => {
      if (e.success) setItems(e.data.items || []);
      if (m.success) setCategories(m.data.categories || []);
      if (s.success) setSuppliers(s.data.items || []);
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (close: () => void) => {
    setLoading(true);
    const res = await apiPost("/api/expenses", {
      ...form,
      supplierId: form.supplierId || undefined,
      date: form.date || undefined,
    });
    setLoading(false);
    if (res.success) { load(); close(); setShowForm(false); }
    else alert(res.message);
  };

  const handleApprove = async (id: string, action: "approve" | "reject") => {
    const res = await fetch(`/api/expenses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    }).then((r) => r.json());
    if (res.success) load();
    else alert(res.message);
  };

  return (
    <div>
      <PageHeader title="Expenses" description="Business expense tracking and approvals" actions={
        <Button onClick={() => setShowForm(true)}>New Expense</Button>
      } />

      {showForm && (
        <FormModal title="New Expense" open onOpenChange={setShowForm}>
          {({ close }) => (
            <form onSubmit={(e) => { e.preventDefault(); handleCreate(close); }} className="space-y-3">
              <FormField label="Category">
                <Select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} required>
                  <option value="">Select category</option>
                  {categories.map((c) => <option key={String(c.id)} value={String(c.id)}>{String(c.name)}</option>)}
                </Select>
              </FormField>
              <FormField label="Amount (UGX)"><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: +e.target.value })} required /></FormField>
              <FormField label="Date"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></FormField>
              <FormField label="Supplier (optional)">
                <Select value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}>
                  <option value="">None</option>
                  {suppliers.map((s) => <option key={String(s.id)} value={String(s.id)}>{String(s.name)}</option>)}
                </Select>
              </FormField>
              <FormField label="Description"><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></FormField>
              <FormActions onCancel={close} loading={loading} />
            </form>
          )}
        </FormModal>
      )}

      <DataTable columns={[
        { key: "expenseNumber", header: "Expense #" },
        { key: "date", header: "Date", render: (i) => formatDate(String(i.date)) },
        { key: "category", header: "Category", render: (i) => String((i.category as { name?: string })?.name || "-") },
        { key: "ugxEquivalent", header: "Amount", render: (i) => formatCurrency(Number(i.ugxEquivalent)) },
        { key: "status", header: "Status", render: (i) => <StatusBadge status={String(i.status)} /> },
        { key: "id", header: "Actions", render: (i) => i.status === "DRAFT" ? (
          <div className="flex gap-1">
            <Button size="sm" onClick={() => handleApprove(String(i.id), "approve")}>Approve</Button>
            <Button size="sm" variant="outline" onClick={() => handleApprove(String(i.id), "reject")}>Reject</Button>
          </div>
        ) : null },
      ]} data={items} />
    </div>
  );
}
