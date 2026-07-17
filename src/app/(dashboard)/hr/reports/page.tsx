"use client";

import { useEffect, useState } from "react";

type Reports = {
  headcountByStatus: Array<{ status: string; count: number }>;
  headcountByDepartment: Array<{ department: string; count: number }>;
  hiresThisYear: number;
  terminationsThisYear: number;
  turnoverRate: number;
  attendanceMonth: Array<{ status: string; count: number }>;
  openJobs: number;
  applicantsPipeline: Array<{ status: string; count: number }>;
  expiringContracts: Array<{
    id: string;
    contractNumber: string;
    endDate: string;
    employee: { fullName: string };
  }>;
  pendingReviews: number;
  activeTrainings: number;
  disciplinaryYtd: number;
  leaveByType: Array<{
    leaveType: string;
    status: string;
    _count: { _all: number };
    _sum: { days: number | string | null };
  }>;
};

export default function HrReportsPage() {
  const [data, setData] = useState<Reports | null>(null);

  useEffect(() => {
    fetch("/api/hr/reports")
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setData(res.data);
      });
  }, []);

  const kpi = [
    { label: "Hires YTD", value: data?.hiresThisYear ?? "—" },
    { label: "Exits YTD", value: data?.terminationsThisYear ?? "—" },
    { label: "Turnover signal", value: data ? `${data.turnoverRate}%` : "—" },
    { label: "Open jobs", value: data?.openJobs ?? "—" },
    { label: "Pending reviews", value: data?.pendingReviews ?? "—" },
    { label: "Active training", value: data?.activeTrainings ?? "—" },
    { label: "Disciplinary YTD", value: data?.disciplinaryYtd ?? "—" },
    {
      label: "Contracts expiring (60d)",
      value: data?.expiringContracts.length ?? "—",
    },
  ];

  return (
    <div className="dash-page space-y-6">
      <header>
        <p className="text-sm font-medium text-[#5A6B5E]">Compliance</p>
        <h1 className="dash-title mt-1 text-3xl font-semibold text-[#0F1F12]">HR reports</h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Headcount, talent pipeline, leave, attendance, and compliance signals.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpi.map((k) => (
          <div key={k.label} className="dash-card p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              {k.label}
            </p>
            <p className="mt-2 text-2xl font-semibold text-[#0F1F12]">{k.value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="dash-card p-5">
          <h2 className="font-semibold text-[#0F1F12]">Headcount by status</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {(data?.headcountByStatus || []).map((r) => (
              <li key={r.status} className="flex justify-between">
                <span className="text-slate-600">{r.status.replace(/_/g, " ")}</span>
                <span className="font-semibold">{r.count}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="dash-card p-5">
          <h2 className="font-semibold text-[#0F1F12]">Headcount by department</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {(data?.headcountByDepartment || []).map((r) => (
              <li key={r.department} className="flex justify-between">
                <span className="text-slate-600">{r.department}</span>
                <span className="font-semibold">{r.count}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="dash-card p-5">
          <h2 className="font-semibold text-[#0F1F12]">Attendance this month</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {(data?.attendanceMonth || []).map((r) => (
              <li key={r.status} className="flex justify-between">
                <span className="text-slate-600">{r.status.replace(/_/g, " ")}</span>
                <span className="font-semibold">{r.count}</span>
              </li>
            ))}
            {!data?.attendanceMonth?.length && (
              <li className="text-slate-500">No attendance logged this month.</li>
            )}
          </ul>
        </div>
        <div className="dash-card p-5">
          <h2 className="font-semibold text-[#0F1F12]">Applicant pipeline</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {(data?.applicantsPipeline || []).map((r) => (
              <li key={r.status} className="flex justify-between">
                <span className="text-slate-600">{r.status}</span>
                <span className="font-semibold">{r.count}</span>
              </li>
            ))}
            {!data?.applicantsPipeline?.length && (
              <li className="text-slate-500">No applicants yet.</li>
            )}
          </ul>
        </div>
      </section>

      <section className="dash-card p-5">
        <h2 className="font-semibold text-[#0F1F12]">Contracts expiring within 60 days</h2>
        <ul className="mt-4 divide-y text-sm">
          {(data?.expiringContracts || []).map((c) => (
            <li key={c.id} className="flex justify-between py-2">
              <span>
                {c.employee.fullName}{" "}
                <span className="text-slate-400">({c.contractNumber})</span>
              </span>
              <span className="font-medium text-amber-700">
                {new Date(c.endDate).toLocaleDateString()}
              </span>
            </li>
          ))}
          {!data?.expiringContracts?.length && (
            <li className="py-2 text-slate-500">None upcoming.</li>
          )}
        </ul>
      </section>

      <section className="dash-card p-5">
        <h2 className="font-semibold text-[#0F1F12]">Leave utilization (YTD)</h2>
        <ul className="mt-4 space-y-2 text-sm">
          {(data?.leaveByType || []).map((r, i) => (
            <li key={`${r.leaveType}-${r.status}-${i}`} className="flex justify-between">
              <span className="text-slate-600">
                {r.leaveType} · {r.status}
              </span>
              <span className="font-semibold">
                {r._count._all} req · {Number(r._sum.days || 0)} days
              </span>
            </li>
          ))}
          {!data?.leaveByType?.length && (
            <li className="text-slate-500">No leave requests this year.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
