"use client";

import { useEffect, useState } from "react";
import { FormModal, FormField, FormActions } from "@/components/ui/form-modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatDate } from "@/lib/utils";

type Review = {
  id: string;
  reviewNumber: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  overallRating?: number | string | null;
  strengths?: string | null;
  improvements?: string | null;
  goals?: string | null;
  employee: { fullName: string; employeeNumber: string };
  reviewer: { fullName: string };
};

type Emp = { id: string; fullName: string };

export default function PerformancePage() {
  const [items, setItems] = useState<Review[]>([]);
  const [employees, setEmployees] = useState<Emp[]>([]);
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({
    employeeId: "",
    periodStart: "",
    periodEnd: "",
    overallRating: "",
    strengths: "",
    improvements: "",
    goals: "",
    status: "DRAFT",
  });

  const load = () => {
    Promise.all([
      fetch("/api/hr/performance").then((r) => r.json()),
      fetch("/api/employees?status=ACTIVE").then((r) => r.json()),
    ]).then(([r, e]) => {
      if (r.success) setItems(r.data);
      if (e.success) setEmployees(e.data);
    });
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async () => {
    setLoading(true);
    const res = await fetch("/api/hr/performance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        overallRating: form.overallRating ? Number(form.overallRating) : undefined,
      }),
    }).then((r) => r.json());
    setLoading(false);
    if (res.success) {
      setShow(false);
      setNotice("Review created");
      load();
    } else setNotice(res.message || "Failed");
  };

  const setStatus = async (id: string, status: string) => {
    const res = await fetch("/api/hr/performance", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    }).then((r) => r.json());
    if (res.success) {
      setNotice(`Marked ${status}`);
      load();
    }
  };

  return (
    <div className="dash-page space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-[#5A6B5E]">Talent</p>
          <h1 className="dash-title mt-1 text-3xl font-semibold text-[#0F1F12]">
            Performance reviews
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Periodic appraisals, ratings, strengths, and development goals.
          </p>
        </div>
        <button type="button" className="dash-btn-primary" onClick={() => setShow(true)}>
          New review
        </button>
      </header>

      {notice && (
        <p className="rounded-lg bg-[#F3F8F0] px-4 py-2 text-sm text-[#105820]">{notice}</p>
      )}

      <div className="grid gap-4">
        {items.map((r) => (
          <div key={r.id} className="dash-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs text-slate-500">{r.reviewNumber}</p>
                <h3 className="mt-1 text-lg font-semibold">{r.employee.fullName}</h3>
                <p className="text-sm text-slate-500">
                  {formatDate(r.periodStart)} – {formatDate(r.periodEnd)} · Reviewer{" "}
                  {r.reviewer.fullName}
                </p>
              </div>
              <div className="text-right">
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium">
                  {r.status}
                </span>
                {r.overallRating != null && (
                  <p className="mt-2 text-2xl font-semibold text-[#105820]">
                    {Number(r.overallRating).toFixed(1)}
                    <span className="text-sm font-normal text-slate-400"> / 5</span>
                  </p>
                )}
              </div>
            </div>
            {(r.strengths || r.improvements || r.goals) && (
              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                {r.strengths && (
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-400">Strengths</p>
                    <p className="mt-1 text-slate-700">{r.strengths}</p>
                  </div>
                )}
                {r.improvements && (
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-400">Improve</p>
                    <p className="mt-1 text-slate-700">{r.improvements}</p>
                  </div>
                )}
                {r.goals && (
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-400">Goals</p>
                    <p className="mt-1 text-slate-700">{r.goals}</p>
                  </div>
                )}
              </div>
            )}
            {r.status === "DRAFT" && (
              <button
                type="button"
                className="mt-4 text-sm font-medium text-[#105820] hover:underline"
                onClick={() => setStatus(r.id, "SUBMITTED")}
              >
                Submit review
              </button>
            )}
            {r.status === "SUBMITTED" && (
              <button
                type="button"
                className="mt-4 text-sm font-medium text-[#105820] hover:underline"
                onClick={() => setStatus(r.id, "ACKNOWLEDGED")}
              >
                Acknowledge
              </button>
            )}
          </div>
        ))}
        {items.length === 0 && (
          <p className="py-10 text-center text-slate-500">No performance reviews yet.</p>
        )}
      </div>

      <FormModal open={show} onOpenChange={setShow} title="New performance review">
        <FormField label="Employee">
          <Select
            value={form.employeeId}
            onChange={(e) => setForm((prev) => ({ ...prev, employeeId: e.target.value }))}
          >
            <option value="">Select…</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.fullName}
              </option>
            ))}
          </Select>
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Period start">
            <Input
              type="date"
              value={form.periodStart}
              onChange={(e) => setForm((prev) => ({ ...prev, periodStart: e.target.value }))}
            />
          </FormField>
          <FormField label="Period end">
            <Input
              type="date"
              value={form.periodEnd}
              onChange={(e) => setForm((prev) => ({ ...prev, periodEnd: e.target.value }))}
            />
          </FormField>
        </div>
        <FormField label="Overall rating (1–5)">
          <Input
            type="number"
            min={1}
            max={5}
            step={0.1}
            value={form.overallRating}
            onChange={(e) => setForm((prev) => ({ ...prev, overallRating: e.target.value }))}
          />
        </FormField>
        <FormField label="Strengths">
          <Input value={form.strengths} onChange={(e) => setForm((prev) => ({ ...prev, strengths: e.target.value }))} />
        </FormField>
        <FormField label="Improvements">
          <Input
            value={form.improvements}
            onChange={(e) => setForm((prev) => ({ ...prev, improvements: e.target.value }))}
          />
        </FormField>
        <FormField label="Goals">
          <Input value={form.goals} onChange={(e) => setForm((prev) => ({ ...prev, goals: e.target.value }))} />
        </FormField>
        <FormActions onCancel={() => setShow(false)} onSubmit={submit} loading={loading} submitLabel="Create" />
      </FormModal>
    </div>
  );
}
