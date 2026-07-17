"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FormModal, FormField, FormActions } from "@/components/ui/form-modal";
import { Select } from "@/components/ui/select";

type Emp = {
  id: string;
  fullName: string;
  jobTitle?: string | null;
  employeeNumber: string;
  status: string;
  departmentId?: string | null;
  reportsToId?: string | null;
  department?: { id: string; name: string } | null;
};

type Dept = {
  id: string;
  name: string;
  code: string;
  manager?: { id: string; fullName: string; jobTitle?: string | null } | null;
  _count: { employees: number };
};

export default function OrgChartPage() {
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [employees, setEmployees] = useState<Emp[]>([]);
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({ employeeId: "", reportsToId: "" });

  const load = () => {
    fetch("/api/hr/org")
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setDepartments(res.data.departments);
          setEmployees(res.data.employees);
        }
      });
  };

  useEffect(() => {
    load();
  }, []);

  const roots = useMemo(
    () => employees.filter((e) => !e.reportsToId),
    [employees]
  );

  const childrenOf = (id: string) => employees.filter((e) => e.reportsToId === id);

  const saveManager = async () => {
    setLoading(true);
    const res = await fetch("/api/hr/org", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employeeId: form.employeeId,
        reportsToId: form.reportsToId || null,
      }),
    }).then((r) => r.json());
    setLoading(false);
    if (res.success) {
      setShow(false);
      setNotice("Reporting line updated");
      load();
    } else setNotice(res.message || "Failed");
  };

  function TreeNode({ emp, depth = 0 }: { emp: Emp; depth?: number }) {
    const kids = childrenOf(emp.id);
    return (
      <div className={depth ? "ml-6 border-l border-[#105820]/20 pl-4" : ""}>
        <Link
          href={`/employees/${emp.id}`}
          className="mb-2 block rounded-xl border border-[#105820]/10 bg-white px-4 py-3 transition hover:border-[#78B028]/50"
        >
          <p className="font-semibold text-[#0F1F12]">{emp.fullName}</p>
          <p className="text-sm text-slate-500">
            {emp.jobTitle || "Staff"} · {emp.department?.name || "Unassigned"}
          </p>
        </Link>
        {kids.map((k) => (
          <TreeNode key={k.id} emp={k} depth={depth + 1} />
        ))}
      </div>
    );
  }

  return (
    <div className="dash-page space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-[#5A6B5E]">People</p>
          <h1 className="dash-title mt-1 text-3xl font-semibold text-[#0F1F12]">
            Organization chart
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Departments and reporting lines across the company.
          </p>
        </div>
        <button type="button" className="dash-btn-primary" onClick={() => setShow(true)}>
          Set manager
        </button>
      </header>

      {notice && (
        <p className="rounded-lg bg-[#F3F8F0] px-4 py-2 text-sm text-[#105820]">{notice}</p>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {departments.map((d) => (
          <div key={d.id} className="dash-card p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{d.code}</p>
            <h3 className="mt-1 text-lg font-semibold">{d.name}</h3>
            <p className="mt-2 text-sm text-slate-500">
              Manager: {d.manager?.fullName || "Unassigned"}
            </p>
            <p className="mt-1 text-sm font-medium text-[#105820]">
              {d._count.employees} people
            </p>
          </div>
        ))}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Reporting tree</h2>
        <div className="space-y-4">
          {roots.map((e) => (
            <TreeNode key={e.id} emp={e} />
          ))}
          {roots.length === 0 && (
            <p className="py-8 text-center text-slate-500">No active employees.</p>
          )}
        </div>
      </section>

      <FormModal open={show} onOpenChange={setShow} title="Set reporting manager">
        <FormField label="Employee">
          <Select value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}>
            <option value="">Select…</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{e.fullName}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="Reports to">
          <Select value={form.reportsToId} onChange={(e) => setForm({ ...form, reportsToId: e.target.value })}>
            <option value="">None (top level)</option>
            {employees
              .filter((e) => e.id !== form.employeeId)
              .map((e) => (
                <option key={e.id} value={e.id}>{e.fullName}</option>
              ))}
          </Select>
        </FormField>
        <FormActions onCancel={() => setShow(false)} onSubmit={saveManager} loading={loading} submitLabel="Save" />
      </FormModal>
    </div>
  );
}
