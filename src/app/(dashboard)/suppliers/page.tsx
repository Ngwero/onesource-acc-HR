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

type SupplierForm = {
  code: string; name: string; contactPerson: string; phone: string; email: string;
  location: string; supplierType: string; paymentTerms: number;
};

const empty: SupplierForm = {
  code: "", name: "", contactPerson: "", phone: "", email: "",
  location: "", supplierType: "FARMER", paymentTerms: 30,
};

export default function SuppliersPage() {
  const searchParams = useSearchParams();
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [showCreate, setShowCreate] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [createForm, setCreateForm] = useState<SupplierForm>(empty);
  const [editForm, setEditForm] = useState<SupplierForm>(empty);

  const load = useCallback(() => {
    setFetching(true);
    fetch(`/api/suppliers?search=${encodeURIComponent(search)}&limit=100`)
      .then((r) => r.json())
      .then((res) => { if (res.success) setItems(res.data.items || []); })
      .finally(() => setFetching(false));
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const openEdit = (item: Record<string, unknown>) => {
    setEditForm({
      code: String(item.code || ""), name: String(item.name || ""),
      contactPerson: String(item.contactPerson || ""), phone: String(item.phone || ""),
      email: String(item.email || ""), location: String(item.location || ""),
      supplierType: String(item.supplierType || "FARMER"),
      paymentTerms: Number(item.paymentTerms || 30),
    });
    setEditingId(String(item.id));
  };

  const save = async (url: string, method: string, data: SupplierForm, close: () => void) => {
    setLoading(true);
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...data, email: data.email || undefined }) }).then((r) => r.json());
    setLoading(false);
    if (res.success) { load(); close(); setShowCreate(false); setEditingId(null); }
    else alert(res.message);
  };

  const FormFields = ({ form, setForm, codeDisabled }: { form: SupplierForm; setForm: (f: SupplierForm) => void; codeDisabled?: boolean }) => (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Code"><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required disabled={codeDisabled} /></FormField>
        <FormField label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></FormField>
      </div>
      <FormField label="Contact Person"><Input value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} /></FormField>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></FormField>
        <FormField label="Email"><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></FormField>
      </div>
      <FormField label="Location"><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></FormField>
      <FormField label="Type">
        <Select value={form.supplierType} onChange={(e) => setForm({ ...form, supplierType: e.target.value })}>
          {["FARMER", "COOPERATIVE", "AGENT", "COMPANY"].map((t) => <option key={t} value={t}>{t}</option>)}
        </Select>
      </FormField>
      <FormField label="Payment Terms (days)"><Input type="number" value={form.paymentTerms} onChange={(e) => setForm({ ...form, paymentTerms: +e.target.value })} /></FormField>
    </>
  );

  return (
    <div>
      <PageHeader title="Suppliers & Farmers" description="Manage supplier database and balances" actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowBulk(true)}>Bulk Import</Button>
          <Button onClick={() => setShowCreate(true)}>Add Supplier</Button>
        </div>
      } />
      <div className="mb-4 flex gap-2">
        <Input placeholder="Search suppliers..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
        <Button variant="outline" onClick={() => setSearch("")}>Clear</Button>
      </div>

      {showBulk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="max-h-[90vh] w-full max-w-3xl overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Bulk Import Suppliers</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowBulk(false)}>✕</Button>
            </CardHeader>
            <CardContent><BulkImportPanel entityId="suppliers" onComplete={() => { load(); setShowBulk(false); }} /></CardContent>
          </Card>
        </div>
      )}

      {showCreate && (
        <FormModal title="Add Supplier" open onOpenChange={setShowCreate}>
          {({ close }) => (
            <form onSubmit={(e) => { e.preventDefault(); save("/api/suppliers", "POST", createForm, close); }} className="space-y-3">
              <FormFields form={createForm} setForm={setCreateForm} />
              <FormActions onCancel={close} loading={loading} />
            </form>
          )}
        </FormModal>
      )}

      {editingId && (
        <FormModal title="Edit Supplier" open onOpenChange={(o) => { if (!o) setEditingId(null); }}>
          {({ close }) => (
            <form onSubmit={(e) => { e.preventDefault(); save(`/api/suppliers/${editingId}`, "PUT", editForm, close); }} className="space-y-3">
              <FormFields form={editForm} setForm={setEditForm} codeDisabled />
              <FormActions onCancel={close} loading={loading} />
            </form>
          )}
        </FormModal>
      )}

      <DataTable loading={fetching} columns={[
        { key: "code", header: "ID" }, { key: "name", header: "Name" }, { key: "supplierType", header: "Type" },
        { key: "location", header: "Location" }, { key: "phone", header: "Phone" },
        { key: "balance", header: "Balance", render: (i) => formatCurrency(Number(i.balance)) },
        { key: "status", header: "Status", render: (i) => <StatusBadge status={String(i.status)} /> },
        { key: "id", header: "Actions", render: (i) => (
          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={() => openEdit(i)}>Edit</Button>
            {i.status === "ACTIVE" && (
              <Button size="sm" variant="outline" onClick={async () => {
                if (confirm("Deactivate supplier?")) { await fetch(`/api/suppliers/${i.id}`, { method: "DELETE" }); load(); }
              }}>Deactivate</Button>
            )}
          </div>
        ) },
      ]} data={items} />
    </div>
  );
}
