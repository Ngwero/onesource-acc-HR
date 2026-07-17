"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, StatusBadge, formatCurrency } from "@/components/ui/data-table";
import { Select } from "@/components/ui/select";
import { FormModal, FormField, FormActions, apiPost } from "@/components/ui/form-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";
import { FileUpload } from "@/components/ui/file-upload";

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Record<string, unknown>[]>([]);
  const [sales, setSales] = useState<Record<string, unknown>[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saleId, setSaleId] = useState("");

  const load = useCallback(() => {
    Promise.all([
      fetch("/api/invoices").then((r) => r.json()),
      fetch("/api/sales").then((r) => r.json()),
    ]).then(([inv, sal]) => {
      if (inv.success) setInvoices(inv.data);
      if (sal.success) setSales(sal.data.items || sal.data || []);
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (close: () => void) => {
    setLoading(true);
    const res = await apiPost("/api/invoices", { saleId });
    setLoading(false);
    if (res.success) { load(); close(); setShowForm(false); }
    else alert(res.message);
  };

  const invoiceAction = async (id: string, action: string) => {
    const res = await fetch(`/api/invoices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    }).then((r) => r.json());
    if (res.success) { if (action === "email") alert(res.message); load(); }
    else alert(res.message);
  };

  const displayStatus = (i: Record<string, unknown>) => {
    const notes = String(i.notes || "");
    if (notes.startsWith("[VOIDED]")) return "VOIDED";
    return String(i.status);
  };

  return (
    <div>
      <PageHeader title="Invoices" description="Create, manage, email, and download PDF invoices" actions={
        <Button onClick={() => setShowForm(true)}>Create from Sale</Button>
      } />

      {showForm && (
        <FormModal title="Create Invoice from Sale" open onOpenChange={setShowForm}>
          {({ close }) => (
            <form onSubmit={(e) => { e.preventDefault(); handleCreate(close); }} className="space-y-3">
              <FormField label="Select Sale">
                <Select value={saleId} onChange={(e) => setSaleId(e.target.value)} required>
                  <option value="">Select sale</option>
                  {sales.map((s) => (
                    <option key={String(s.id)} value={String(s.id)}>
                      {String(s.saleNumber)} — {formatCurrency(Number(s.totalAmount))}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormActions onCancel={close} loading={loading} />
            </form>
          )}
        </FormModal>
      )}

      <DataTable columns={[
        { key: "invoiceNumber", header: "Invoice #" },
        { key: "customer", header: "Customer", render: (i) => String((i.customer as { name?: string })?.name || "-") },
        { key: "date", header: "Date", render: (i) => formatDate(String(i.date)) },
        { key: "dueDate", header: "Due", render: (i) => formatDate(String(i.dueDate)) },
        { key: "total", header: "Total", render: (i) => formatCurrency(Number(i.total)) },
        { key: "balance", header: "Balance", render: (i) => formatCurrency(Number(i.balance)) },
        { key: "status", header: "Status", render: (i) => <StatusBadge status={displayStatus(i)} /> },
        { key: "id", header: "Actions", render: (i) => {
          const voided = String(i.notes || "").startsWith("[VOIDED]");
          return (
            <div className="flex flex-wrap gap-1">
              <a href={`/api/invoices?id=${i.id}&format=pdf`} target="_blank" rel="noreferrer">
                <Button size="sm" variant="outline">PDF</Button>
              </a>
              {!voided && i.status !== "PAID" && (
                <>
                  <Button size="sm" variant="outline" onClick={() => invoiceAction(String(i.id), "mark-paid")}>Paid</Button>
                  <Button size="sm" variant="outline" onClick={() => invoiceAction(String(i.id), "void")}>Void</Button>
                </>
              )}
              <Button size="sm" variant="outline" onClick={() => invoiceAction(String(i.id), "email")}>Email</Button>
              <FileUpload module="invoices" recordId={String(i.id)} onUploaded={load} />
            </div>
          );
        } },
      ]} data={invoices} />
    </div>
  );
}
