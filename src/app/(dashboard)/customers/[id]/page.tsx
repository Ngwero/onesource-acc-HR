"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, formatCurrency } from "@/components/ui/data-table";
import { formatDate } from "@/lib/utils";

export default function CustomerDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const [customer, setCustomer] = useState<Record<string, unknown> | null>(null);
  const [sales, setSales] = useState<Record<string, unknown>[]>([]);
  const [receivables, setReceivables] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetch(`/api/customers/${id}`).then((r) => r.json()),
      fetch(`/api/sales?customerId=${id}`).then((r) => r.json()),
      fetch("/api/receivables").then((r) => r.json()),
    ]).then(([c, s, r]) => {
      if (c.success) setCustomer(c.data);
      if (s.success) setSales(s.data.items || s.data || []);
      if (r.success) {
        const items = r.data.items || r.data || [];
        setReceivables(items.filter((x: Record<string, unknown>) => (x.customer as { id?: string })?.id === id || x.customerId === id));
      }
    });
  }, [id]);

  if (!customer) return <p className="p-6 text-gray-500">Loading customer...</p>;

  return (
    <div>
      <PageHeader
        title={String(customer.name)}
        description={`Customer detail — ${String(customer.code || customer.email || "")}`}
        actions={<Link href="/customers"><Button variant="outline">← Back</Button></Link>}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="p-4"><p className="text-xs text-gray-500">Status</p><StatusBadge status={String(customer.status)} /></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-gray-500">Credit Limit</p><p className="text-xl font-bold">{formatCurrency(Number(customer.creditLimit || 0))}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-gray-500">Payment Terms</p><p className="text-xl font-bold">{String(customer.paymentTerms || 30)} days</p></CardContent></Card>
      </div>

      <Card className="mb-6">
        <CardHeader><CardTitle>Contact Info</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>Email: {String(customer.email || "-")}</p>
          <p>Phone: {String(customer.phone || "-")}</p>
          <p>Address: {String(customer.address || "-")}</p>
        </CardContent>
      </Card>

      <h2 className="mb-3 text-lg font-semibold">Recent Sales</h2>
      <Card className="mb-6">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-gray-50"><th className="px-3 py-2 text-left">Sale #</th><th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-right">Amount</th></tr></thead>
            <tbody>
              {sales.slice(0, 10).map((s) => (
                <tr key={String(s.id)} className="border-b">
                  <td className="px-3 py-2">{String(s.saleNumber)}</td>
                  <td className="px-3 py-2">{formatDate(String(s.saleDate))}</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(Number(s.totalAmount))}</td>
                </tr>
              ))}
              {sales.length === 0 && <tr><td colSpan={3} className="px-3 py-4 text-gray-500">No sales yet</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <h2 className="mb-3 text-lg font-semibold">Open Receivables</h2>
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-gray-50"><th className="px-3 py-2 text-left">Due</th><th className="px-3 py-2 text-right">Balance</th><th className="px-3 py-2 text-left">Status</th></tr></thead>
            <tbody>
              {receivables.map((r) => (
                <tr key={String(r.id)} className="border-b">
                  <td className="px-3 py-2">{formatDate(String(r.dueDate))}</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(Number(r.balance))}</td>
                  <td className="px-3 py-2"><StatusBadge status={String(r.status)} /></td>
                </tr>
              ))}
              {receivables.length === 0 && <tr><td colSpan={3} className="px-3 py-4 text-gray-500">No open receivables</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
