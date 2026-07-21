"use client";

import { useEffect, useState } from "react";
import { FormModal, FormField, FormActions } from "@/components/ui/form-modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatDate } from "@/lib/utils";

type Program = {
  id: string;
  code: string;
  title: string;
  provider?: string | null;
  durationHours?: number | string | null;
  _count?: { enrollments: number };
};

type Enrollment = {
  id: string;
  status: string;
  startDate?: string | null;
  endDate?: string | null;
  score?: number | string | null;
  employee: { fullName: string };
  program: { title: string; code: string };
};

type Emp = { id: string; fullName: string };

export default function TrainingPage() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [employees, setEmployees] = useState<Emp[]>([]);
  const [showProgram, setShowProgram] = useState(false);
  const [showEnroll, setShowEnroll] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [pForm, setPForm] = useState({ title: "", provider: "", durationHours: "" });
  const [eForm, setEForm] = useState({ employeeId: "", programId: "", startDate: "" });

  const load = () => {
    Promise.all([
      fetch("/api/hr/training").then((r) => r.json()),
      fetch("/api/hr/enrollments").then((r) => r.json()),
      fetch("/api/employees?status=ACTIVE").then((r) => r.json()),
    ]).then(([p, e, emp]) => {
      if (p.success) setPrograms(p.data);
      if (e.success) setEnrollments(e.data);
      if (emp.success) setEmployees(emp.data);
    });
  };

  useEffect(() => {
    load();
  }, []);

  const createProgram = async () => {
    setLoading(true);
    const res = await fetch("/api/hr/training", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...pForm,
        durationHours: pForm.durationHours ? Number(pForm.durationHours) : undefined,
      }),
    }).then((r) => r.json());
    setLoading(false);
    if (res.success) {
      setShowProgram(false);
      setPForm({ title: "", provider: "", durationHours: "" });
      setNotice("Program created");
      load();
    } else setNotice(res.message || "Failed");
  };

  const enroll = async () => {
    setLoading(true);
    const res = await fetch("/api/hr/enrollments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(eForm),
    }).then((r) => r.json());
    setLoading(false);
    if (res.success) {
      setShowEnroll(false);
      setEForm({ employeeId: "", programId: "", startDate: "" });
      setNotice("Employee enrolled");
      load();
    } else setNotice(res.message || "Failed");
  };

  const markComplete = async (id: string) => {
    const res = await fetch("/api/hr/enrollments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "COMPLETED", endDate: new Date().toISOString().slice(0, 10) }),
    }).then((r) => r.json());
    if (res.success) {
      setNotice("Marked completed");
      load();
    }
  };

  return (
    <div className="dash-page space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-[#5A6B5E]">Talent</p>
          <h1 className="dash-title mt-1 text-3xl font-semibold text-[#0F1F12]">
            Training & development
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Programs, enrollments, and completion tracking.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="dash-btn-secondary" onClick={() => setShowEnroll(true)}>
            Enroll staff
          </button>
          <button type="button" className="dash-btn-primary" onClick={() => setShowProgram(true)}>
            New program
          </button>
        </div>
      </header>

      {notice && (
        <p className="rounded-lg bg-[#F3F8F0] px-4 py-2 text-sm text-[#105820]">{notice}</p>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {programs.map((p) => (
          <div key={p.id} className="dash-card p-5">
            <p className="text-xs text-slate-500">{p.code}</p>
            <h3 className="mt-1 font-semibold text-[#0F1F12]">{p.title}</h3>
            <p className="mt-1 text-sm text-slate-500">{p.provider || "Internal"}</p>
            <p className="mt-3 text-sm">
              {p._count?.enrollments ?? 0} enrolled
              {p.durationHours != null ? ` · ${p.durationHours}h` : ""}
            </p>
          </div>
        ))}
        {programs.length === 0 && (
          <p className="col-span-full py-8 text-center text-slate-500">No training programs yet.</p>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-[#0F1F12]">Enrollments</h2>
        <div className="dash-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Program</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Dates</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {enrollments.map((e) => (
                <tr key={e.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">{e.employee.fullName}</td>
                  <td className="px-4 py-3">{e.program.title}</td>
                  <td className="px-4 py-3">{e.status.replace(/_/g, " ")}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {e.startDate ? formatDate(e.startDate) : "—"}
                    {e.endDate ? ` → ${formatDate(e.endDate)}` : ""}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {e.status !== "COMPLETED" && (
                      <button
                        type="button"
                        className="text-sm text-[#105820] hover:underline"
                        onClick={() => markComplete(e.id)}
                      >
                        Complete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {enrollments.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    No enrollments yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <FormModal open={showProgram} onOpenChange={setShowProgram} title="New training program">
        <FormField label="Title">
          <Input value={pForm.title} onChange={(e) => setPForm((prev) => ({ ...prev, title: e.target.value }))} />
        </FormField>
        <FormField label="Provider">
          <Input value={pForm.provider} onChange={(e) => setPForm((prev) => ({ ...prev, provider: e.target.value }))} />
        </FormField>
        <FormField label="Duration (hours)">
          <Input
            type="number"
            value={pForm.durationHours}
            onChange={(e) => setPForm((prev) => ({ ...prev, durationHours: e.target.value }))}
          />
        </FormField>
        <FormActions onCancel={() => setShowProgram(false)} onSubmit={createProgram} loading={loading} submitLabel="Create" />
      </FormModal>

      <FormModal open={showEnroll} onOpenChange={setShowEnroll} title="Enroll employee">
        <FormField label="Employee">
          <Select value={eForm.employeeId} onChange={(e) => setEForm((prev) => ({ ...prev, employeeId: e.target.value }))}>
            <option value="">Select…</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{e.fullName}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="Program">
          <Select value={eForm.programId} onChange={(e) => setEForm((prev) => ({ ...prev, programId: e.target.value }))}>
            <option value="">Select…</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="Start date">
          <Input type="date" value={eForm.startDate} onChange={(e) => setEForm((prev) => ({ ...prev, startDate: e.target.value }))} />
        </FormField>
        <FormActions onCancel={() => setShowEnroll(false)} onSubmit={enroll} loading={loading} submitLabel="Enroll" />
      </FormModal>
    </div>
  );
}
