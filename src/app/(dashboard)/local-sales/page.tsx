"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, StatusBadge, formatCurrency } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FormModal, FormField, FormActions, apiPost } from "@/components/ui/form-modal";
import { Button } from "@/components/ui/button";
import { CreditLimitAlert } from "@/components/ui/credit-limit-alert";
import { formatDate } from "@/lib/utils";
import { evaluateCreditLimit } from "@/lib/credit-limit";

type LineItem = { produceId: string; quantity: number; unitPrice: number; grade: string };

const emptyForm = {
  customerId: "",
  saleDate: "",
  paymentMethod: "CASH",
  discount: 0,
  lines: [{ produceId: "", quantity: 0, unitPrice: 0, grade: "A" }] as LineItem[],
};

export default function LocalSalesPage() {
  const searchParams = useSearchParams();
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [customers, setCustomers] = useState<Record<string, unknown>[]>([]);
  const [produce, setProduce] = useState<Record<string, unknown>[]>([]);
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(() => {
    Promise.all([
      fetch(`/api/sales?limit=100`).then((r) => r.json()),
      fetch("/api/customers?limit=100").then((r) => r.json()),
      fetch("/api/produce?limit=100").then((r) => r.json()),
    ]).then(([s, c, p]) => {
      if (s.success) {
        const all = s.data.items || [];
        setItems(
          search
            ? all.filter((i: Record<string, unknown>) =>
                String(i.saleNumber).toLowerCase().includes(search.toLowerCase())
              )
            : all
        );
      }
      if (c.success) setCustomers(c.data.items || []);
      if (p.success) setProduce(p.data.items || []);
    });
  }, [search]);

  useEffect(() => {
    load();
  }, [load]);

  const selectedCustomer = useMemo(
    () => customers.find((c) => String(c.id) === form.customerId) || null,
    [customers, form.customerId]
  );

  const lineTotal = form.lines.reduce(
    (sum, l) => sum + Number(l.quantity || 0) * Number(l.unitPrice || 0),
    0
  );
  const saleTotal = Math.max(0, lineTotal - Number(form.discount || 0));
  const isCreditSale = form.paymentMethod !== "CASH";

  const creditStatus = selectedCustomer
    ? evaluateCreditLimit({
        balance: Number(selectedCustomer.balance || 0),
        creditLimit: Number(selectedCustomer.creditLimit || 0),
        additionalAmount: isCreditSale ? saleTotal : 0,
      })
    : null;

  const handleCreate = async (close: () => void) => {
    setLoading(true);
    const res = await apiPost("/api/sales", {
      customerId: form.customerId,
      saleDate: form.saleDate || undefined,
      paymentMethod: form.paymentMethod,
      discount: form.discount,
      items: form.lines.filter((l) => l.produceId && l.quantity > 0),
    });
    setLoading(false);
    if (res.success) {
      load();
      close();
      setShowForm(false);
      setForm(emptyForm);
    } else alert(res.message);
  };

  const handleConfirm = async (id: string) => {
    const res = await fetch(`/api/sales/${id}/confirm`, { method: "POST" }).then((r) =>
      r.json()
    );
    if (res.success) {
      alert("Sale confirmed — stock deducted, receivable created if credit");
      load();
    } else alert(res.message);
  };

  const updateLine = (i: number, patch: Partial<LineItem>) => {
    setForm((prev) => {
      const lines = [...prev.lines];
      lines[i] = { ...lines[i], ...patch };
      return { ...prev, lines };
    });
  };

  return (
    <div>
      <PageHeader
        title="Local Sales"
        description="Manage local produce sales and invoices"
        actions={<Button onClick={() => setShowForm(true)}>New Sale</Button>}
      />
      <div className="mb-4 flex gap-2">
        <Input
          placeholder="Search sales..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Button variant="outline" onClick={() => setSearch("")}>
          Clear
        </Button>
      </div>

      <FormModal title="New Local Sale" open={showForm} onOpenChange={setShowForm}>
        {({ close }) => (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleCreate(close);
            }}
            className="space-y-3"
          >
            <FormField label="Customer">
              <Select
                value={form.customerId}
                onChange={(e) => setForm((prev) => ({ ...prev, customerId: e.target.value }))}
                required
              >
                <option value="">Select customer</option>
                {customers.map((c) => (
                  <option key={String(c.id)} value={String(c.id)}>
                    {String(c.name)}
                    {Number(c.creditLimit) > 0
                      ? ` · limit ${formatCurrency(Number(c.creditLimit))}`
                      : ""}
                  </option>
                ))}
              </Select>
            </FormField>

            {selectedCustomer && isCreditSale && creditStatus && (
              <CreditLimitAlert
                balance={Number(selectedCustomer.balance || 0)}
                creditLimit={Number(selectedCustomer.creditLimit || 0)}
                additionalAmount={saleTotal}
              />
            )}

            <FormField label="Sale Date">
              <Input
                type="date"
                value={form.saleDate}
                onChange={(e) => setForm((prev) => ({ ...prev, saleDate: e.target.value }))}
              />
            </FormField>
            <FormField label="Payment Method">
              <Select
                value={form.paymentMethod}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, paymentMethod: e.target.value }))
                }
              >
                <option value="CASH">Cash</option>
                <option value="BANK_TRANSFER">Bank Transfer (credit)</option>
                <option value="MOBILE_MONEY">Mobile Money (credit)</option>
                <option value="CHEQUE">Cheque (credit)</option>
              </Select>
            </FormField>
            {form.lines.map((line, i) => (
              <div
                key={i}
                className="grid gap-2 rounded border border-green-100 p-3 sm:grid-cols-4"
              >
                <Select
                  value={line.produceId}
                  onChange={(e) => updateLine(i, { produceId: e.target.value })}
                  required
                >
                  <option value="">Produce</option>
                  {produce.map((p) => (
                    <option key={String(p.id)} value={String(p.id)}>
                      {String(p.name)}
                    </option>
                  ))}
                </Select>
                <Input
                  type="number"
                  placeholder="Qty"
                  value={line.quantity || ""}
                  onChange={(e) => updateLine(i, { quantity: +e.target.value })}
                />
                <Input
                  type="number"
                  placeholder="Unit price"
                  value={line.unitPrice || ""}
                  onChange={(e) => updateLine(i, { unitPrice: +e.target.value })}
                />
                <Select
                  value={line.grade}
                  onChange={(e) => updateLine(i, { grade: e.target.value })}
                >
                  <option value="A">A</option>
                  <option value="B">B</option>
                </Select>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setForm((prev) => ({
                  ...prev,
                  lines: [...prev.lines, { produceId: "", quantity: 0, unitPrice: 0, grade: "A" }],
                }))
              }
            >
              + Add line
            </Button>
            <FormField label="Discount">
              <Input
                type="number"
                value={form.discount}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, discount: +e.target.value }))
                }
              />
            </FormField>
            {saleTotal > 0 && (
              <p className="text-sm font-medium text-[#105820]">
                Sale total: {formatCurrency(saleTotal)}
              </p>
            )}
            <FormActions onCancel={close} loading={loading} />
          </form>
        )}
      </FormModal>

      <DataTable
        columns={[
          { key: "saleNumber", header: "Sale #" },
          {
            key: "saleDate",
            header: "Date",
            render: (i) => formatDate(String(i.saleDate)),
          },
          {
            key: "customer",
            header: "Customer",
            render: (i) => String((i.customer as { name?: string })?.name || "-"),
          },
          {
            key: "totalAmount",
            header: "Amount",
            render: (i) => formatCurrency(Number(i.totalAmount)),
          },
          {
            key: "paymentStatus",
            header: "Payment",
            render: (i) => <StatusBadge status={String(i.paymentStatus)} />,
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
              i.status === "DRAFT" ? (
                <Button size="sm" onClick={() => handleConfirm(String(i.id))}>
                  Confirm
                </Button>
              ) : null,
          },
        ]}
        data={items}
      />
    </div>
  );
}
