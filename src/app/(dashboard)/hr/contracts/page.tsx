"use client";

import { useEffect, useState } from "react";
import { FormModal, FormField, FormActions } from "@/components/ui/form-modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/lib/utils";

type Contract = {
  id: string;
  contractNumber: string;
  contractType: string;
  status: string;
  title?: string | null;
  startDate: string;
  endDate?: string | null;
  salary?: number | string | null;
  employee: { fullName: string; employeeNumber: string };
};

type Emp = { id: string; fullName: string };

export default function ContractsPage() {
  const [items, setItems] = useState<Contract[]>([]);
  const [employees, setEmployees] = useState<Emp[]>([]);
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({
    employeeId: "",
    contractType: "PERMANENT",
    title: "",
    startDate: "",
    endDate: "",
    salary: "",
    notes: "",
  });

  const load = () => {
    Promise.all([
      fetch("/api/hr/contracts").then((r) => r.json()),
      fetch("/api/employees?status=ACTIVE").then((r) => r.json()),
    ]).then(([c, e]) => {
      if (c.success) setItems(c.data);
      if (e.success) setEmployees(e.data);
    });
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async () => {
    setLoading(true);
    const res = await fetch("/api/hr/contracts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        salary: form.salary ? Number(form.salary) : undefined,
        endDate: form.endDate || undefined,
      }),
    }).then((r) => r.json());
    setLoading(false);
    if (res.success) {
      setShow(false);
      setNotice("Contract created");
      load();
    } else setNotice(res.message || "Failed");
  };

  const setStatus = async (id: string, status: string) => {
    const res = await fetch("/api/hr/contracts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    }).then((r) => r.json());
    if (res.success) {
      setNotice(`Status → ${status}`);
      load();
    }
  };

  return (
    <div className="dash-page space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-[#5A6B5E]">Compliance</p>
          <h1 className="dash-title mt-1 text-3xl font-semibold text-[#0F1F12]">
            Employment contracts
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Track contract types, terms, and upcoming expiries.
          </p>
        </div>
        <button type="button" className="dash-btn-primary" onClick={() => setShow(true)}>
          New contract
        </button>
      </header>

      {notice && (
        <p className="rounded-lg bg-[#F3F8F0] px-4 py-2 text-sm text-[#105820]">{notice}</p>
      )}

      <div className="dash-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Contract</th>
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Term</th>
              <th className="px-4 py-3">Salary</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} className="border-b last:border-0">
                <td className="px-4 py-3">
                  <p className="font-medium">{c.contractNumber}</p>
                  <p className="text-xs text-slate-500">{c.title || "—"}</p>
                </td>
                <td className="px-4 py-3">{c.employee.fullName}</td>
                <td className="px-4 py-3">{c.contractType.replace(/_/g, " ")}</td>
                <td className="px-4 py-3">
                  {formatDate(c.startDate)}
                  {c.endDate ? ` → ${formatDate(c.endDate)}` : " → open"}
                </td>
                <td className="px-4 py-3">
                  {c.salary != null ? formatCurrency(Number(c.salary)) : "—"}
                </td>
                <td className="px-4 py-3">{c.status}</td>
                <td className="px-4 py-3 text-right">
                  {c.status === "ACTIVE" && c.endDate && (
                    <button
                      type="button"
                      className="text-sm text-[#105820] hover:underline"
                      onClick={() => setStatus(c.id, "EXPIRED")}
                    >
                      Mark expired
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                  No contracts recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <FormModal open={show} onOpenChange={setShow} title="New employment contract">
        <FormField label="Employee">
          <Select value={form.employeeId} onChange={(e) => setForm((prev) => ({ ...prev, employeeId: e.target.value }))}>
            <option value="">Select…</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{e.fullName}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="Type">
          <Select value={form.contractType} onChange={(e) => setForm((prev) => ({ ...prev, contractType: e.target.value }))}>
            {["PERMANENT", "FIXED_TERM", "PROBATION", "CONSULTANT", "INTERN"].map((t) => (
              <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="Title">
          <Input value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Start">
            <Input type="date" value={form.startDate} onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))} />
          </FormField>
          <FormField label="End (optional)">
            <Input type="date" value={form.endDate} onChange={(e) => setForm((prev) => ({ ...prev, endDate: e.target.value }))} />
          </FormField>
        </div>
        <FormField label="Salary">
          <Input type="number" value={form.salary} onChange={(e) => setForm((prev) => ({ ...prev, salary: e.target.value }))} />
        </FormField>
        <FormActions onCancel={() => setShow(false)} onSubmit={submit} loading={loading} submitLabel="Create" />
      </FormModal>
    </div>
  );
}
