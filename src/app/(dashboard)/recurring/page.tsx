"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, formatCurrency } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FormModal, FormField, FormActions, apiPost } from "@/components/ui/form-modal";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { ModuleActions, xeroPatch } from "@/lib/xero-actions";

export default function RecurringPage() {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [customers, setCustomers] = useState<Record<string, unknown>[]>([]);
  const [suppliers, setSuppliers] = useState<Record<string, unknown>[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "", type: "INVOICE", frequency: "MONTHLY", nextRunDate: "", amount: 0,
    customerId: "", supplierId: "", description: "",
  });

  const load = useCallback(() => {
    Promise.all([
      fetch("/api/xero?module=recurring").then((r) => r.json()),
      fetch("/api/customers").then((r) => r.json()),
      fetch("/api/suppliers").then((r) => r.json()),
    ]).then(([r, c, s]) => {
      if (r.success) setItems(r.data);
      if (c.success) setCustomers(c.data.items || []);
      if (s.success) setSuppliers(s.data.items || []);
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (close: () => void) => {
    setLoading(true);
    const res = await apiPost("/api/xero", {
      module: "recurring",
      name: form.name,
      type: form.type,
      frequency: form.frequency,
      nextRunDate: form.nextRunDate,
      amount: form.amount,
      customerId: form.type === "INVOICE" ? form.customerId : undefined,
      supplierId: form.type === "BILL" ? form.supplierId : undefined,
      description: form.description,
    });
    setLoading(false);
    if (res.success) { load(); close(); setShowForm(false); }
    else alert(res.message);
  };

  const runDue = async () => {
    setLoading(true);
    const res = await apiPost("/api/xero", { module: "run-recurring" });
    setLoading(false);
    if (res.success) { alert(res.message); load(); }
    else alert(res.message);
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    const res = await xeroPatch({ module: "recurring", id, isActive: !isActive });
    if (res.success) load();
  };

  return (
    <div>
      <PageHeader title="Repeating Bills & Invoices" description="Automated recurring transactions" actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={runDue} disabled={loading}>Run Due Templates</Button>
          <Button onClick={() => setShowForm(true)}>New Template</Button>
        </div>
      } />

      {showForm && (
        <FormModal title="New Recurring Template" open={showForm} onOpenChange={setShowForm}>
          {({ close }) => (
            <form onSubmit={(e) => { e.preventDefault(); handleCreate(close); }} className="space-y-3">
              <FormField label="Name"><Input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} required /></FormField>
              <FormField label="Type">
                <Select value={form.type} onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))}>
                  <option value="INVOICE">Repeating Invoice</option>
                  <option value="BILL">Repeating Bill</option>
                </Select>
              </FormField>
              <FormField label="Frequency">
                <Select value={form.frequency} onChange={(e) => setForm((prev) => ({ ...prev, frequency: e.target.value }))}>
                  <option value="WEEKLY">Weekly</option>
                  <option value="MONTHLY">Monthly</option>
                  <option value="QUARTERLY">Quarterly</option>
                  <option value="YEARLY">Yearly</option>
                </Select>
              </FormField>
              <FormField label="Next Run Date"><Input type="date" value={form.nextRunDate} onChange={(e) => setForm((prev) => ({ ...prev, nextRunDate: e.target.value }))} required /></FormField>
              <FormField label="Amount"><Input type="number" value={form.amount} onChange={(e) => setForm((prev) => ({ ...prev, amount: +e.target.value }))} required /></FormField>
              {form.type === "INVOICE" ? (
                <FormField label="Customer">
                  <Select value={form.customerId} onChange={(e) => setForm((prev) => ({ ...prev, customerId: e.target.value }))}>
                    <option value="">Select customer</option>
                    {customers.map((c) => <option key={String(c.id)} value={String(c.id)}>{String(c.name)}</option>)}
                  </Select>
                </FormField>
              ) : (
                <FormField label="Supplier">
                  <Select value={form.supplierId} onChange={(e) => setForm((prev) => ({ ...prev, supplierId: e.target.value }))}>
                    <option value="">Select supplier</option>
                    {suppliers.map((s) => <option key={String(s.id)} value={String(s.id)}>{String(s.name)}</option>)}
                  </Select>
                </FormField>
              )}
              <FormField label="Description"><Input value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} /></FormField>
              <FormActions onCancel={close} loading={loading} />
            </form>
          )}
        </FormModal>
      )}

      <DataTable columns={[
        { key: "name", header: "Name" },
        { key: "type", header: "Type" },
        { key: "frequency", header: "Frequency" },
        { key: "nextRunDate", header: "Next Run", render: (i) => formatDate(String(i.nextRunDate)) },
        { key: "amount", header: "Amount", render: (i) => formatCurrency(Number(i.amount)) },
        { key: "isActive", header: "Active", render: (i) => (i.isActive ? "Yes" : "No") },
        { key: "id", header: "Actions", render: (i) => (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => toggleActive(String(i.id), Boolean(i.isActive))}>
              {i.isActive ? "Pause" : "Activate"}
            </Button>
            <ModuleActions module="recurring" id={String(i.id)} onDone={load} label="Deactivate" />
          </div>
        ) },
      ]} data={items} />
    </div>
  );
}
