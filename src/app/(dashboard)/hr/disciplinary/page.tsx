"use client";

import { useEffect, useState } from "react";
import { FormModal, FormField, FormActions } from "@/components/ui/form-modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatDate } from "@/lib/utils";

type Record_ = {
  id: string;
  actionNumber: string;
  actionType: string;
  title: string;
  description?: string | null;
  actionDate: string;
  employee: { fullName: string; employeeNumber: string };
  createdBy: { fullName: string };
};

type Emp = { id: string; fullName: string };

const TYPES = [
  "VERBAL_WARNING",
  "WRITTEN_WARNING",
  "FINAL_WARNING",
  "SUSPENSION",
  "TERMINATION",
  "OTHER",
];

export default function DisciplinaryPage() {
  const [items, setItems] = useState<Record_[]>([]);
  const [employees, setEmployees] = useState<Emp[]>([]);
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({
    employeeId: "",
    actionType: "VERBAL_WARNING",
    title: "",
    description: "",
    actionDate: "",
  });

  const load = () => {
    Promise.all([
      fetch("/api/hr/disciplinary").then((r) => r.json()),
      fetch("/api/employees?status=ACTIVE").then((r) => r.json()),
    ]).then(([d, e]) => {
      if (d.success) setItems(d.data);
      if (e.success) setEmployees(e.data);
    });
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async () => {
    setLoading(true);
    const res = await fetch("/api/hr/disciplinary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        actionDate: form.actionDate || undefined,
      }),
    }).then((r) => r.json());
    setLoading(false);
    if (res.success) {
      setShow(false);
      setForm({
        employeeId: "",
        actionType: "VERBAL_WARNING",
        title: "",
        description: "",
        actionDate: "",
      });
      setNotice("Disciplinary action recorded");
      load();
    } else setNotice(res.message || "Failed");
  };

  return (
    <div className="dash-page space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-[#5A6B5E]">Compliance</p>
          <h1 className="dash-title mt-1 text-3xl font-semibold text-[#0F1F12]">
            Disciplinary records
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Warnings, suspensions, and other corrective actions.
          </p>
        </div>
        <button type="button" className="dash-btn-primary" onClick={() => setShow(true)}>
          Record action
        </button>
      </header>

      {notice && (
        <p className="rounded-lg bg-[#F3F8F0] px-4 py-2 text-sm text-[#105820]">{notice}</p>
      )}

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="dash-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs text-slate-500">{item.actionNumber}</p>
                <h3 className="mt-1 text-lg font-semibold">{item.title}</h3>
                <p className="text-sm text-slate-500">
                  {item.employee.fullName} · {formatDate(item.actionDate)}
                </p>
              </div>
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
                {item.actionType.replace(/_/g, " ")}
              </span>
            </div>
            {item.description && (
              <p className="mt-3 text-sm text-slate-600">{item.description}</p>
            )}
            <p className="mt-2 text-xs text-slate-400">Recorded by {item.createdBy.fullName}</p>
          </div>
        ))}
        {items.length === 0 && (
          <p className="py-10 text-center text-slate-500">No disciplinary records.</p>
        )}
      </div>

      <FormModal open={show} onOpenChange={setShow} title="Record disciplinary action">
        <FormField label="Employee">
          <Select value={form.employeeId} onChange={(e) => setForm((prev) => ({ ...prev, employeeId: e.target.value }))}>
            <option value="">Select…</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{e.fullName}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="Type">
          <Select value={form.actionType} onChange={(e) => setForm((prev) => ({ ...prev, actionType: e.target.value }))}>
            {TYPES.map((t) => (
              <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="Title">
          <Input value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} />
        </FormField>
        <FormField label="Description">
          <Input value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} />
        </FormField>
        <FormField label="Date">
          <Input type="date" value={form.actionDate} onChange={(e) => setForm((prev) => ({ ...prev, actionDate: e.target.value }))} />
        </FormField>
        <FormActions onCancel={() => setShow(false)} onSubmit={submit} loading={loading} submitLabel="Save" />
      </FormModal>
    </div>
  );
}
