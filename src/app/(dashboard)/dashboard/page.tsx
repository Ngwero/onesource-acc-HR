"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  Boxes,
  FileWarning,
  Receipt,
  ShoppingCart,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { BRAND } from "@/lib/branding";
import { AccountingTourTrigger } from "@/components/accounting/accounting-quick-tour";
import { firstNameOf, useAppUserOptional } from "@/components/layout/user-context";
import { PageLoader } from "@/components/ui/page-loader";

const EXPENSE_COLORS = [
  BRAND.lime,
  BRAND.forest,
  "#4A9B3C",
  "#A8C96A",
  "#2D7A3A",
  "#94a3b8",
];
const SALES_COLORS = [BRAND.lime, BRAND.forest, "#4A9B3C", "#C8E88A"];

interface DashboardData {
  companyName: string;
  summary: {
    totalSales: number;
    totalExpenses: number;
    grossProfit: number;
    netProfit: number;
    monthNetProfit: number;
    netProfitChangePct: number;
    todaySales: number;
    weekSales: number;
    monthSales: number;
    cashBankBalance?: number;
    pendingPayables?: number;
    pendingReceivables?: number;
    stockValue?: number;
    unpaidInvoices?: number;
    overdueInvoices?: number;
    creditLimitAlertCount?: number;
  };
  creditLimitAlerts?: Array<{
    id: string;
    name: string;
    code: string;
    balance: number;
    creditLimit: number;
    utilizationPct: number;
    isOverLimit: boolean;
    isNearLimit: boolean;
  }>;
  expenseCategories: Array<{ name: string; amount: number }>;
  topProduce?: Array<{ name: string; quantity: number; revenue: number }>;
  salesSeries: { seriesNames: string[]; data: Array<Record<string, string | number>> };
  monthlyTrends: Array<{
    month: string;
    sales: number;
    expenses: number;
    grossProfit: number;
  }>;
  lowStockAlerts?: number;
}

function compactMoney(v: number) {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
  return String(Math.round(v));
}

