"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, StatusBadge, formatCurrency } from "@/components/ui/data-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageLoader } from "@/components/ui/page-loader";
import { formatDate } from "@/lib/utils";

interface XeroModulePageProps {
  title: string;
  description: string;
  module: string;
  columns: Array<{
    key: string;
    header: string;
    render?: (item: Record<string, unknown>) => React.ReactNode;
  }>;
}

export function XeroModulePage({ title, description, module, columns }: XeroModulePageProps) {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/xero?module=${module}`)
      .then((r) => r.json())
      .then((res) => { if (res.success) setItems(Array.isArray(res.data) ? res.data : []); })
      .finally(() => setLoading(false));
  }, [module]);

  return (
    <div>
      <PageHeader title={title} description={description} />
      {loading ? (
        <PageLoader compact label="Loading…" />
      ) : (
        <DataTable columns={columns} data={items} />
      )}
    </div>
  );
}

export function XeroHubPage() {
  const [cashflow, setCashflow] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    fetch("/api/xero?module=cashflow")
      .then((r) => r.json())
      .then((res) => { if (res.success) setCashflow(res.data); });
  }, []);

  const features = [
    { href: "/bank", title: "Bank Accounts", desc: "Multi-account, feeds, reconciliation, batch payments" },
    { href: "/quotes", title: "Quotes", desc: "Send quotes and convert to invoices" },
    { href: "/credit-notes", title: "Credit Notes", desc: "Sales & purchase credit notes" },
    { href: "/purchase-orders", title: "Purchase Orders", desc: "PO approval before goods receipt" },
    { href: "/recurring", title: "Repeating Bills & Invoices", desc: "Automated recurring transactions" },
    { href: "/tax", title: "Tax / VAT", desc: "Tax codes and tax reporting" },
    { href: "/budgets", title: "Budgets", desc: "Budget vs actual by account" },
    { href: "/fixed-assets", title: "Fixed Assets", desc: "Asset register and depreciation" },
    { href: "/invoices", title: "Invoicing", desc: "Create, send, and download PDF invoices" },
    { href: "/reports", title: "Financial Reports", desc: "P&L, Balance Sheet, Cash Flow" },
  ];

  return (
    <div>
      <PageHeader
        title="Xero-Style Accounting"
        description="Bank reconciliation, quotes, credit notes, tax, budgets, and cash flow forecasting"
      />

      {cashflow && (
        <div className="mb-6 grid gap-4 sm:grid-cols-4">
          <Card><CardContent className="p-4"><p className="text-xs text-gray-500">Bank Balance</p><p className="text-xl font-bold">{formatCurrency(Number(cashflow.openingCash))}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-gray-500">Projected Inflows (90d)</p><p className="text-xl font-bold text-green-700">{formatCurrency(Number(cashflow.projectedInflows))}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-gray-500">Projected Outflows (90d)</p><p className="text-xl font-bold text-red-600">{formatCurrency(Number(cashflow.projectedOutflows))}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-gray-500">Forecast Closing</p><p className="text-xl font-bold">{formatCurrency(Number(cashflow.projectedClosing))}</p></CardContent></Card>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <a key={f.href} href={f.href} className="block rounded-lg border border-green-100 bg-white p-5 shadow-sm transition hover:border-green-300 hover:shadow-md">
            <h3 className="font-semibold text-green-900">{f.title}</h3>
            <p className="mt-1 text-sm text-gray-500">{f.desc}</p>
          </a>
        ))}
      </div>
    </div>
  );
}

export { StatusBadge, formatCurrency, formatDate };
