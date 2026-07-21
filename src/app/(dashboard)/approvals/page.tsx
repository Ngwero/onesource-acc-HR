"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, StatusBadge, formatCurrency } from "@/components/ui/data-table";
import { CreditLimitAlertView } from "@/components/ui/credit-limit-alert";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import type { CreditLimitStatus } from "@/lib/credit-limit";

type ApprovalContext = {
  kind: "CREDIT_SALE";
  saleId: string;
  saleNumber: string;
  saleStatus: string;
  customerId: string;
  customerName: string;
  customerCode: string;
  credit: CreditLimitStatus;
};

type ApprovalItem = Record<string, unknown> & {
  context?: ApprovalContext | null;
};

const TYPE_LABELS: Record<string, string> = {
  CREDIT_SALE: "Credit sale (limit)",
  LARGE_PURCHASE: "Large purchase",
  EXPENSE: "Expense",
  MANUAL_JOURNAL: "Manual journal",
  PASSWORD_RESET: "Password reset",
};

export default function ApprovalsPage() {
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [status, setStatus] = useState("PENDING");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  const load = useCallback(() => {
    setFetching(true);
    fetch(`/api/approvals?status=${status}&limit=100`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setItems(res.data.items || []);
      })
      .finally(() => setFetching(false));
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAction = async (id: string, action: "APPROVED" | "REJECTED") => {
    setLoading(true);
    const res = await fetch(`/api/approvals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: action }),
    }).then((r) => r.json());
    setLoading(false);
    if (res.success) load();
    else alert(res.message);
  };

  return (
    <div>
      <PageHeader
        title="Approvals"
        description="Review credit-limit breaches, expenses, journals, and other gated actions"
      />
      <div className="mb-4 flex gap-2">
        {["PENDING", "APPROVED", "REJECTED"].map((s) => (
          <Button
            key={s}
            variant={status === s ? "default" : "outline"}
            size="sm"
            onClick={() => setStatus(s)}
          >
            {s}
          </Button>
        ))}
      </div>
      <DataTable
        loading={fetching}
        columns={[
          {
            key: "requestType",
            header: "Type",
            render: (i) => TYPE_LABELS[String(i.requestType)] || String(i.requestType),
          },
          {
            key: "requestedBy",
            header: "Requested By",
            render: (i) => String((i.requestedBy as { fullName?: string })?.fullName || "-"),
          },
          {
            key: "requestDate",
            header: "Date",
            render: (i) => formatDate(String(i.requestDate)),
          },
          {
            key: "recordModule",
            header: "Details",
            render: (i) => {
              const ctx = (i as ApprovalItem).context;
              if (ctx?.kind === "CREDIT_SALE") {
                return (
                  <div className="max-w-sm space-y-2 py-1">
                    <p className="text-sm">
                      <Link
                        href={`/local-sales?search=${encodeURIComponent(ctx.saleNumber)}`}
                        className="font-medium text-green-800 underline-offset-2 hover:underline"
                      >
                        {ctx.saleNumber}
                      </Link>
                      {" · "}
                      <Link
                        href={`/customers/${ctx.customerId}`}
                        className="text-green-800 underline-offset-2 hover:underline"
                      >
                        {ctx.customerName}
                      </Link>
                    </p>
                    <CreditLimitAlertView
                      status={ctx.credit}
                      additionalAmount={Number(i.amount) || 0}
                      compact
                    />
                  </div>
                );
              }
              return (
                <span className="text-sm text-gray-600">
                  {String(i.recordModule || "-")}
                  {i.comments ? ` · ${String(i.comments).slice(0, 80)}` : ""}
                </span>
              );
            },
          },
          {
            key: "amount",
            header: "Amount",
            render: (i) => (i.amount ? formatCurrency(Number(i.amount)) : "-"),
          },
          {
            key: "status",
            header: "Status",
            render: (i) => <StatusBadge status={String(i.status)} />,
          },
          {
            key: "id",
            header: "Actions",
            render: (i) =>
              i.status === "PENDING" ? (
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    disabled={loading}
                    onClick={() => handleAction(String(i.id), "APPROVED")}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={loading}
                    onClick={() => handleAction(String(i.id), "REJECTED")}
                  >
                    Reject
                  </Button>
                </div>
              ) : null,
          },
        ]}
        data={items}
      />
    </div>
  );
}
