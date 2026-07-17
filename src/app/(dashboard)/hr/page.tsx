"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  CalendarCheck,
  Wallet,
  Building2,
  UserCheck,
  UserPlus,
  FileSignature,
  Star,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { HrTourTrigger } from "@/components/hr/hr-quick-tour";
import { PageLoader } from "@/components/ui/page-loader";

type Summary = {
  activeEmployees: number;
  onLeave: number;
  probation: number;
  pendingLeave: number;
  draftPayRuns: number;
  departments: number;
  presentToday: number;
  absentToday: number;
  monthPayrollNet: number;
  openJobs?: number;
  applicants?: number;
  expiringContracts?: number;
  pendingReviews?: number;
  activeTrainings?: number;
  holidaysThisMonth?: number;
};

export default function HrOverviewPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/hr")
      .then(async (r) => {
        const text = await r.text();
        if (!text) throw new Error(r.ok ? "Empty response" : `HTTP ${r.status}`);
        return JSON.parse(text) as { success?: boolean; data?: Summary };
      })
      .then((res) => {
        if (!cancelled && res.success && res.data) setSummary(res.data);
      })
      .catch((err) => console.error("HR summary fetch failed:", err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading && !summary) {
    return <PageLoader label="Loading HR overview…" />;
  }

  const cards = [
    {
      label: "Active staff",
      value: summary?.activeEmployees ?? "—",
      href: "/employees",
      icon: Users,
      tone: "dark" as const,
    },
    {
      label: "On leave",
      value: summary?.onLeave ?? "—",
      href: "/leave",
      icon: CalendarCheck,
      tone: "lime" as const,
    },
    {
      label: "Open roles",
      value: summary?.openJobs ?? "—",
      href: "/hr/recruitment",
      icon: UserPlus,
      tone: "light" as const,
    },
    {
      label: "Draft payroll",
      value: summary?.draftPayRuns ?? "—",
      href: "/payroll",
      icon: Wallet,
      tone: "light" as const,
    },
  ];

  const modules = [
    { href: "/employees", label: "Employees", desc: "Directory & profiles" },
    { href: "/hr/org", label: "Org chart", desc: "Reporting lines" },
    { href: "/leave", label: "Leave", desc: "Requests & balances" },
    { href: "/attendance", label: "Attendance", desc: "Daily registers" },
    { href: "/hr/holidays", label: "Holidays", desc: "Company calendar" },
    { href: "/hr/recruitment", label: "Recruitment", desc: "Jobs & applicants" },
    { href: "/hr/performance", label: "Performance", desc: "Reviews & goals" },
    { href: "/hr/training", label: "Training", desc: "Programs & enrollments" },
    { href: "/hr/contracts", label: "Contracts", desc: "Terms & renewals" },
    { href: "/hr/disciplinary", label: "Disciplinary", desc: "Warnings & actions" },
    { href: "/payroll", label: "Payroll", desc: "PAYE & NSSF runs" },
    { href: "/hr/reports", label: "Reports", desc: "HR analytics" },
  ];

  return (
    <div className="dash-page space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium tracking-wide text-[#5A6B5E]">Human resources</p>
          <h1 className="dash-title mt-1 text-3xl font-semibold tracking-tight text-[#0F1F12]">
            HR overview
          </h1>
          <p className="mt-1.5 max-w-xl text-sm text-slate-500">
            Full workforce lifecycle — hire, develop, attend, pay, and comply.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <HrTourTrigger variant="button" />
          <Link href="/hr/recruitment" className="dash-btn-secondary">
            Recruitment
          </Link>
          <Link href="/hr/reports" className="dash-btn-secondary">
            Reports
          </Link>
          <Link href="/payroll" className="dash-btn-primary">
            Run payroll
          </Link>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.label}
              href={card.href}
              className={`dash-kpi relative overflow-hidden rounded-2xl p-5 transition hover:scale-[1.01] ${
                card.tone === "dark"
                  ? "bg-gradient-to-br from-[#105820] to-[#1a6b28] text-white shadow-[0_14px_40px_rgba(16,88,32,0.22)]"
                  : card.tone === "lime"
                    ? "bg-gradient-to-br from-[#78B028] to-[#68A020] text-white shadow-[0_14px_40px_rgba(120,176,40,0.25)]"
                    : "dash-card"
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p
                    className={`text-sm font-medium ${
                      card.tone === "light" ? "text-slate-500" : "text-white/75"
                    }`}
                  >
                    {card.label}
                  </p>
                  <p
                    className={`mt-2 text-3xl font-semibold tabular-nums ${
                      card.tone === "light" ? "text-[#0F1F12]" : "text-white"
                    }`}
                  >
                    {card.value}
                  </p>
                </div>
                <span
                  className={`rounded-xl p-2.5 ${
                    card.tone === "light"
                      ? "bg-[#E8F2E0] text-[#105820]"
                      : "bg-white/15 text-white"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </span>
              </div>
            </Link>
          );
        })}
      </section>

      <section className="grid gap-4 lg:grid-cols-4">
        <article className="dash-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-[#105820]" />
            <h2 className="text-lg font-semibold text-[#0F1F12]">Organisation</h2>
          </div>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Departments</dt>
              <dd className="font-semibold">{summary?.departments ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">On probation</dt>
              <dd className="font-semibold">{summary?.probation ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Pending leave</dt>
              <dd className="font-semibold">{summary?.pendingLeave ?? "—"}</dd>
            </div>
          </dl>
        </article>

        <article className="dash-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-[#105820]" />
            <h2 className="text-lg font-semibold text-[#0F1F12]">Today</h2>
          </div>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Present / late</dt>
              <dd className="font-semibold text-[#105820]">{summary?.presentToday ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Absent</dt>
              <dd className="font-semibold text-red-600">{summary?.absentToday ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Holidays this month</dt>
              <dd className="font-semibold">{summary?.holidaysThisMonth ?? "—"}</dd>
            </div>
          </dl>
        </article>

        <article className="dash-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Star className="h-4 w-4 text-[#105820]" />
            <h2 className="text-lg font-semibold text-[#0F1F12]">Talent</h2>
          </div>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Active applicants</dt>
              <dd className="font-semibold">{summary?.applicants ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Pending reviews</dt>
              <dd className="font-semibold">{summary?.pendingReviews ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Active training</dt>
              <dd className="font-semibold">{summary?.activeTrainings ?? "—"}</dd>
            </div>
          </dl>
        </article>

        <article className="dash-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <FileSignature className="h-4 w-4 text-[#105820]" />
            <h2 className="text-lg font-semibold text-[#0F1F12]">Compliance</h2>
          </div>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Contracts expiring (30d)</dt>
              <dd className="font-semibold text-amber-700">
                {summary?.expiringContracts ?? "—"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Month payroll net</dt>
              <dd className="font-semibold tabular-nums">
                {summary ? formatCurrency(summary.monthPayrollNet) : "—"}
              </dd>
            </div>
          </dl>
        </article>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-[#0F1F12]">Modules</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {modules.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className="dash-card p-4 transition hover:border-[#78B028]/40"
            >
              <p className="font-semibold text-[#0F1F12]">{m.label}</p>
              <p className="mt-1 text-sm text-slate-500">{m.desc}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
