"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, formatCurrency } from "@/components/ui/data-table";
import { StatCard } from "@/components/ui/stat-card";
import { FormModal, FormField, FormActions, apiPost } from "@/components/ui/form-modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function InventoryPage() {
  const [data, setData] = useState<{ batches: { items: Record<string, unknown>[] }; recentMovements: Record<string, unknown>[] } | null>(null);
  const [alerts, setAlerts] = useState<Record<string, unknown>[]>([]);
  const [produce, setProduce] = useState<Record<string, unknown>[]>([]);
  const [locations, setLocations] = useState<Record<string, unknown>[]>([]);
  const [tab, setTab] = useState<"batches" | "movements">("batches");
  const [showAdjust, setShowAdjust] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ produceId: "", locationId: "", quantity: 0, movementType: "ADJUSTMENT", reason: "" });

  const load = () => {
    Promise.all([
      fetch("/api/inventory").then((r) => r.json()),
      fetch("/api/inventory?view=alerts").then((r) => r.json()),
      fetch("/api/produce?limit=100").then((r) => r.json()),
      fetch("/api/settings?section=master").then((r) => r.json()),
    ]).then(([inv, al, pr, m]) => {
      if (inv.success) setData(inv.data);
      if (al.success) setAlerts(al.data || []);
      if (pr.success) setProduce(pr.data.items || []);
      if (m.success) setLocations(m.data.locations || []);
    });
  };

  useEffect(() => { load(); }, []);

  const batches = data?.batches?.items || [];
  const movements = data?.recentMovements || [];
  const totalValue = batches.reduce((s, b) => s + Number(b.quantity) * Number(b.unitCost), 0);
  const totalQty = batches.reduce((s, b) => s + Number(b.quantity), 0);

  const handleAdjust = async (close: () => void) => {
    setLoading(true);
    const outbound = form.movementType === "DAMAGE";
    const res = await apiPost("/api/inventory", {
      produceId: form.produceId,
      quantity: form.quantity,
      movementType: form.movementType,
      ...(outbound ? { fromLocationId: form.locationId } : { toLocationId: form.locationId }),
      reason: form.reason,
    });
    setLoading(false);
    if (res.success) { load(); close(); setShowAdjust(false); }
    else alert(res.message);
  };

  return (
    <div>
      <PageHeader title="Inventory" description="Stock levels, movements, and valuation" actions={
        <Button onClick={() => setShowAdjust(true)}>Stock Adjustment</Button>
      } />
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <StatCard title="Stock Value" value={totalValue} isCurrency icon={Package} />
        <StatCard title="Total Quantity" value={totalQty.toFixed(0)} icon={Package} />
      </div>

      {alerts.length > 0 && (
        <Card className="mb-6 border-amber-200 bg-amber-50">
          <CardHeader><CardTitle className="text-amber-800">Low Stock Alerts ({alerts.length})</CardTitle></CardHeader>
          <CardContent>
            <DataTable columns={[
              { key: "produce", header: "Produce", render: (i) => String((i.produce as { name?: string })?.name || "-") },
              { key: "currentStock", header: "Current Qty" },
              { key: "minimum", header: "Minimum Level" },
            ]} data={alerts} />
          </CardContent>
        </Card>
      )}

      <div className="mb-4 flex gap-2">
        <Button variant={tab === "batches" ? "default" : "outline"} size="sm" onClick={() => setTab("batches")}>Batches</Button>
        <Button variant={tab === "movements" ? "default" : "outline"} size="sm" onClick={() => setTab("movements")}>Movements</Button>
      </div>

      {showAdjust && (
        <FormModal title="Stock Adjustment" open={showAdjust} onOpenChange={setShowAdjust}>
          {({ close }) => (
            <form onSubmit={(e) => { e.preventDefault(); handleAdjust(close); }} className="space-y-3">
              <FormField label="Produce">
                <Select value={form.produceId} onChange={(e) => setForm((prev) => ({ ...prev, produceId: e.target.value }))} required>
                  <option value="">Select</option>
                  {produce.map((p) => <option key={String(p.id)} value={String(p.id)}>{String(p.name)}</option>)}
                </Select>
              </FormField>
              <FormField label="Location">
                <Select value={form.locationId} onChange={(e) => setForm((prev) => ({ ...prev, locationId: e.target.value }))} required>
                  <option value="">Select</option>
                  {locations.map((l) => <option key={String(l.id)} value={String(l.id)}>{String(l.name)}</option>)}
                </Select>
              </FormField>
              <FormField label="Quantity"><Input type="number" value={form.quantity} onChange={(e) => setForm((prev) => ({ ...prev, quantity: +e.target.value }))} required /></FormField>
              <FormField label="Type">
                <Select value={form.movementType} onChange={(e) => setForm((prev) => ({ ...prev, movementType: e.target.value }))}>
                  <option value="ADJUSTMENT">Adjustment</option>
                  <option value="DAMAGE">Damage</option>
                  <option value="TRANSFER">Transfer</option>
                </Select>
              </FormField>
              <FormField label="Reason"><Input value={form.reason} onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))} /></FormField>
              <FormActions onCancel={close} loading={loading} />
            </form>
          )}
        </FormModal>
      )}

      {tab === "batches" ? (
        <DataTable columns={[
          { key: "produce", header: "Produce", render: (i) => String((i.produce as { name?: string })?.name || "-") },
          { key: "grade", header: "Grade" },
          { key: "location", header: "Location", render: (i) => String((i.location as { name?: string })?.name || "-") },
          { key: "batchNumber", header: "Batch" },
          { key: "quantity", header: "Qty" },
          { key: "unitCost", header: "Unit Cost", render: (i) => formatCurrency(Number(i.unitCost)) },
        ]} data={batches} />
      ) : (
        <DataTable columns={[
          { key: "movementDate", header: "Date", render: (i) => formatDate(String(i.movementDate || i.createdAt)) },
          { key: "produce", header: "Produce", render: (i) => String((i.produce as { name?: string })?.name || "-") },
          { key: "movementType", header: "Type" },
          { key: "quantity", header: "Qty" },
          { key: "referenceDoc", header: "Reference" },
        ]} data={movements} />
      )}
    </div>
  );
}