function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-[#d5e8c8] bg-white px-3.5 py-2.5 shadow-lg shadow-slate-900/5">
      <p className="mb-1.5 text-xs font-medium text-slate-400">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-sm text-slate-700">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-500">{p.name}</span>
          <span className="ml-auto font-semibold tabular-nums">
            {formatCurrency(Number(p.value || 0))}
          </span>
        </p>
      ))}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="dash-page space-y-6">
      <PageLoader label="Loading dashboard…" />
      <div className="animate-pulse space-y-5 opacity-60">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-white/80" />
          ))}
        </div>
        <div className="grid gap-5 xl:grid-cols-2">
          <div className="h-64 rounded-2xl bg-white/80" />
          <div className="h-64 rounded-2xl bg-white/80" />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const user = useAppUserOptional();
  const firstName = firstNameOf(user?.fullName || "");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [salesRange, setSalesRange] = useState("6");
  const [visibleSeries, setVisibleSeries] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setLoading(true);
    fetch("/api/dashboard?filter=month")
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setData(res.data);
          const initial: Record<string, boolean> = {};
          for (const name of res.data.salesSeries?.seriesNames || []) {
            initial[name] = true;
          }
          setVisibleSeries(initial);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const expenseTotal = useMemo(
    () => (data?.expenseCategories || []).reduce((s, c) => s + c.amount, 0),
    [data]
  );

  const expensePie = useMemo(() => {
    const cats = data?.expenseCategories || [];
    if (cats.length === 0) return [{ name: "No expenses", amount: 1 }];
    return cats;
  }, [data]);

  const expenseLegend = useMemo(() => {
    const cats = data?.expenseCategories || [];
    const total = cats.reduce((s, c) => s + c.amount, 0) || 1;
    return cats.map((c, i) => ({
      ...c,
      pct: Math.round((c.amount / total) * 100),
      color: EXPENSE_COLORS[i % EXPENSE_COLORS.length],
    }));
  }, [data]);

  if (loading) return <Skeleton />;

  const s = data?.summary;
  const change = s?.netProfitChangePct || 0;
  const positive = change >= 0;
  const company = data?.companyName || "One Source";
  const seriesNames = data?.salesSeries?.seriesNames || [];
  const periodLabel = new Date().toLocaleString("en", { month: "long", year: "numeric" });
  const greetingHour = new Date().getHours();
  const greetingBase =
    greetingHour < 12 ? "Good morning" : greetingHour < 17 ? "Good afternoon" : "Good evening";
  const greeting = firstName ? `${greetingBase}, ${firstName}` : greetingBase;

  const kpis = [
    {
      label: "Net profit",
      value: s?.monthNetProfit ?? s?.netProfit ?? 0,
      hint: "This month",
      icon: TrendingUp,
      accent: "from-[#105820] to-[#1a6b28]",
      light: false,
    },
    {
      label: "Sales",
      value: s?.monthSales || 0,
      hint: "This month",
      icon: ShoppingCart,
      accent: "from-[#78B028] to-[#68A020]",
      light: false,
    },
    {
      label: "Expenses",
      value: s?.totalExpenses || 0,
      hint: "Approved & paid",
      icon: Receipt,
      accent: "bg-white",
      light: true,
    },
    {
      label: "Cash & bank",
      value: s?.cashBankBalance || 0,
      hint: "Available balance",
      icon: Wallet,
      accent: "bg-white",
      light: true,
    },
  ];

  const insights = [
    {
      label: "Receivables",
      value: formatCurrency(s?.pendingReceivables || 0),
      icon: Banknote,
      href: "/receivables",
    },
    {
      label: "Payables",
      value: formatCurrency(s?.pendingPayables || 0),
      icon: Receipt,
      href: "/payables",
    },
    {
      label: "Stock value",
      value: formatCurrency(s?.stockValue || 0),
      icon: Boxes,
      href: "/inventory",
    },
    {
      label: "Overdue invoices",
      value: String(s?.overdueInvoices || 0),
      icon: FileWarning,
      href: "/invoices",
    },
  ];

  const salesSlice = (data?.salesSeries?.data || []).slice(
    salesRange === "3" ? -3 : undefined
  );

  return (
    <div className="dash-page space-y-6">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium tracking-wide text-[#5A6B5E]">
            {greeting} · {periodLabel}
          </p>
          <h1 className="dash-title mt-1 text-3xl font-semibold tracking-tight text-[#0F1F12]">
            {company}
          </h1>
          <p className="mt-1.5 max-w-xl text-sm text-slate-500">
            Live view of sales, expenses, and cash position for the current period.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <AccountingTourTrigger variant="button" />
          <Link href="/reports" className="dash-btn-secondary">
            Reports
          </Link>
          <Link href="/invoices" className="dash-btn-primary">
            New invoice
          </Link>
        </div>
      </header>

      {(data?.creditLimitAlerts?.length || 0) > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 sm:px-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-amber-950">
                Credit limit alerts ({data?.summary.creditLimitAlertCount || data?.creditLimitAlerts?.length})
              </p>
              <p className="mt-0.5 text-xs text-amber-800/80">
                Customers at or near their credit limit need attention before more credit sales.
              </p>
            </div>
            <Link href="/customers" className="text-sm font-semibold text-amber-900 underline">
              View customers
            </Link>
          </div>
          <ul className="mt-3 space-y-1.5">
            {(data?.creditLimitAlerts || []).slice(0, 5).map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <Link href={`/customers/${c.id}`} className="font-medium text-amber-950 hover:underline">
                  {c.name}
                  <span className="ml-1 text-xs font-normal text-amber-800/70">({c.code})</span>
                </Link>
                <span className={c.isOverLimit ? "font-semibold text-red-700" : "text-amber-900"}>
                  {c.utilizationPct}% · {formatCurrency(c.balance)} / {formatCurrency(c.creditLimit)}
                  {c.isOverLimit ? " · OVER" : " · near"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* KPI strip */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <article
              key={kpi.label}
              className={`dash-kpi relative overflow-hidden rounded-2xl p-5 ${
                kpi.light
                  ? "border border-[#d5e8c8]/80 bg-white shadow-[0_10px_40px_rgba(16,88,32,0.04)]"
                  : `bg-gradient-to-br ${kpi.accent} text-white shadow-[0_14px_40px_rgba(16,88,32,0.22)]`
              }`}
              style={{ animationDelay: `${idx * 60}ms` }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p
                    className={`text-sm font-medium ${
                      kpi.light ? "text-slate-500" : "text-white/75"
                    }`}
                  >
                    {kpi.label}
                  </p>
                  <p
                    className={`mt-2 text-2xl font-semibold tracking-tight tabular-nums sm:text-[1.65rem] ${
                      kpi.light ? "text-[#0F1F12]" : "text-white"
                    }`}
                  >
                    {formatCurrency(kpi.value)}
                  </p>
                  <p
                    className={`mt-1.5 text-xs ${
                      kpi.light ? "text-slate-400" : "text-white/60"
                    }`}
                  >
                    {kpi.hint}
                  </p>
                </div>
                <div
                  className={`rounded-xl p-2.5 ${
                    kpi.light ? "bg-[#E8F2E0] text-[#105820]" : "bg-white/15 text-white"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              {idx === 0 && (
                <span
                  className={`mt-4 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                    positive
                      ? kpi.light
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-white/15 text-[#C8E88A]"
                      : kpi.light
                        ? "bg-red-50 text-red-600"
                        : "bg-white/15 text-red-200"
                  }`}
                >
                  {positive ? (
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  ) : (
                    <ArrowDownRight className="h-3.5 w-3.5" />
                  )}
                  {positive ? "+" : ""}
                  {change.toFixed(1)}% vs last month
                </span>
              )}
            </article>
          );
        })}
      </section>

      {/* Sales pulse + insights */}
      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="dash-card flex flex-wrap items-center gap-6 px-5 py-4">
          {[
            { label: "Today", value: s?.todaySales || 0 },
            { label: "Last 7 days", value: s?.weekSales || 0 },
            { label: "This month", value: s?.monthSales || 0 },
          ].map((item, i) => (
            <div key={item.label} className="min-w-[120px] flex-1">
              <p className="text-[11px] font-semibold tracking-[0.14em] text-slate-400 uppercase">
                {item.label}
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-[#0F1F12]">
                {formatCurrency(item.value)}
              </p>
              {i < 2 && (
                <div className="mt-3 hidden h-px bg-[#e8f2e0] sm:block lg:hidden" />
              )}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {insights.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={item.href}
                className="dash-card group flex items-center gap-3 px-3.5 py-3 transition hover:border-[#78B028]/40 hover:shadow-[0_8px_24px_rgba(16,88,32,0.06)]"
              >
                <span className="rounded-lg bg-[#E8F2E0] p-2 text-[#105820] transition group-hover:bg-[#78B028] group-hover:text-white">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[11px] font-medium text-slate-400">
                    {item.label}
                  </span>
                  <span className="block truncate text-sm font-semibold tabular-nums text-[#0F1F12]">
                    {item.value}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Charts */}
      <section className="grid gap-5 xl:grid-cols-2">
        <article className="dash-card p-5 sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h2 className="dash-title text-lg font-semibold text-[#0F1F12]">
                Financial performance
              </h2>
              <p className="mt-0.5 text-sm text-slate-400">Revenue, expenses & gross profit</p>
            </div>
            <div className="rounded-xl bg-[#F3F8F0] px-3 py-2 text-center">
              <p className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
                Period
              </p>
              <p className="text-sm font-semibold text-[#105820]">6 months</p>
            </div>
          </div>

          <div className="mb-3 flex flex-wrap gap-4 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#3b82f6]" /> Revenue
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#eab308]" /> Expenses
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: BRAND.lime }} />{" "}
              Gross profit
            </span>
          </div>

          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.monthlyTrends || []} barGap={4} barCategoryGap="28%">
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8f2e0" />
                <XAxis
                  dataKey="month"
                  tick={{ fill: "#94a3b8", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={compactMoney}
                />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="sales" name="Revenue" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="#eab308" radius={[6, 6, 0, 0]} />
                <Bar
                  dataKey="grossProfit"
                  name="Gross Profit"
                  fill={BRAND.lime}
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="dash-card p-5 sm:p-6">
          <div className="mb-1">
            <h2 className="dash-title text-lg font-semibold text-[#0F1F12]">Expenses</h2>
            <p className="text-sm text-slate-400">Top categories this period</p>
          </div>

          <div className="mt-2 flex flex-col items-center gap-6 sm:flex-row">
            <div className="relative h-[220px] w-full max-w-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expensePie}
                    dataKey="amount"
                    nameKey="name"
                    innerRadius={70}
                    outerRadius={98}
                    paddingAngle={3}
                    stroke="none"
                  >
                    {expensePie.map((_, i) => (
                      <Cell key={i} fill={EXPENSE_COLORS[i % EXPENSE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v) => formatCurrency(Number(v))}
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid #d5e8c8",
                      boxShadow: "0 10px 30px rgba(15,23,42,0.06)",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-[11px] font-medium tracking-wide text-slate-400 uppercase">
                  Total
                </p>
                <p className="mt-0.5 max-w-[110px] truncate text-center text-base font-bold tabular-nums text-[#0F1F12]">
                  {formatCurrency(expenseTotal)}
                </p>
              </div>
            </div>

            <ul className="w-full space-y-3">
              {expenseLegend.length === 0 && (
                <li className="text-sm text-slate-400">No expense data yet</li>
              )}
              {expenseLegend.map((item) => (
                <li key={item.name} className="flex items-center justify-between gap-3 text-sm">
                  <span className="inline-flex min-w-0 items-center gap-2 text-slate-600">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="truncate">{item.name}</span>
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums text-[#0F1F12]">
                    {item.pct}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </article>

        <article className="dash-card p-5 sm:p-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="dash-title text-lg font-semibold text-[#0F1F12]">Sales trend</h2>
              <p className="text-sm text-slate-400">By product category</p>
            </div>
            <select
              value={salesRange}
              onChange={(e) => setSalesRange(e.target.value)}
              className="rounded-xl border border-[#d5e8c8] bg-[#F3F8F0] px-3 py-1.5 text-sm text-[#105820] outline-none focus:border-[#78B028]"
            >
              <option value="6">Last 6 months</option>
              <option value="3">Last 3 months</option>
            </select>
          </div>

          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesSlice}>
                <defs>
                  {seriesNames.map((name, i) => (
                    <linearGradient key={name} id={`salesFill${i}`} x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor={SALES_COLORS[i % SALES_COLORS.length]}
                        stopOpacity={0.28}
                      />
                      <stop
                        offset="100%"
                        stopColor={SALES_COLORS[i % SALES_COLORS.length]}
                        stopOpacity={0}
                      />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8f2e0" />
                <XAxis
                  dataKey="month"
                  tick={{ fill: "#94a3b8", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={compactMoney}
                />
                <Tooltip content={<ChartTooltip />} />
                {seriesNames.map((name, i) =>
                  visibleSeries[name] === false ? null : (
                    <Area
                      key={name}
                      type="monotone"
                      dataKey={name}
                      stroke={SALES_COLORS[i % SALES_COLORS.length]}
                      fill={`url(#salesFill${i})`}
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  )
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 flex flex-wrap gap-4 border-t border-[#e8f2e0] pt-3">
            {seriesNames.map((name, i) => (
              <label
                key={name}
                className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-600"
              >
                <input
                  type="checkbox"
                  checked={visibleSeries[name] !== false}
                  onChange={() =>
                    setVisibleSeries((prev) => ({
                      ...prev,
                      [name]: prev[name] === false,
                    }))
                  }
                  className="h-3.5 w-3.5 rounded border-slate-300"
                  style={{ accentColor: SALES_COLORS[i % SALES_COLORS.length] }}
                />
                {name}
              </label>
            ))}
          </div>
        </article>

        <article className="dash-card p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="dash-title text-lg font-semibold text-[#0F1F12]">Top produce</h2>
              <p className="text-sm text-slate-400">Highest revenue this period</p>
            </div>
            <Link
              href="/produce"
              className="text-sm font-medium text-[#105820] hover:text-[#78B028]"
            >
              View all
            </Link>
          </div>

          <ul className="space-y-3">
            {(data?.topProduce || []).length === 0 && (
              <li className="rounded-xl bg-[#F3F8F0] px-4 py-8 text-center text-sm text-slate-400">
                No sales data yet
              </li>
            )}
            {(data?.topProduce || []).map((item, i) => {
              const max = data?.topProduce?.[0]?.revenue || 1;
              const pct = Math.max(8, Math.round((item.revenue / max) * 100));
              return (
                <li key={item.name} className="rounded-xl bg-[#F3F8F0]/70 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-xs font-bold text-[#105820] shadow-sm">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#0F1F12]">
                          {item.name}
                        </p>
                        <p className="text-xs text-slate-400">
                          Qty {Number(item.quantity).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <p className="shrink-0 text-sm font-semibold tabular-nums text-[#105820]">
                      {formatCurrency(item.revenue)}
                    </p>
                  </div>
                  <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#105820] to-[#78B028] transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </article>
      </section>
    </div>
  );
}
