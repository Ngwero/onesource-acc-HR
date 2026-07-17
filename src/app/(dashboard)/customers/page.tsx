"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, StatusBadge, formatCurrency } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FormModal, FormField, FormActions, apiPost } from "@/components/ui/form-modal";
import { BulkImportPanel } from "@/components/modules/bulk-import-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type CustomerForm = {
  code: string; name: string; contactPerson: string; phone: string; email: string;
  country: string; customerType: string; creditLimit: number; paymentTerms: number;
};

const empty: CustomerForm = {
  code: "", name: "", contactPerson: "", phone: "", email: "",
  country: "Uganda", customerType: "LOCAL_BUYER", creditLimit: 0, paymentTerms: 30,
};

export default function CustomersPage() {
  const searchParams = useSearchParams();
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [showCreate, setShowCreate] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [createForm, setCreateForm] = useState<CustomerForm>(empty);
  const [editForm, setEditForm] = useState<CustomerForm>(empty);

  const load = useCallback(() => {
    setFetching(true);
    fetch(`/api/customers?search=${encodeURIComponent(search)}&limit=100`)
      .then((r) => r.json())
      .then((res) => { if (res.success) setItems(res.data.items || []); })
      .finally(() => setFetching(false));
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const openEdit = (item: Record<string, unknown>) => {
    setEditForm({
      code: String(item.code || ""), name: String(item.name || ""),
      contactPerson: String(item.contactPerson || ""), phone: String(item.phone || ""),
      email: String(item.email || ""), country: String(item.country || ""),
      customerType: String(item.customerType || "LOCAL_BUYER"),
      creditLimit: Number(item.creditLimit || 0), paymentTerms: Number(item.paymentTerms || 30),
    });
    setEditingId(String(item.id));
  };

  const save = async (url: string, method: string, data: CustomerForm, close: () => void) => {
    setLoading(true);
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...data, email: data.email || undefined }) }).then((r) => r.json());
    setLoading(false);
    if (res.success) { load(); close(); setShowCreate(false); setEditingId(null); }
    else alert(res.message);
  };

  const FormFields = ({ form, setForm, codeDisabled }: { form: CustomerForm; setForm: (f: CustomerForm) => void; codeDisabled?: boolean }) => (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Code"><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required disabled={codeDisabled} /></FormField>
        <FormField label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></FormField>
      </div>
      <FormField label="Contact Person"><Input value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} /></FormField>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></FormField>
        <FormField label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></FormField>
      </div>
      <FormField label="Country"><Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></FormField>
      <FormField label="Type">
        <Select value={form.customerType} onChange={(e) => setForm({ ...form, customerType: e.target.value })}>
          {["LOCAL_BUYER", "SUPERMARKET", "HOTEL", "WHOLESALER", "EXPORTER_IMPORTER", "DISTRIBUTOR"].map((t) => (
            <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
          ))}
        </Select>
      </FormField>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Credit Limit"><Input type="number" value={form.creditLimit} onChange={(e) => setForm({ ...form, creditLimit: +e.target.value })} /></FormField>
        <FormField label="Payment Terms"><Input type="number" value={form.paymentTerms} onChange={(e) => setForm({ ...form, paymentTerms: +e.target.value })} /></FormField>
      </div>
    </>
  );

  return (
    <div>
      <PageHeader title="Customers" description="Manage local and export customers" actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowBulk(true)}>Bulk Import</Button>
          <Button onClick={() => setShowCreate(true)}>Add Customer</Button>
        </div>
      } />
      <div className="mb-4 flex gap-2">
        <Input placeholder="Search customers..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
        <Button variant="outline" onClick={() => setSearch("")}>Clear</Button>
      </div>

      {showBulk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="max-h-[90vh] w-full max-w-3xl overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Bulk Import Customers</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowBulk(false)}>✕</Button>
            </CardHeader>
            <CardContent><BulkImportPanel entityId="customers" onComplete={() => { load(); setShowBulk(false); }} /></CardContent>
          </Card>
        </div>
      )}

      {showCreate && (
        <FormModal title="Add Customer" open onOpenChange={setShowCreate}>
          {({ close }) => (
            <form onSubmit={(e) => { e.preventDefault(); save("/api/customers", "POST", createForm, close); }} className="space-y-3">
              <FormFields form={createForm} setForm={setCreateForm} />
              <FormActions onCancel={close} loading={loading} />
            </form>
          )}
        </FormModal>
      )}

      {editingId && (
        <FormModal title="Edit Customer" open onOpenChange={(o) => { if (!o) setEditingId(null); }}>
          {({ close }) => (
            <form onSubmit={(e) => { e.preventDefault(); save(`/api/customers/${editingId}`, "PUT", editForm, close); }} className="space-y-3">
              <FormFields form={editForm} setForm={setEditForm} codeDisabled />
              <FormActions onCancel={close} loading={loading} />
            </form>
          )}
        </FormModal>
      )}

      <DataTable loading={fetching} columns={[
        { key: "code", header: "ID" }, { key: "name", header: "Name" }, { key: "customerType", header: "Type" },
        { key: "country", header: "Country" },
        { key: "creditLimit", header: "Credit Limit", render: (i) => formatCurrency(Number(i.creditLimit)) },
        { key: "balance", header: "Balance", render: (i) => formatCurrency(Number(i.balance)) },
        { key: "status", header: "Status", render: (i) => <StatusBadge status={String(i.status)} /> },
        { key: "id", header: "Actions", render: (i) => (
          <div className="flex gap-1">
            <a href={`/customers/${i.id}`}><Button size="sm" variant="outline">View</Button></a>
            <Button size="sm" variant="outline" onClick={() => openEdit(i)}>Edit</Button>
            {i.status === "ACTIVE" && (
              <Button size="sm" variant="outline" onClick={async () => {
                if (confirm("Deactivate customer?")) {
                  await fetch(`/api/customers/${i.id}`, { method: "DELETE" });
                  load();
                }
              }}>Deactivate</Button>
            )}
          </div>
        ) },
      ]} data={items} />
    </div>
  );
}
