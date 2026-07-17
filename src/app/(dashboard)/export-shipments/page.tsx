"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, StatusBadge, formatCurrency } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FormModal, FormField, FormActions, apiPost } from "@/components/ui/form-modal";
import { Button } from "@/components/ui/button";
import { FileUpload } from "@/components/ui/file-upload";

export default function ExportShipmentsPage() {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [customers, setCustomers] = useState<Record<string, unknown>[]>([]);
  const [produce, setProduce] = useState<Record<string, unknown>[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    customerId: "", produceId: "", quantity: 0, destinationCountry: "", destinationCity: "",
    freightMethod: "SEA", containerNumber: "", billOfLading: "", expectedRevenue: 0,
    costFreight: 0, costPackaging: 0,
  });

  const load = useCallback(() => {
    Promise.all([
      fetch("/api/export-shipments").then((r) => r.json()),
      fetch("/api/customers").then((r) => r.json()),
      fetch("/api/produce").then((r) => r.json()),
    ]).then(([s, c, p]) => {
      if (s.success) setItems(s.data);
      if (c.success) setCustomers(c.data.items || []);
      if (p.success) setProduce(p.data.items || []);
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (close: () => void) => {
    setLoading(true);
    const costs = [];
    if (form.costFreight) costs.push({ costType: "Freight", amount: form.costFreight });
    if (form.costPackaging) costs.push({ costType: "Packaging", amount: form.costPackaging });

    const res = await apiPost("/api/export-shipments", {
      customerId: form.customerId,
      produceId: form.produceId,
      quantity: form.quantity,
      destinationCountry: form.destinationCountry,
      destinationCity: form.destinationCity,
      freightMethod: form.freightMethod,
      containerNumber: form.containerNumber,
      billOfLading: form.billOfLading,
      expectedRevenue: form.expectedRevenue,
      costs,
    });
    setLoading(false);
    if (res.success) { load(); close(); setShowForm(false); }
    else alert(res.message);
  };

  const handleStatus = async (id: string, status: string) => {
    const res = await apiPost("/api/export-shipments", { action: "update-status", id, status });
    if (res.success) load();
  };

  return (
    <div>
      <PageHeader title="Export Shipments" description="Track shipments, costs, and profitability" actions={
        <Button onClick={() => setShowForm(true)}>New Shipment</Button>
      } />

      {showForm && (
        <FormModal title="New Export Shipment" open onOpenChange={setShowForm}>
          {({ close }) => (
            <form onSubmit={(e) => { e.preventDefault(); handleCreate(close); }} className="space-y-3">
              <FormField label="Customer">
                <Select value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} required>
                  <option value="">Select</option>
                  {customers.map((c) => <option key={String(c.id)} value={String(c.id)}>{String(c.name)}</option>)}
                </Select>
              </FormField>
              <FormField label="Produce">
                <Select value={form.produceId} onChange={(e) => setForm({ ...form, produceId: e.target.value })} required>
                  <option value="">Select</option>
                  {produce.map((p) => <option key={String(p.id)} value={String(p.id)}>{String(p.name)}</option>)}
                </Select>
              </FormField>
              <FormField label="Quantity"><Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: +e.target.value })} required /></FormField>
              <FormField label="Destination Country"><Input value={form.destinationCountry} onChange={(e) => setForm({ ...form, destinationCountry: e.target.value })} required /></FormField>
              <FormField label="City"><Input value={form.destinationCity} onChange={(e) => setForm({ ...form, destinationCity: e.target.value })} /></FormField>
              <FormField label="Freight Method">
                <Select value={form.freightMethod} onChange={(e) => setForm({ ...form, freightMethod: e.target.value })}>
                  <option value="SEA">Sea</option><option value="AIR">Air</option><option value="ROAD">Road</option>
                </Select>
              </FormField>
              <FormField label="Container #"><Input value={form.containerNumber} onChange={(e) => setForm({ ...form, containerNumber: e.target.value })} /></FormField>
              <FormField label="Bill of Lading"><Input value={form.billOfLading} onChange={(e) => setForm({ ...form, billOfLading: e.target.value })} /></FormField>
              <FormField label="Expected Revenue (UGX)"><Input type="number" value={form.expectedRevenue} onChange={(e) => setForm({ ...form, expectedRevenue: +e.target.value })} /></FormField>
              <FormField label="Freight Cost"><Input type="number" value={form.costFreight} onChange={(e) => setForm({ ...form, costFreight: +e.target.value })} /></FormField>
              <FormField label="Packaging Cost"><Input type="number" value={form.costPackaging} onChange={(e) => setForm({ ...form, costPackaging: +e.target.value })} /></FormField>
              <FormActions onCancel={close} loading={loading} />
            </form>
          )}
        </FormModal>
      )}

      <DataTable columns={[
        { key: "shipmentNumber", header: "Shipment #" },
        { key: "customer", header: "Customer", render: (i) => String((i.customer as { name?: string })?.name || "-") },
        { key: "produce", header: "Produce", render: (i) => String((i.produce as { name?: string })?.name || "-") },
        { key: "destinationCountry", header: "Country" },
        { key: "quantity", header: "Qty" },
        { key: "netProfit", header: "Net Profit", render: (i) => formatCurrency(Number(i.netProfit)) },
        { key: "status", header: "Status", render: (i) => <StatusBadge status={String(i.status)} /> },
        { key: "id", header: "Actions", render: (i) => (
          <div className="flex gap-1">
            {i.status === "PLANNING" && <Button size="sm" variant="outline" onClick={() => handleStatus(String(i.id), "DISPATCHED")}>Dispatch</Button>}
            {i.status === "DISPATCHED" && <Button size="sm" variant="outline" onClick={() => handleStatus(String(i.id), "DELIVERED")}>Delivered</Button>}
            <FileUpload module="shipments" recordId={String(i.id)} />
          </div>
        ) },
      ]} data={items} />
    </div>
  );
}
