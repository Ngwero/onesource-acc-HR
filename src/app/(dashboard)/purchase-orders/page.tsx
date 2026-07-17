"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, StatusBadge, formatCurrency } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FormModal, FormField, FormActions, apiPost } from "@/components/ui/form-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { xeroDelete } from "@/lib/xero-actions";

export default function PurchaseOrdersPage() {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [suppliers, setSuppliers] = useState<Record<string, unknown>[]>([]);
  const [produces, setProduces] = useState<Record<string, unknown>[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [receiveTarget, setReceiveTarget] = useState<Record<string, unknown> | null>(null);
  const [matchData, setMatchData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    supplierId: "", expectedDate: "", produceId: "", description: "", quantity: 1, unitPrice: 0, notes: "",
  });
  const [receiveForm, setReceiveForm] = useState({ acceptedQuantity: 0, transportCost: 0, loadingCost: 0 });

  const load = useCallback(() => {
    Promise.all([
      fetch("/api/xero?module=purchase-orders").then((r) => r.json()),
      fetch("/api/suppliers").then((r) => r.json()),
      fetch("/api/produce").then((r) => r.json()),
    ]).then(([po, s, p]) => {
      if (po.success) setItems(po.data);
      if (s.success) setSuppliers(s.data.items || []);
      if (p.success) setProduces(p.data.items || p.data || []);
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (close: () => void) => {
    setLoading(true);
    const res = await apiPost("/api/xero", {
      module: "purchase-orders",
      supplierId: form.supplierId,
      expectedDate: form.expectedDate,
      notes: form.notes,
      items: [{
        description: form.description,
        quantity: form.quantity,
        unitPrice: form.unitPrice,
        produceId: form.produceId || undefined,
      }],
    });
    setLoading(false);
    if (res.success) { load(); close(); setShowForm(false); }
    else alert(res.message);
  };

  const approvePo = async (poId: string) => {
    setLoading(true);
    const res = await apiPost("/api/xero", { module: "purchase-orders-approve", poId });
    setLoading(false);
    if (res.success) load();
    else alert(res.message);
  };

  const openReceive = (po: Record<string, unknown>) => {
    const poItems = (po.items as Record<string, unknown>[]) || [];
    const first = poItems[0];
    const remaining = first
      ? Number(first.quantity) - Number(first.quantityReceived || 0)
      : 0;
    setReceiveTarget(po);
    setReceiveForm({ acceptedQuantity: remaining, transportCost: 0, loadingCost: 0 });
  };

  const handleReceive = async (close: () => void) => {
    if (!receiveTarget) return;
    const poItems = (receiveTarget.items as Record<string, unknown>[]) || [];
    const first = poItems[0];
    if (!first) return alert("PO has no lines");

    setLoading(true);
    const res = await apiPost("/api/xero", {
      module: "purchase-orders-receive",
      poId: receiveTarget.id,
      transportCost: receiveForm.transportCost,
      loadingCost: receiveForm.loadingCost,
      items: [{
        poItemId: first.id,
        acceptedQuantity: receiveForm.acceptedQuantity,
      }],
    });
    setLoading(false);
    if (res.success) {
      alert(`Receipt ${res.data?.purchaseNumber} created. Confirm it on Purchases page to post the bill.`);
      load();
      close();
      setReceiveTarget(null);
    } else alert(res.message);
  };

  const viewMatch = async (poId: string) => {
    const res = await fetch(`/api/xero?module=purchase-order-match&poId=${poId}`).then((r) => r.json());
    if (res.success) setMatchData(res.data);
    else alert(res.message);
  };

  const confirmPurchase = async (purchaseId: string) => {
    setLoading(true);
    const res = await fetch(`/api/purchases/${purchaseId}/confirm`, { method: "POST" }).then((r) => r.json());
    setLoading(false);
    if (res.success) { alert("Purchase confirmed with three-way match"); load(); setMatchData(null); }
    else alert(res.message);
  };

  return (
    <div>
      <PageHeader title="Purchase Orders" description="PO → receipt → bill with three-way match validation" actions={
        <Button onClick={() => setShowForm(true)}>New Purchase Order</Button>
      } />

      {showForm && (
        <FormModal title="New Purchase Order" open onOpenChange={setShowForm}>
          {({ close }) => (
            <form onSubmit={(e) => { e.preventDefault(); handleCreate(close); }} className="space-y-3">
              <FormField label="Supplier">
                <Select value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })} required>
                  <option value="">Select supplier</option>
                  {suppliers.map((s) => <option key={String(s.id)} value={String(s.id)}>{String(s.name)}</option>)}
                </Select>
              </FormField>
              <FormField label="Produce">
                <Select value={form.produceId} onChange={(e) => setForm({ ...form, produceId: e.target.value })} required>
                  <option value="">Select produce</option>
                  {produces.map((p) => <option key={String(p.id)} value={String(p.id)}>{String(p.name)}</option>)}
                </Select>
              </FormField>
              <FormField label="Expected Date"><Input type="date" value={form.expectedDate} onChange={(e) => setForm({ ...form, expectedDate: e.target.value })} /></FormField>
              <FormField label="Item Description"><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required /></FormField>
              <FormField label="Quantity"><Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: +e.target.value })} /></FormField>
              <FormField label="Unit Price"><Input type="number" value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: +e.target.value })} /></FormField>
              <FormField label="Notes"><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></FormField>
              <FormActions onCancel={close} loading={loading} />
            </form>
          )}
        </FormModal>
      )}

      {receiveTarget && (
        <FormModal title={`Receive against ${String(receiveTarget.poNumber)}`} open onOpenChange={() => setReceiveTarget(null)}>
          {({ close }) => (
            <form onSubmit={(e) => { e.preventDefault(); handleReceive(close); }} className="space-y-3">
              <FormField label="Accepted Quantity">
                <Input type="number" value={receiveForm.acceptedQuantity} onChange={(e) => setReceiveForm({ ...receiveForm, acceptedQuantity: +e.target.value })} required />
              </FormField>
              <FormField label="Transport Cost"><Input type="number" value={receiveForm.transportCost} onChange={(e) => setReceiveForm({ ...receiveForm, transportCost: +e.target.value })} /></FormField>
              <FormField label="Loading Cost"><Input type="number" value={receiveForm.loadingCost} onChange={(e) => setReceiveForm({ ...receiveForm, loadingCost: +e.target.value })} /></FormField>
              <FormActions onCancel={close} loading={loading} />
            </form>
          )}
        </FormModal>
      )}

      {matchData && (
        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Three-Way Match — {String(matchData.poNumber)}</CardTitle>
            <Button size="sm" variant="outline" onClick={() => setMatchData(null)}>Close</Button>
          </CardHeader>
          <CardContent>
            <p className={`mb-3 text-sm ${(matchData.summary as { allMatched?: boolean })?.allMatched ? "text-green-700" : "text-amber-700"}`}>
              {(matchData.summary as { allMatched?: boolean })?.allMatched
                ? "PO, receipt, and bill quantities/prices match within tolerance."
                : "Variances detected — review before confirming purchase."}
            </p>
            <DataTable columns={[
              { key: "description", header: "Line" },
              { key: "orderedQty", header: "Ordered" },
              { key: "receivedQty", header: "Received" },
              { key: "billedQty", header: "Billed" },
              { key: "priceVariancePct", header: "Price Δ%", render: (i) => `${Number(i.priceVariancePct).toFixed(1)}%` },
              { key: "isMatched", header: "Match", render: (i) => (i.isMatched ? "✓" : "✗") },
            ]} data={(matchData.lines as Record<string, unknown>[]) || []} />
          </CardContent>
        </Card>
      )}

      <DataTable columns={[
        { key: "poNumber", header: "PO #" },
        { key: "supplier", header: "Supplier", render: (i) => String((i.supplier as { name?: string })?.name || "-") },
        { key: "date", header: "Date", render: (i) => formatDate(String(i.date)) },
        { key: "total", header: "Total", render: (i) => formatCurrency(Number(i.total)) },
        { key: "status", header: "Status", render: (i) => <StatusBadge status={String(i.status)} /> },
        {
          key: "id",
          header: "Actions",
          render: (i) => {
            const status = String(i.status);
            const purchases = (i.purchases as Record<string, unknown>[]) || [];
            const draftPurchase = purchases.find((p) => p.status === "DRAFT");
            return (
              <div className="flex flex-wrap gap-2">
                {["DRAFT", "SENT"].includes(status) && (
                  <button type="button" className="text-xs text-green-700 hover:underline" onClick={() => approvePo(String(i.id))}>
                    Approve
                  </button>
                )}
                {["APPROVED", "PARTIALLY_RECEIVED"].includes(status) && (
                  <button type="button" className="text-xs text-blue-700 hover:underline" onClick={() => openReceive(i)}>
                    Receive
                  </button>
                )}
                <button type="button" className="text-xs text-gray-700 hover:underline" onClick={() => viewMatch(String(i.id))}>
                  3-Way Match
                </button>
                {draftPurchase && (
                  <button type="button" className="text-xs text-purple-700 hover:underline" onClick={() => confirmPurchase(String(draftPurchase.id))}>
                    Confirm Bill
                  </button>
                )}
                <button
                  type="button"
                  className="text-xs text-red-600 hover:underline"
                  onClick={async () => {
                    if (!confirm("Cancel this PO?")) return;
                    const res = await xeroDelete("purchase-orders", String(i.id));
                    if (res.success) load();
                    else alert(res.message);
                  }}
                >
                  Cancel
                </button>
              </div>
            );
          },
        },
      ]} data={items} />
    </div>
  );
}
