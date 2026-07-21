"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, StatusBadge, formatCurrency } from "@/components/ui/data-table";
import { Card, CardContent } from "@/components/ui/card";
import { FormModal, FormField, FormActions } from "@/components/ui/form-modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

export default function PayablesPage() {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [aging, setAging] = useState<Record<string, number>>({});
  const [payTarget, setPayTarget] = useState<Record<string, unknown> | null>(null);
  const [amount, setAmount] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    fetch("/api/payables?limit=100").then((r) => r.json()).then((res) => {
      if (res.success) {
        setItems(res.data.items || []);
        setAging(res.data.aging || {});
      }
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const handlePay = async (close: () => void) => {
    if (!payTarget) return;
    setLoading(true);
    const res = await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payableId: payTarget.id, amount, paymentMethod: "BANK_TRANSFER" }),
    }).then((r) => r.json());
    setLoading(false);
    if (res.success) { load(); close(); setPayTarget(null); }
    else alert(res.message);
  };

  return (
    <div>
      <PageHeader title="Accounts Payable" description="Supplier and vendor payables" />
      <div className="mb-6 grid gap-3 sm:grid-cols-5">
        {[
          { label: "Current", key: "current" }, { label: "1-30 days", key: "days30" },
          { label: "31-60 days", key: "days60" }, { label: "61-90 days", key: "days90" }, { label: "90+ days", key: "over90" },
        ].map((a) => (
          <Card key={a.key}><CardContent className="p-3">
            <p className="text-xs text-gray-500">{a.label}</p>
            <p className="font-semibold text-green-900">{formatCurrency(Number(aging[a.key] || 0))}</p>
          </CardContent></Card>
        ))}
      </div>

      {payTarget && (
        <FormModal title={`Pay ${String((payTarget.supplier as { name?: string })?.name || "Supplier")}`} open={!!payTarget} onOpenChange={(o) => { if (!o) setPayTarget(null); }}>
          {({ close }) => (
            <form onSubmit={(e) => { e.preventDefault(); handlePay(close); }} className="space-y-3">
              <p className="text-sm">Balance: {formatCurrency(Number(payTarget.balance))}</p>
              <FormField label="Payment Amount">
                <Input type="number" value={amount} onChange={(e) => setAmount(+e.target.value)} required max={Number(payTarget.balance)} />
              </FormField>
              <FormActions onCancel={close} loading={loading} />
            </form>
          )}
        </FormModal>
      )}

      <DataTable columns={[
        { key: "payableNumber", header: "Payable #" },
        { key: "supplier", header: "Supplier", render: (i) => String((i.supplier as { name?: string })?.name || "-") },
        { key: "amount", header: "Amount", render: (i) => formatCurrency(Number(i.amount)) },
        { key: "balance", header: "Balance", render: (i) => formatCurrency(Number(i.balance)) },
        { key: "dueDate", header: "Due", render: (i) => formatDate(String(i.dueDate)) },
        { key: "status", header: "Status", render: (i) => <StatusBadge status={String(i.status)} /> },
        { key: "id", header: "Action", render: (i) => ["UNPAID", "PARTIALLY_PAID", "OVERDUE"].includes(String(i.status)) ? (
          <Button size="sm" onClick={() => { setPayTarget(i); setAmount(Number(i.balance)); }}>Pay</Button>
        ) : null },
      ]} data={items} />
    </div>
  );
}
