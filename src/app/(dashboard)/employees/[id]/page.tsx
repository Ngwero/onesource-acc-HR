"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { FormModal, FormField, FormActions } from "@/components/ui/form-modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PageLoader } from "@/components/ui/page-loader";

type Employee = Record<string, unknown> & {
  id: string;
  fullName: string;
  employeeNumber: string;
  status: string;
  baseSalary: number | string;
  allowances?: number | string;
  department?: { name: string } | null;
  leaveBalances?: Array<{
    leaveType: string;
    entitled: number | string;
    used: number | string;
    pending: number | string;
  }>;
  leaveRequests?: Array<Record<string, unknown>>;
  attendanceRecords?: Array<Record<string, unknown>>;
  documents?: Array<Record<string, unknown>>;
  payRunItems?: Array<Record<string, unknown>>;
  contracts?: Array<Record<string, unknown>>;
  reviewsReceived?: Array<Record<string, unknown>>;
  trainings?: Array<Record<string, unknown>>;
  disciplinaryActions?: Array<Record<string, unknown>>;
  checklistItems?: Array<Record<string, unknown>>;
};

export default function EmployeeDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const [emp, setEmp] = useState<Employee | null>(null);
  const [loadError, setLoadError] = useState("");
  const [showEdit, setShowEdit] = useState(false);
  const [showDoc, setShowDoc] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [form, setForm] = useState<Record<string, string | number>>({});
  const [docForm, setDocForm] = useState({ title: "", category: "CONTRACT", notes: "" });
  const [notice, setNotice] = useState("");

  const load = useCallback(() => {
    if (!id || id === "undefined") {
      setLoadError("Invalid employee");
      setFetching(false);
      return;
    }
    setFetching(true);
    setLoadError("");
    fetch(`/api/employees/${id}`)
      .then(async (r) => {
        const text = await r.text();
        if (!text) throw new Error(r.ok ? "Empty response" : `HTTP ${r.status}`);
        return JSON.parse(text) as { success?: boolean; message?: string; data?: Employee };
      })
      .then((res) => {
        if (res.success && res.data) {
          setEmp(res.data);
          setForm({
            fullName: res.data.fullName || "",
            email: String(res.data.email || ""),
            phone: String(res.data.phone || ""),
            jobTitle: String(res.data.jobTitle || ""),
            baseSalary: Number(res.data.baseSalary || 0),
            allowances: Number(res.data.allowances || 0),
            nationalId: String(res.data.nationalId || ""),
            tin: String(res.data.tin || ""),
            nssfNumber: String(res.data.nssfNumber || ""),
            bankName: String(res.data.bankName || ""),
            bankAccount: String(res.data.bankAccount || ""),
            address: String(res.data.address || ""),
            emergencyContact: String(res.data.emergencyContact || ""),
            emergencyPhone: String(res.data.emergencyPhone || ""),
            status: res.data.status || "ACTIVE",
          });
        } else {
          setEmp(null);
          setLoadError(res.message || "Employee not found");
        }
      })
      .catch((err) => {
        console.error(err);
        setEmp(null);
        setLoadError(err instanceof Error ? err.message : "Failed to load employee");
      })
      .finally(() => setFetching(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const updateField = (key: string, value: string | number) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const save = async (close: () => void) => {
    setLoading(true);
    const res = await fetch(`/api/employees/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    }).then((r) => r.json());
    setLoading(false);
    if (res.success) {
      close();
      setShowEdit(false);
      setNotice("Profile updated");
      load();
    } else setNotice(res.message || "Update failed");
  };

  const terminate = async () => {
    if (!confirm(`Terminate ${emp?.fullName}?`)) return;
    const res = await fetch(`/api/employees/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "terminate", reason: "Employment ended" }),
    }).then((r) => r.json());
    if (res.success) {
      setNotice("Employee terminated");
      load();
    } else setNotice(res.message || "Failed");
  };

  const addDoc = async (close: () => void) => {
    setLoading(true);
    const res = await fetch(`/api/employees/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add-document", ...docForm }),
    }).then((r) => r.json());
    setLoading(false);
    if (res.success) {
      close();
      setShowDoc(false);
      setDocForm({ title: "", category: "CONTRACT", notes: "" });
      load();
    } else setNotice(res.message || "Failed");
  };

  if (fetching && !emp) {
    return <PageLoader label="Loading employee…" />;
  }

  if (!emp) {
    return (
      <div className="dash-page space-y-4">
        <Link href="/employees" className="text-sm font-medium text-[#105820] hover:underline">
          ← Employees
        </Link>
        <p className="text-sm text-red-600">{loadError || "Employee not found"}</p>
        <button type="button" className="dash-btn-secondary" onClick={load}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="dash-page space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href="/employees" className="text-sm font-medium text-[#105820] hover:underline">
            ← Employees
          </Link>
          <h1 className="dash-title mt-2 text-3xl font-semibold tracking-tight text-[#0F1F12]">
            {emp.fullName}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {emp.employeeNumber}
            {emp.jobTitle ? ` · ${String(emp.jobTitle)}` : ""}
            {emp.department ? ` · ${emp.department.name}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="dash-btn-secondary" onClick={() => setShowEdit(true)}>
            Edit profile
          </button>
          <button type="button" className="dash-btn-secondary" onClick={() => setShowDoc(true)}>
            Add document
          </button>
          {emp.status !== "TERMINATED" && (
            <button
              type="button"
              className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
              onClick={terminate}
            >
              Terminate
            </button>
          )}
        </div>
      </header>

      {notice && (
        <div className="rounded-xl border border-[#d5e8c8] bg-[#E8F2E0] px-4 py-3 text-sm text-[#105820]">
          {notice}
        </div>
      )}

      <section className="grid gap-4 lg:grid-cols-3">
        <article className="dash-card space-y-3 p-5 lg:col-span-2">
          <h2 className="dash-title text-lg font-semibold text-[#0F1F12]">Profile</h2>
          <div className="grid gap-3 sm:grid-cols-2 text-sm">
            {[
              ["Status", String(emp.status).replace(/_/g, " ")],
              ["Email", String(emp.email || "—")],
              ["Phone", String(emp.phone || "—")],
              ["National ID", String(emp.nationalId || "—")],
              ["TIN", String(emp.tin || "—")],
              ["NSSF", String(emp.nssfNumber || "—")],
              ["Bank", `${emp.bankName || "—"} ${emp.bankAccount || ""}`.trim()],
              ["Hire date", emp.hireDate ? formatDate(String(emp.hireDate)) : "—"],
            ].map(([k, v]) => (
              <div key={k}>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{k}</p>
                <p className="mt-0.5 font-medium text-[#0F1F12]">{v}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="dash-card p-5">
          <h2 className="dash-title text-lg font-semibold text-[#0F1F12]">Compensation</h2>
          <p className="mt-3 text-xs text-slate-400 uppercase tracking-wide">Base salary</p>
          <p className="text-2xl font-semibold tabular-nums text-[#0F1F12]">
            {formatCurrency(Number(emp.baseSalary))}
          </p>
          <p className="mt-3 text-xs text-slate-400 uppercase tracking-wide">Allowances</p>
          <p className="text-lg font-semibold tabular-nums text-[#105820]">
            {formatCurrency(Number(emp.allowances || 0))}
          </p>
        </article>
      </section>

      <section className="dash-card p-5">
        <h2 className="dash-title text-lg font-semibold text-[#0F1F12]">Leave balances</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(emp.leaveBalances || []).map((b) => {
            const left = Number(b.entitled) - Number(b.used) - Number(b.pending);
            return (
              <div key={b.leaveType} className="rounded-xl bg-[#F3F8F0] px-4 py-3">
                <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
                  {b.leaveType}
                </p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-[#0F1F12]">{left}</p>
                <p className="text-xs text-slate-500">
                  {Number(b.used)} used · {Number(b.pending)} pending · {Number(b.entitled)} entitled
                </p>
              </div>
            );
          })}
          {(emp.leaveBalances || []).length === 0 && (
            <p className="text-sm text-slate-400">No balances yet</p>
          )}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="dash-card p-5">
          <h2 className="dash-title mb-3 text-lg font-semibold text-[#0F1F12]">Recent leave</h2>
          <ul className="space-y-2 text-sm">
            {(emp.leaveRequests || []).slice(0, 5).map((l) => (
              <li
                key={String(l.id)}
                className="flex items-center justify-between rounded-lg bg-[#F3F8F0] px-3 py-2"
              >
                <span>
                  {String(l.leaveType)} · {Number(l.days)}d
                </span>
                <span className="text-xs font-semibold text-[#105820]">{String(l.status)}</span>
              </li>
            ))}
            {(emp.leaveRequests || []).length === 0 && (
              <li className="text-slate-400">No leave requests</li>
            )}
          </ul>
        </article>

        <article className="dash-card p-5">
          <h2 className="dash-title mb-3 text-lg font-semibold text-[#0F1F12]">Documents</h2>
          <ul className="space-y-2 text-sm">
            {(emp.documents || []).map((d) => (
              <li key={String(d.id)} className="rounded-lg bg-[#F3F8F0] px-3 py-2">
                <p className="font-medium text-[#0F1F12]">{String(d.title)}</p>
                <p className="text-xs text-slate-500">{String(d.category)}</p>
              </li>
            ))}
            {(emp.documents || []).length === 0 && (
              <li className="text-slate-400">No documents</li>
            )}
          </ul>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="dash-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="dash-title text-lg font-semibold text-[#0F1F12]">Onboarding</h2>
            <button
              type="button"
              className="text-xs font-medium text-[#105820] hover:underline"
              onClick={async () => {
                await fetch("/api/hr/checklists", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ employeeId: id, kind: "ONBOARDING" }),
                });
                load();
              }}
            >
              Ensure checklist
            </button>
          </div>
          <ul className="space-y-2 text-sm">
            {(emp.checklistItems || [])
              .filter((c) => String(c.kind) === "ONBOARDING")
              .map((c) => (
                <li
                  key={String(c.id)}
                  className="flex items-center justify-between gap-2 rounded-lg bg-[#F3F8F0] px-3 py-2"
                >
                  <span className={String(c.status) === "DONE" ? "line-through text-slate-400" : ""}>
                    {String(c.title)}
                  </span>
                  <button
                    type="button"
                    className="shrink-0 text-xs font-semibold text-[#105820]"
                    onClick={async () => {
                      await fetch("/api/hr/checklists", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          id: c.id,
                          status: String(c.status) === "DONE" ? "PENDING" : "DONE",
                        }),
                      });
                      load();
                    }}
                  >
                    {String(c.status) === "DONE" ? "Undo" : "Done"}
                  </button>
                </li>
              ))}
            {(emp.checklistItems || []).filter((c) => String(c.kind) === "ONBOARDING").length ===
              0 && <li className="text-slate-400">No onboarding items</li>}
          </ul>
        </article>

        <article className="dash-card p-5">
          <h2 className="dash-title mb-3 text-lg font-semibold text-[#0F1F12]">Contracts</h2>
          <ul className="space-y-2 text-sm">
            {(emp.contracts || []).map((c) => (
              <li
                key={String(c.id)}
                className="flex justify-between rounded-lg bg-[#F3F8F0] px-3 py-2"
              >
                <span>
                  {String(c.contractNumber)} · {String(c.contractType).replace(/_/g, " ")}
                </span>
                <span className="text-xs font-semibold">{String(c.status)}</span>
              </li>
            ))}
            {(emp.contracts || []).length === 0 && (
              <li className="text-slate-400">No contracts on file</li>
            )}
          </ul>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="dash-card p-5">
          <h2 className="dash-title mb-3 text-lg font-semibold text-[#0F1F12]">Performance</h2>
          <ul className="space-y-2 text-sm">
            {(emp.reviewsReceived || []).map((r) => (
              <li
                key={String(r.id)}
                className="flex justify-between rounded-lg bg-[#F3F8F0] px-3 py-2"
              >
                <span>
                  {String(r.reviewNumber)}
                  {r.overallRating != null ? ` · ${Number(r.overallRating)}/5` : ""}
                </span>
                <span className="text-xs font-semibold">{String(r.status)}</span>
              </li>
            ))}
            {(emp.reviewsReceived || []).length === 0 && (
              <li className="text-slate-400">No reviews yet</li>
            )}
          </ul>
        </article>

        <article className="dash-card p-5">
          <h2 className="dash-title mb-3 text-lg font-semibold text-[#0F1F12]">Training</h2>
          <ul className="space-y-2 text-sm">
            {(emp.trainings || []).map((t) => (
              <li
                key={String(t.id)}
                className="flex justify-between rounded-lg bg-[#F3F8F0] px-3 py-2"
              >
                <span>
                  {t.program && typeof t.program === "object" && "title" in t.program
                    ? String((t.program as { title: string }).title)
                    : "Program"}
                </span>
                <span className="text-xs font-semibold">
                  {String(t.status).replace(/_/g, " ")}
                </span>
              </li>
            ))}
            {(emp.trainings || []).length === 0 && (
              <li className="text-slate-400">No training enrollments</li>
            )}
          </ul>
        </article>
      </section>

      {(emp.disciplinaryActions || []).length > 0 && (
        <section className="dash-card p-5">
          <h2 className="dash-title mb-3 text-lg font-semibold text-[#0F1F12]">
            Disciplinary history
          </h2>
          <ul className="space-y-2 text-sm">
            {(emp.disciplinaryActions || []).map((d) => (
              <li
                key={String(d.id)}
                className="flex justify-between rounded-lg bg-amber-50 px-3 py-2"
              >
                <span>
                  {String(d.title)} · {String(d.actionType).replace(/_/g, " ")}
                </span>
                <span className="text-xs text-slate-500">
                  {d.actionDate ? formatDate(String(d.actionDate)) : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <FormModal title="Edit employee" open={showEdit} onOpenChange={setShowEdit}>
          {({ close }) => (
            <form
              className="max-h-[70vh] space-y-3 overflow-y-auto"
              onSubmit={(e) => {
                e.preventDefault();
                save(close);
              }}
            >
              {(
                [
                  ["fullName", "Full name"],
                  ["email", "Email"],
                  ["phone", "Phone"],
                  ["jobTitle", "Job title"],
                  ["nationalId", "National ID"],
                  ["nssfNumber", "NSSF"],
                  ["tin", "TIN"],
                  ["bankName", "Bank name"],
                  ["bankAccount", "Bank account"],
                  ["address", "Address"],
                  ["emergencyContact", "Emergency contact"],
                  ["emergencyPhone", "Emergency phone"],
                ] as const
              ).map(([key, label]) => (
                <FormField key={key} label={label}>
                  <Input
                    value={String(form[key] ?? "")}
                    onChange={(e) => updateField(key, e.target.value)}
                  />
                </FormField>
              ))}
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Base salary">
                  <Input
                    type="number"
                    value={String(form.baseSalary ?? 0)}
                    onChange={(e) =>
                      updateField(
                        "baseSalary",
                        e.target.value === "" ? 0 : Number(e.target.value)
                      )
                    }
                  />
                </FormField>
                <FormField label="Allowances">
                  <Input
                    type="number"
                    value={String(form.allowances ?? 0)}
                    onChange={(e) =>
                      updateField(
                        "allowances",
                        e.target.value === "" ? 0 : Number(e.target.value)
                      )
                    }
                  />
                </FormField>
              </div>
              <FormField label="Status">
                <Select
                  value={String(form.status ?? "ACTIVE")}
                  onChange={(e) => updateField("status", e.target.value)}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="PROBATION">Probation</option>
                  <option value="ON_LEAVE">On leave</option>
                  <option value="TERMINATED">Terminated</option>
                </Select>
              </FormField>
              <FormActions onCancel={close} loading={loading} />
            </form>
          )}
        </FormModal>

      <FormModal title="Add document" open={showDoc} onOpenChange={setShowDoc}>
          {({ close }) => (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                addDoc(close);
              }}
            >
              <FormField label="Title">
                <Input
                  required
                  value={docForm.title}
                  onChange={(e) =>
                    setDocForm((prev) => ({ ...prev, title: e.target.value }))
                  }
                />
              </FormField>
              <FormField label="Category">
                <Select
                  value={docForm.category}
                  onChange={(e) =>
                    setDocForm((prev) => ({ ...prev, category: e.target.value }))
                  }
                >
                  <option value="CONTRACT">Contract</option>
                  <option value="ID">ID</option>
                  <option value="CERTIFICATE">Certificate</option>
                  <option value="GENERAL">General</option>
                </Select>
              </FormField>
              <FormField label="Notes">
                <Input
                  value={docForm.notes}
                  onChange={(e) =>
                    setDocForm((prev) => ({ ...prev, notes: e.target.value }))
                  }
                />
              </FormField>
              <FormActions onCancel={close} loading={loading} />
            </form>
          )}
        </FormModal>
    </div>
  );
}
