"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, formatCurrency } from "@/components/ui/data-table";
import { FormModal, FormField, FormActions, apiPost } from "@/components/ui/form-modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

type AllocationRow = { id: string; targetId: string; amount: number };

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Record<string, unknown>[]>([]);
  const [payables, setPayables] = useState<Record<string, unknown>[]>([]);
  const [receivables, setReceivables] = useState<Record<string, unknown>[]>([]);
  const [bankAccounts, setBankAccounts] = useState<Record<string, unknown>[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [multiMode, setMultiMode] = useState(false);
  const [form, setForm] = useState({
    type: "payable",
    targetId: "",
    amount: 0,
    paymentMethod: "BANK_TRANSFER",
    bankAccountId: "",
    reference: "",
    notes: "",
  });
  const [allocations, setAllocations] = useState<AllocationRow[]>([
    { id: "1", targetId: "", amount: 0 },
  ]);

  const load = () => {
    Promise.all([
      fetch("/api/payments").then((r) => r.json()),
      fetch("/api/payables?limit=100").then((r) => r.json()),
      fetch("/api/receivables?limit=100").then((r) => r.json()),
      fetch("/api/bank").then((r) => r.json()),
    ]).then(([p, ap, ar, bank]) => {
      if (p.success) setPayments(p.data || []);
      if (ap.success) setPayables((ap.data.items || []).filter((i: Record<string, unknown>) => Number(i.balance) > 0));
      if (ar.success) setReceivables((ar.data.items || []).filter((i: Record<string, unknown>) => Number(i.balance) > 0));
      if (bank.success) setBankAccounts(bank.data || []);
    });
  };

  useEffect(() => { load(); }, []);

  const targets = form.type === "payable" ? payables : receivables;
  const allocTotal = allocations.reduce((s, a) => s + a.amount, 0);

  const addAllocationRow = () => {
    setAllocations([...allocations, { id: String(Date.now()), targetId: "", amount: 0 }]);
  };

  const handleCreate = async (close: () => void) => {
    setLoading(true);
    const body = multiMode
      ? {
          amount: allocTotal,
          paymentMethod: form.paymentMethod,
          bankAccountId: form.bankAccountId || undefined,
          reference: form.reference,
          notes: form.notes,
          allocations: allocations
            .filter((a) => a.targetId && a.amount > 0)
            .map((a) =>
              form.type === "payable"
                ? { payableId: a.targetId, amount: a.amount }
                : { receivableId: a.targetId, amount: a.amount }
            ),
        }
      : {
          amount: form.amount,
          paymentMethod: form.paymentMethod,
          bankAccountId: form.bankAccountId || undefined,
          reference: form.reference,
          notes: form.notes,
          ...(form.type === "payable" ? { payableId: form.targetId } : { receivableId: form.targetId }),
        };

    const res = await apiPost("/api/payments", body);
    setLoading(false);
    if (res.success) {
      load();
      close();
      setShowForm(false);
      setAllocations([{ id: "1", targetId: "", amount: 0 }]);
    } else alert(res.message);
  };

  return (
    <div>
      <PageHeader
        title="Payments"
        description="Record supplier and customer payments with single or multi-invoice allocation"
        actions={<Button onClick={() => setShowForm(true)}>Record Payment</Button>}
      />

      {showForm && (
        <FormModal title="Record Payment" open={showForm} onOpenChange={setShowForm}>
          {({ close }) => (
            <form onSubmit={(e) => { e.preventDefault(); handleCreate(close); }} className="space-y-3">
              <FormField label="Payment Type">
                <Select
                  value={form.type}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, type: e.target.value, targetId: "" }));
                    setAllocations([{ id: "1", targetId: "", amount: 0 }]);
                  }}
                >
                  <option value="payable">Pay Supplier (AP)</option>
                  <option value="receivable">Collect from Customer (AR)</option>
                </Select>
              </FormField>

              <FormField label="Allocation Mode">
                <Select value={multiMode ? "multi" : "single"} onChange={(e) => setMultiMode(e.target.value === "multi")}>
                  <option value="single">Single invoice/bill</option>
                  <option value="multi">Multiple invoices/bills</option>
                </Select>
              </FormField>

              {!multiMode ? (
                <>
                  <FormField label={form.type === "payable" ? "Payable" : "Receivable"}>
                    <Select
                      value={form.targetId}
                      onChange={(e) => {
                        const t = targets.find((x) => x.id === e.target.value);
                        setForm((prev) => ({ ...prev, targetId: e.target.value, amount: t ? Number(t.balance) : 0 }));
                      }}
                      required
                    >
                      <option value="">Select</option>
                      {targets.map((t) => (
                        <option key={String(t.id)} value={String(t.id)}>
                          {String(t.payableNumber || t.receivableNumber)} — {formatCurrency(Number(t.balance))}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  <FormField label="Amount">
                    <Input type="number" value={form.amount} onChange={(e) => setForm((prev) => ({ ...prev, amount: +e.target.value }))} required />
                  </FormField>
                </>
              ) : (
                <div className="space-y-2 rounded border p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Allocations</p>
                    <Button type="button" size="sm" variant="outline" onClick={addAllocationRow}>Add line</Button>
                  </div>
                  {allocations.map((row, idx) => (
                    <div key={row.id} className="grid grid-cols-2 gap-2">
                      <Select
                        value={row.targetId}
                        onChange={(e) => {
                          const t = targets.find((x) => x.id === e.target.value);
                          const next = [...allocations];
                          next[idx] = { ...row, targetId: e.target.value, amount: t ? Number(t.balance) : 0 };
                          setAllocations(next);
                        }}
                        required
                      >
                        <option value="">Select</option>
                        {targets.map((t) => (
                          <option key={String(t.id)} value={String(t.id)}>
                            {String(t.payableNumber || t.receivableNumber)} — {formatCurrency(Number(t.balance))}
                          </option>
                        ))}
                      </Select>
                      <Input
                        type="number"
                        value={row.amount}
                        onChange={(e) => {
                          const next = [...allocations];
                          next[idx] = { ...row, amount: +e.target.value };
                          setAllocations(next);
                        }}
                        required
                      />
                    </div>
                  ))}
                  <p className="text-sm text-gray-600">Total allocated: {formatCurrency(allocTotal)}</p>
                </div>
              )}

              <FormField label="Method">
                <Select value={form.paymentMethod} onChange={(e) => setForm((prev) => ({ ...prev, paymentMethod: e.target.value }))}>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="CASH">Cash</option>
                  <option value="MOBILE_MONEY">Mobile Money</option>
                  <option value="CHEQUE">Cheque</option>
                </Select>
              </FormField>

              {form.paymentMethod === "BANK_TRANSFER" && (
                <FormField label="Bank Account">
                  <Select value={form.bankAccountId} onChange={(e) => setForm((prev) => ({ ...prev, bankAccountId: e.target.value }))}>
                    <option value="">Select (optional)</option>
                    {bankAccounts.map((a) => (
                      <option key={String(a.id)} value={String(a.id)}>{String(a.name)}</option>
                    ))}
                  </Select>
                </FormField>
              )}

              <FormField label="Reference"><Input value={form.reference} onChange={(e) => setForm((prev) => ({ ...prev, reference: e.target.value }))} /></FormField>
              <FormActions onCancel={close} loading={loading} />
            </form>
          )}
        </FormModal>
      )}

      <DataTable
        columns={[
          { key: "paymentNumber", header: "Payment #" },
          { key: "date", header: "Date", render: (i) => formatDate(String(i.date)) },
          { key: "amount", header: "Amount", render: (i) => formatCurrency(Number(i.amount)) },
          { key: "paymentMethod", header: "Method" },
          {
            key: "allocations",
            header: "Allocated To",
            render: (i) => {
              const allocs = (i.allocations as Record<string, unknown>[]) || [];
              if (allocs.length > 1) return `${allocs.length} items`;
              if (allocs.length === 1) {
                const a = allocs[0];
                return String(
                  (a.payable as { payableNumber?: string })?.payableNumber ||
                  (a.receivable as { receivableNumber?: string })?.receivableNumber ||
                  "-"
                );
              }
              return String(
                (i.payable as { payableNumber?: string })?.payableNumber ||
                (i.receivable as { receivableNumber?: string })?.receivableNumber ||
                "-"
              );
            },
          },
          { key: "reference", header: "Reference" },
        ]}
        data={payments}
      />
    </div>
  );
}
