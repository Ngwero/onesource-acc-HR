"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, StatusBadge, formatCurrency } from "@/components/ui/data-table";
import { FormModal, FormField, FormActions, apiPost } from "@/components/ui/form-modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

export default function ApprovalsPage() {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [status, setStatus] = useState("PENDING");
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/approvals?status=${status}&limit=100`)
      .then((r) => r.json())
      .then((res) => { if (res.success) setItems(res.data.items || []); });
  }, [status]);

  useEffect(() => { load(); }, [load]);

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
      <PageHeader title="Approvals" description="Pending approval requests and workflow" />
      <div className="mb-4 flex gap-2">
        {["PENDING", "APPROVED", "REJECTED"].map((s) => (
          <Button key={s} variant={status === s ? "default" : "outline"} size="sm" onClick={() => setStatus(s)}>{s}</Button>
        ))}
      </div>
      <DataTable columns={[
        { key: "requestType", header: "Type", render: (i) => {
          const t = String(i.requestType);
          return t === "PASSWORD_RESET" ? "Password Reset" : t;
        }},
        { key: "requestedBy", header: "Requested By", render: (i) => String((i.requestedBy as { fullName?: string })?.fullName || "-") },
        { key: "requestDate", header: "Date", render: (i) => formatDate(String(i.requestDate)) },
        { key: "recordModule", header: "Module" },
        { key: "amount", header: "Amount", render: (i) => i.amount ? formatCurrency(Number(i.amount)) : "-" },
        { key: "comments", header: "Comments", render: (i) => String(i.comments || "-") },
        { key: "status", header: "Status", render: (i) => <StatusBadge status={String(i.status)} /> },
        { key: "id", header: "Actions", render: (i) => i.status === "PENDING" ? (
          <div className="flex gap-1">
            <Button size="sm" disabled={loading} onClick={() => handleAction(String(i.id), "APPROVED")}>Approve</Button>
            <Button size="sm" variant="outline" disabled={loading} onClick={() => handleAction(String(i.id), "REJECTED")}>Reject</Button>
          </div>
        ) : null },
      ]} data={items} />
    </div>
  );
}
