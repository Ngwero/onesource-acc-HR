"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, StatusBadge, formatCurrency } from "@/components/ui/data-table";
import { FormModal, FormField, FormActions } from "@/components/ui/form-modal";
import { CreditLimitAlert } from "@/components/ui/credit-limit-alert";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

type FollowUp = {
  id: string;
  note: string;
  channel: string;
  nextFollowUpAt?: string | null;
  createdAt: string;
  createdBy?: { fullName?: string };
};

export default function CollectionsPage() {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [filter, setFilter] = useState("overdue");
  const [fetching, setFetching] = useState(true);
  const [loading, setLoading] = useState(false);
  const [target, setTarget] = useState<Record<string, unknown> | null>(null);
  const [note, setNote] = useState("");
  const [channel, setChannel] = useState("PHONE");
  const [nextFollowUpAt, setNextFollowUpAt] = useState("");

  const load = useCallback(() => {
    setFetching(true);
    fetch(`/api/collections?filter=${filter}&limit=100`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setItems(res.data.items || []);
      })
      .finally(() => setFetching(false));
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const openFollowUp = (item: Record<string, unknown>) => {
    setTarget(item);
    setNote("");
    setChannel("PHONE");
    setNextFollowUpAt("");
  };

  const saveFollowUp = async (close: () => void) => {
    if (!target) return;
    setLoading(true);
    const res = await fetch("/api/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        receivableId: target.id,
        note,
        channel,
        nextFollowUpAt: nextFollowUpAt
          ? new Date(nextFollowUpAt).toISOString()
          : null,
      }),
    }).then((r) => r.json());
    setLoading(false);
    if (res.success) {
      load();
      close();
      setTarget(null);
    } else alert(res.message);
  };

  return (
    <div>
      <PageHeader
        title="Collections"
        description="Chase overdue receivables, log customer follow-ups, and schedule next contact"
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {[
          { id: "overdue", label: "Overdue" },
          { id: "due_soon", label: "Due in 7 days" },
          { id: "follow_up", label: "Follow-up due" },
        ].map((f) => (
          <Button
            key={f.id}
            size="sm"
            variant={filter === f.id ? "default" : "outline"}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      <FormModal
        title="Log collection follow-up"
        open={!!target}
        onOpenChange={(open) => {
          if (!open) setTarget(null);
        }}
      >
        {({ close }) =>
          target ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void saveFollowUp(close);
              }}
              className="space-y-3"
            >
              <p className="text-sm text-slate-600">
                {String((target.customer as { name?: string })?.name || "Customer")} ·{" "}
                {String(target.receivableNumber)} · Balance{" "}
                {formatCurrency(Number(target.balance))}
              </p>
              {(target.customer as { balance?: number; creditLimit?: number } | undefined) && (
                <CreditLimitAlert
                  balance={Number(
                    (target.customer as { balance?: number }).balance || 0
                  )}
                  creditLimit={Number(
                    (target.customer as { creditLimit?: number }).creditLimit || 0
                  )}
                  compact
                />
              )}
              <FormField label="Channel">
                <Select value={channel} onChange={(e) => setChannel(e.target.value)}>
                  {["PHONE", "EMAIL", "WHATSAPP", "VISIT", "OTHER"].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Notes">
                <Input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  required
                  placeholder="Promised payment Friday / no answer / dispute…"
                />
              </FormField>
              <FormField label="Next follow-up (optional)">
                <Input
                  type="datetime-local"
                  value={nextFollowUpAt}
                  onChange={(e) => setNextFollowUpAt(e.target.value)}
                />
              </FormField>
              <FormActions onCancel={close} loading={loading} submitLabel="Save follow-up" />
            </form>
          ) : null
        }
      </FormModal>

      <DataTable
        loading={fetching}
        columns={[
          {
            key: "receivableNumber",
            header: "Receivable",
            render: (i) => String(i.receivableNumber),
          },
          {
            key: "customer",
            header: "Customer",
            render: (i) => {
              const c = i.customer as { id?: string; name?: string; phone?: string };
              return (
                <div>
                  <Link
                    href={`/customers/${c.id}`}
                    className="font-medium text-green-800 underline-offset-2 hover:underline"
                  >
                    {c.name || "-"}
                  </Link>
                  {c.phone ? <p className="text-xs text-slate-500">{c.phone}</p> : null}
                </div>
              );
            },
          },
          {
            key: "balance",
            header: "Balance",
            render: (i) => formatCurrency(Number(i.balance)),
          },
          {
            key: "dueDate",
            header: "Due",
            render: (i) => (
              <div>
                <p>{formatDate(String(i.dueDate))}</p>
                {Number(i.daysOverdue) > 0 ? (
                  <p className="text-xs font-medium text-red-700">
                    {Number(i.daysOverdue)} days overdue
                  </p>
                ) : null}
              </div>
            ),
          },
          {
            key: "status",
            header: "Status",
            render: (i) => <StatusBadge status={String(i.status)} />,
          },
          {
            key: "collectionFollowUps",
            header: "Last contact",
            render: (i) => {
              const list = (i.collectionFollowUps as FollowUp[]) || [];
              const last = list[0];
              if (!last) return <span className="text-xs text-slate-400">None</span>;
              return (
                <div className="max-w-[220px]">
                  <p className="truncate text-sm">{last.note}</p>
                  <p className="text-xs text-slate-500">
                    {last.channel} · {formatDate(last.createdAt)}
                    {last.createdBy?.fullName ? ` · ${last.createdBy.fullName}` : ""}
                  </p>
                </div>
              );
            },
          },
          {
            key: "id",
            header: "Action",
            render: (i) => (
              <Button size="sm" onClick={() => openFollowUp(i)}>
                Follow up
              </Button>
            ),
          },
        ]}
        data={items}
      />
    </div>
  );
}
