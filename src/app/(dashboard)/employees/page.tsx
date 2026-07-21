"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { FormModal, FormField, FormActions } from "@/components/ui/form-modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";
import { PageLoader } from "@/components/ui/page-loader";

type Dept = { id: string; name: string; code: string; _count?: { employees: number } };
type Emp = {
  id: string;
  employeeNumber: string;
  fullName: string;
  email?: string;
  jobTitle?: string;
  status: string;
  baseSalary: number | string;
  department?: { name: string } | null;
};

const emptyForm = {
  fullName: "",
  email: "",
  phone: "",
  jobTitle: "",
  departmentId: "",
  hireDate: "",
  baseSalary: 0,
  allowances: 0,
  nationalId: "",
  nssfNumber: "",
  bankName: "",
  bankAccount: "",
};

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Emp[]>([]);
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showDept, setShowDept] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [deptForm, setDeptForm] = useState({ code: "", name: "", description: "" });
  const [notice, setNotice] = useState("");

  const load = useCallback(() => {
    const qs = new URLSearchParams();
    if (search) qs.set("search", search);
    if (status) qs.set("status", status);
    setFetching(true);
    Promise.all([
      fetch(`/api/employees?${qs}`).then((r) => r.json()),
      fetch("/api/departments").then((r) => r.json()),
    ])
      .then(([e, d]) => {
        if (e.success) setEmployees(e.data);
        if (d.success) setDepartments(d.data);
      })
      .finally(() => setFetching(false));
  }, [search, status]);

  useEffect(() => {
    load();
  }, [load]);

  const createEmployee = async (close: () => void) => {
    setLoading(true);
    const res = await fetch("/api/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        departmentId: form.departmentId || undefined,
        email: form.email || undefined,
      }),
    }).then((r) => r.json());
    setLoading(false);
    if (res.success) {
      setForm(emptyForm);
      setShowCreate(false);
      close();
      setNotice("Employee created with leave balances");
      load();
    } else setNotice(res.message || "Failed");
  };

  const createDept = async (close: () => void) => {
    setLoading(true);
    const res = await fetch("/api/departments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(deptForm),
    }).then((r) => r.json());
    setLoading(false);
    if (res.success) {
      setDeptForm({ code: "", name: "", description: "" });
      setShowDept(false);
      close();
      load();
    } else setNotice(res.message || "Failed");
  };

  return (
    <div className="dash-page space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium tracking-wide text-[#5A6B5E]">Human resources</p>
          <h1 className="dash-title mt-1 text-3xl font-semibold tracking-tight text-[#0F1F12]">
            Employees
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Directory, departments, and employment records.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="dash-btn-secondary" onClick={() => setShowDept(true)}>
            Add department
          </button>
          <button
            type="button"
            className="dash-btn-primary inline-flex items-center gap-2"
            onClick={() => setShowCreate(true)}
          >
            <Plus className="h-4 w-4" />
            Add employee
          </button>
        </div>
      </header>

      {notice && (
        <div className="rounded-xl border border-[#d5e8c8] bg-[#E8F2E0] px-4 py-3 text-sm text-[#105820]">
          {notice}
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-3">
        {departments.map((d) => (
          <div key={d.id} className="dash-card px-4 py-3">
            <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">{d.code}</p>
            <p className="mt-1 font-semibold text-[#0F1F12]">{d.name}</p>
            <p className="text-xs text-slate-500">{d._count?.employees ?? 0} people</p>
          </div>
        ))}
      </section>

      <section className="dash-card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-[#e8f2e0] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="dash-title text-lg font-semibold text-[#0F1F12]">Team directory</h2>
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                className="rounded-xl border border-[#d5e8c8] bg-[#F3F8F0] py-2 pr-3 pl-9 text-sm outline-none focus:border-[#78B028] focus:bg-white"
              />
            </div>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded-xl border border-[#d5e8c8] bg-[#F3F8F0] px-3 py-2 text-sm outline-none"
            >
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="PROBATION">Probation</option>
              <option value="ON_LEAVE">On leave</option>
              <option value="TERMINATED">Terminated</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead>
              <tr className="border-b border-[#e8f2e0] text-left text-[11px] font-semibold tracking-[0.12em] text-slate-400 uppercase">
                <th className="px-5 py-3">Employee</th>
                <th className="px-5 py-3">Department</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Salary</th>
                <th className="px-5 py-3 text-right">Open</th>
              </tr>
            </thead>
            <tbody>
              {fetching ? (
                <tr>
                  <td colSpan={5} className="px-5 py-6">
                    <PageLoader compact label="Loading employees…" />
                  </td>
                </tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-slate-400">
                    No employees found
                  </td>
                </tr>
              ) : (
                employees.map((emp) => (
                  <tr key={emp.id} className="border-b border-[#f0f6eb] hover:bg-[#F3F8F0]/60">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-[#0F1F12]">{emp.fullName}</p>
                      <p className="text-xs text-slate-400">
                        {emp.employeeNumber}
                        {emp.jobTitle ? ` · ${emp.jobTitle}` : ""}
                      </p>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">
                      {emp.department?.name || "—"}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="rounded-full bg-[#E8F2E0] px-2.5 py-0.5 text-xs font-semibold text-[#105820]">
                        {emp.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 tabular-nums text-[#0F1F12]">
                      {formatCurrency(Number(emp.baseSalary))}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link
                        href={`/employees/${emp.id}`}
                        className="text-sm font-semibold text-[#105820] hover:text-[#78B028]"
                      >
                        Profile →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <FormModal title="Add employee" open={showCreate} onOpenChange={setShowCreate}>
          {({ close }) => (
            <form
              className="max-h-[70vh] space-y-3 overflow-y-auto pr-1"
              onSubmit={(e) => {
                e.preventDefault();
                createEmployee(close);
              }}
            >
              <FormField label="Full name">
                <Input
                  required
                  value={form.fullName}
                  onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
                />
              </FormField>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Email">
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                  />
                </FormField>
                <FormField label="Phone">
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                  />
                </FormField>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Job title">
                  <Input
                    value={form.jobTitle}
                    onChange={(e) => setForm((prev) => ({ ...prev, jobTitle: e.target.value }))}
                  />
                </FormField>
                <FormField label="Department">
                  <Select
                    value={form.departmentId}
                    onChange={(e) => setForm((prev) => ({ ...prev, departmentId: e.target.value }))}
                  >
                    <option value="">Unassigned</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </Select>
                </FormField>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Hire date">
                  <Input
                    type="date"
                    value={form.hireDate}
                    onChange={(e) => setForm((prev) => ({ ...prev, hireDate: e.target.value }))}
                  />
                </FormField>
                <FormField label="Base salary (UGX)">
                  <Input
                    type="number"
                    min={0}
                    value={form.baseSalary}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        baseSalary: e.target.value === "" ? 0 : Number(e.target.value),
                      }))
                    }
                  />
                </FormField>
              </div>
              <FormField label="Allowances (UGX)">
                <Input
                  type="number"
                  min={0}
                  value={form.allowances}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      allowances: e.target.value === "" ? 0 : Number(e.target.value),
                    }))
                  }
                />
              </FormField>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="National ID">
                  <Input
                    value={form.nationalId}
                    onChange={(e) => setForm((prev) => ({ ...prev, nationalId: e.target.value }))}
                  />
                </FormField>
                <FormField label="NSSF number">
                  <Input
                    value={form.nssfNumber}
                    onChange={(e) => setForm((prev) => ({ ...prev, nssfNumber: e.target.value }))}
                  />
                </FormField>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Bank name">
                  <Input
                    value={form.bankName}
                    onChange={(e) => setForm((prev) => ({ ...prev, bankName: e.target.value }))}
                  />
                </FormField>
                <FormField label="Bank account">
                  <Input
                    value={form.bankAccount}
                    onChange={(e) => setForm((prev) => ({ ...prev, bankAccount: e.target.value }))}
                  />
                </FormField>
              </div>
              <FormActions onCancel={close} loading={loading} submitLabel="Create employee" />
            </form>
          )}
        </FormModal>

      <FormModal title="Add department" open={showDept} onOpenChange={setShowDept}>
          {({ close }) => (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                createDept(close);
              }}
            >
              <FormField label="Code">
                <Input
                  required
                  value={deptForm.code}
                  onChange={(e) => setDeptForm((prev) => ({ ...prev, code: e.target.value }))}
                />
              </FormField>
              <FormField label="Name">
                <Input
                  required
                  value={deptForm.name}
                  onChange={(e) => setDeptForm((prev) => ({ ...prev, name: e.target.value }))}
                />
              </FormField>
              <FormField label="Description">
                <Input
                  value={deptForm.description}
                  onChange={(e) => setDeptForm((prev) => ({ ...prev, description: e.target.value }))}
                />
              </FormField>
              <FormActions onCancel={close} loading={loading} />
            </form>
          )}
        </FormModal>
    </div>
  );
}
