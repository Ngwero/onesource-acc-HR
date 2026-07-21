"use client";

import { useEffect, useState, useCallback, type Dispatch, type SetStateAction } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, StatusBadge, formatCurrency } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FormModal, FormField, FormActions, apiPost } from "@/components/ui/form-modal";
import { BulkImportPanel } from "@/components/modules/bulk-import-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ProduceForm = {
  code: string;
  name: string;
  category: string;
  unitOfMeasureId: string;
  grade: string;
  buyingPrice: number;
  sellingPrice: number;
  exportPrice: number;
  shelfLifeDays: number | "";
  storageRequirements: string;
  packagingType: string;
  minimumStockLevel: number;
};

const emptyForm: ProduceForm = {
  code: "",
  name: "",
  category: "",
  unitOfMeasureId: "",
  grade: "A",
  buyingPrice: 0,
  sellingPrice: 0,
  exportPrice: 0,
  shelfLifeDays: "",
  storageRequirements: "",
  packagingType: "",
  minimumStockLevel: 0,
};

const GRADES = ["A", "B", "C", "EXPORT_GRADE", "LOCAL_GRADE"] as const;

function toPayload(form: ProduceForm) {
  return {
    code: form.code,
    name: form.name,
    category: form.category,
    unitOfMeasureId: form.unitOfMeasureId,
    grade: form.grade,
    buyingPrice: form.buyingPrice,
    sellingPrice: form.sellingPrice,
    exportPrice: form.exportPrice,
    shelfLifeDays: form.shelfLifeDays === "" ? undefined : form.shelfLifeDays,
    storageRequirements: form.storageRequirements || undefined,
    packagingType: form.packagingType || undefined,
    minimumStockLevel: form.minimumStockLevel,
  };
}

function ProduceFormFields({
  form,
  setForm,
  units,
  codeDisabled,
}: {
  form: ProduceForm;
  setForm: Dispatch<SetStateAction<ProduceForm>>;
  units: Record<string, unknown>[];
  codeDisabled?: boolean;
}) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Code">
          <Input
            value={form.code}
            onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))}
            required
            disabled={codeDisabled}
            placeholder="PRD-001"
          />
        </FormField>
        <FormField label="Name">
          <Input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} required />
        </FormField>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Category">
          <Input value={form.category} onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))} required placeholder="Fruits, Grains, etc." />
        </FormField>
        <FormField label="Unit of Measure">
          <Select value={form.unitOfMeasureId} onChange={(e) => setForm((prev) => ({ ...prev, unitOfMeasureId: e.target.value }))} required>
            <option value="">Select unit</option>
            {units.map((u) => (
              <option key={String(u.id)} value={String(u.id)}>{String(u.name)} ({String(u.code)})</option>
            ))}
          </Select>
        </FormField>
      </div>
      <FormField label="Grade">
        <Select value={form.grade} onChange={(e) => setForm((prev) => ({ ...prev, grade: e.target.value }))}>
          {GRADES.map((g) => <option key={g} value={g}>{g.replace("_", " ")}</option>)}
        </Select>
      </FormField>
      <div className="grid gap-3 sm:grid-cols-3">
        <FormField label="Buying Price (UGX)">
          <Input type="number" min={0} value={form.buyingPrice} onChange={(e) => setForm((prev) => ({ ...prev, buyingPrice: +e.target.value }))} required />
        </FormField>
        <FormField label="Selling Price (UGX)">
          <Input type="number" min={0} value={form.sellingPrice} onChange={(e) => setForm((prev) => ({ ...prev, sellingPrice: +e.target.value }))} required />
        </FormField>
        <FormField label="Export Price">
          <Input type="number" min={0} step="0.01" value={form.exportPrice} onChange={(e) => setForm((prev) => ({ ...prev, exportPrice: +e.target.value }))} />
        </FormField>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Shelf Life (days)">
          <Input type="number" min={0} value={form.shelfLifeDays} onChange={(e) => setForm((prev) => ({ ...prev, shelfLifeDays: e.target.value === "" ? "" : +e.target.value }))} />
        </FormField>
        <FormField label="Minimum Stock Level">
          <Input type="number" min={0} step="0.001" value={form.minimumStockLevel} onChange={(e) => setForm((prev) => ({ ...prev, minimumStockLevel: +e.target.value }))} />
        </FormField>
      </div>
      <FormField label="Packaging Type">
        <Input value={form.packagingType} onChange={(e) => setForm((prev) => ({ ...prev, packagingType: e.target.value }))} placeholder="Crates, bags, etc." />
      </FormField>
      <FormField label="Storage Requirements">
        <Input value={form.storageRequirements} onChange={(e) => setForm((prev) => ({ ...prev, storageRequirements: e.target.value }))} placeholder="Cold storage, dry room, etc." />
      </FormField>
    </>
  );
}

