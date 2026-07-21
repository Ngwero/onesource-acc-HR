"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, StatusBadge, formatCurrency } from "@/components/ui/data-table";
import { Card, CardContent } from "@/components/ui/card";
import { FormModal, FormField, FormActions } from "@/components/ui/form-modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CreditLimitAlert } from "@/components/ui/credit-limit-alert";
import { evaluateCreditLimit } from "@/lib/credit-limit";
import { formatDate } from "@/lib/utils";

export default function ReceivablesPage() {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [aging, setAging] = useState<Record<string, number>>({});
  const [collectTarget, setCollectTarget] = useState<Record<string, unknown> | null>(null);
  const [amount, setAmount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  const load = useCallback(() => {
    setFetching(true);
    fetch("/api/receivables?limit=100")
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setItems(res.data.items || []);
          setAging(res.data.aging || {});
        }
      })
      .finally(() => setFetching(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCollect = async (close: () => void) => {
    if (!collectTarget) return;
    setLoading(true);
    const res = await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receivableId: collectTarget.id, amount, paymentMethod: "BANK_TRANSFER" }),
    }).then((r) => r.json());
    setLoading(false);
    if (res.success) { load(); close(); setCollectTarget(null); }
    else alert(res.message);
  };

  return (
    <div>
      <PageHeader title="Accounts Receivable" description="Customer receivables and collections" />
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

      <FormModal
        title={`Collect from ${String((collectTarget?.customer as { name?: string } | undefined)?.name || "Customer")}`}
        open={!!collectTarget}
        onOpenChange={(o) => {
          if (!o) setCollectTarget(null);
        }}
      >
        {({ close }) =>
          collectTarget ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCollect(close);
              }}
              className="space-y-3"
            >
              <p className="text-sm">
                Receivable balance: {formatCurrency(Number(collectTarget.balance))}
              </p>
              {(collectTarget.customer as { balance?: number; creditLimit?: number } | undefined) && (
                <CreditLimitAlert
                  balance={Number(
                    (collectTarget.customer as { balance?: number }).balance || 0
                  )}
                  creditLimit={Number(
                    (collectTarget.customer as { creditLimit?: number }).creditLimit || 0
                  )}
                  compact
                />
              )}
              <FormField label="Collection Amount">
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(+e.target.value)}
                  required
                  max={Number(collectTarget.balance)}
                />
              </FormField>
              <FormActions onCancel={close} loading={loading} />
            </form>
          ) : null
        }
      </FormModal>

      <DataTable
        loading={fetching}
        columns={[
          { key: "receivableNumber", header: "Receivable #" },
          {
            key: "customer",
            header: "Customer",
            render: (i) => String((i.customer as { name?: string })?.name || "-"),
          },
          {
            key: "credit",
            header: "Credit",
            render: (i) => {
              const customer = i.customer as
                | { balance?: number; creditLimit?: number }
                | undefined;
              if (!customer) return "-";
              const status = evaluateCreditLimit({
                balance: Number(customer.balance || 0),
                creditLimit: Number(customer.creditLimit || 0),
              });
              if (status.creditLimit <= 0) {
                return <span className="text-xs text-amber-700">No limit</span>;
              }
              if (status.isOverLimit) {
                return <span className="text-xs font-medium text-red-700">Over limit</span>;
              }
              if (status.isNearLimit) {
                return <span className="text-xs text-amber-700">{status.utilizationPct}% used</span>;
              }
              return <span className="text-xs text-green-800">{status.utilizationPct}% used</span>;
            },
          },
          { key: "amount", header: "Amount", render: (i) => formatCurrency(Number(i.amount)) },
          { key: "balance", header: "Balance", render: (i) => formatCurrency(Number(i.balance)) },
          { key: "dueDate", header: "Due", render: (i) => formatDate(String(i.dueDate)) },
          {
            key: "status",
            header: "Status",
            render: (i) => <StatusBadge status={String(i.status)} />,
          },
          {
            key: "id",
            header: "Action",
            render: (i) =>
              ["UNPAID", "PARTIALLY_PAID", "OVERDUE"].includes(String(i.status)) ? (
                <Button
                  size="sm"
                  onClick={() => {
                    setCollectTarget(i);
                    setAmount(Number(i.balance));
                  }}
                >
                  Collect
                </Button>
              ) : null,
          },
        ]}
        data={items}
      />
    </div>
  );
}