export default function ProducePage() {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [units, setUnits] = useState<Record<string, unknown>[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<ProduceForm>(emptyForm);
  const [editForm, setEditForm] = useState<ProduceForm>(emptyForm);

  const load = useCallback(() => {
    const params = new URLSearchParams({ search, limit: "100" });
    Promise.all([
      fetch(`/api/produce?${params}`).then((r) => r.json()),
      fetch("/api/settings?section=master").then((r) => r.json()),
    ]).then(([produceRes, masterRes]) => {
      if (produceRes.success) setItems(produceRes.data.items || []);
      if (masterRes.success) setUnits(masterRes.data.units || []);
    });
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const openEdit = (item: Record<string, unknown>) => {
    setEditForm({
      code: String(item.code || ""),
      name: String(item.name || ""),
      category: String(item.category || ""),
      unitOfMeasureId: String(item.unitOfMeasureId || ""),
      grade: String(item.grade || "A"),
      buyingPrice: Number(item.buyingPrice || 0),
      sellingPrice: Number(item.sellingPrice || 0),
      exportPrice: Number(item.exportPrice || 0),
      shelfLifeDays: item.shelfLifeDays == null ? "" : Number(item.shelfLifeDays),
      storageRequirements: String(item.storageRequirements || ""),
      packagingType: String(item.packagingType || ""),
      minimumStockLevel: Number(item.minimumStockLevel || 0),
    });
    setEditingId(String(item.id));
  };

  const handleCreate = async (close: () => void) => {
    setLoading(true);
    const res = await apiPost("/api/produce", toPayload(createForm));
    setLoading(false);
    if (res.success) {
      load();
      close();
      setShowCreate(false);
      setCreateForm(emptyForm);
    } else {
      alert(res.message || "Failed to create produce");
    }
  };

  const handleUpdate = async (close: () => void) => {
    if (!editingId) return;
    setLoading(true);
    const res = await fetch(`/api/produce/${editingId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toPayload(editForm)),
    }).then((r) => r.json());
    setLoading(false);
    if (res.success) {
      load();
      close();
      setEditingId(null);
    } else {
      alert(res.message || "Failed to update produce");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Deactivate "${name}"? This will mark the produce as inactive.`)) return;
    const res = await fetch(`/api/produce/${id}`, { method: "DELETE" }).then((r) => r.json());
    if (res.success) load();
    else alert(res.message || "Failed to deactivate produce");
  };

  return (
    <div>
      <PageHeader
        title="Produce Management"
        description="Manage agricultural produce, grades, and pricing"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowBulk(true)}>Bulk Import</Button>
            <Button onClick={() => setShowCreate(true)}>Add Produce</Button>
          </div>
        }
      />

      <div className="mb-4 flex gap-2">
        <Input
          placeholder="Search produce..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Button variant="outline" onClick={() => setSearch("")}>Clear</Button>
      </div>

      {showBulk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="max-h-[90vh] w-full max-w-3xl overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Bulk Import Produce</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowBulk(false)}>✕</Button>
            </CardHeader>
            <CardContent>
              <BulkImportPanel
                entityId="produce"
                onComplete={() => {
                  load();
                  setShowBulk(false);
                }}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {showCreate && (
        <FormModal title="Add Produce" open={showCreate} onOpenChange={setShowCreate}>
          {({ close }) => (
            <form onSubmit={(e) => { e.preventDefault(); handleCreate(close); }} className="space-y-3">
              <ProduceFormFields form={createForm} setForm={setCreateForm} units={units} />
              <FormActions onCancel={close} loading={loading} />
            </form>
          )}
        </FormModal>
      )}

      {editingId && (
        <FormModal title="Edit Produce" open={!!editingId} onOpenChange={(open) => { if (!open) setEditingId(null); }}>
          {({ close }) => (
            <form onSubmit={(e) => { e.preventDefault(); handleUpdate(close); }} className="space-y-3">
              <ProduceFormFields form={editForm} setForm={setEditForm} units={units} codeDisabled />
              <FormActions onCancel={close} loading={loading} />
            </form>
          )}
        </FormModal>
      )}

      <DataTable
        columns={[
          { key: "code", header: "Code" },
          { key: "name", header: "Name" },
          { key: "category", header: "Category" },
          {
            key: "unitOfMeasure",
            header: "Unit",
            render: (item) => String((item.unitOfMeasure as { code?: string })?.code || "-"),
          },
          { key: "grade", header: "Grade" },
          {
            key: "buyingPrice",
            header: "Buy Price",
            render: (item) => formatCurrency(Number(item.buyingPrice)),
          },
          {
            key: "sellingPrice",
            header: "Sell Price",
            render: (item) => formatCurrency(Number(item.sellingPrice)),
          },
          {
            key: "status",
            header: "Status",
            render: (item) => <StatusBadge status={String(item.status)} />,
          },
          {
            key: "id",
            header: "Actions",
            render: (item) => (
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => openEdit(item)}>Edit</Button>
                {item.status === "ACTIVE" && (
                  <Button size="sm" variant="outline" onClick={() => handleDelete(String(item.id), String(item.name))}>
                    Deactivate
                  </Button>
                )}
              </div>
            ),
          },
        ]}
        data={items}
      />
    </div>
  );
}
