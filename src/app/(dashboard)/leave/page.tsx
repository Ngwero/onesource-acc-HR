"use client";

import { useEffect, useState } from "react";
import { FormModal, FormField, FormActions } from "@/components/ui/form-modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatDate } from "@/lib/utils";

type Leave = {
  id: string;
  leaveNumber: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number | string;
  status: string;
  reason?: string;
  employee: { fullName: string; department?: { name: string } | null };
};

type Emp = { id: string; fullName: string };

export default function LeavePage() {
  const [items, setItems] = useState<Leave[]>([]);
  const [employees, setEmployees] = useState<Emp[]>([]);
  const [status, setStatus] = useState("PENDING");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({
    employeeId: "",
    leaveType: "ANNUAL",
    startDate: "",
    endDate: "",
    reason: "",
  });

  const load = () => {
    const qs = status ? `?status=${status}` : "";
    Promise.all([
      fetch(`/api/leave${qs}`).then((r) => r.json()),
      fetch("/api/employees?status=ACTIVE").then((r) => r.json()),
    ]).then(([l, e]) => {
      if (l.success) setItems(l.data);
      if (e.success) setEmployees(e.data);
    });
  };

  useEffect(() => {
    load();
  }, [status]);

  const submit = async (close: () => void) => {
    setLoading(true);
    const res = await fetch("/api/leave", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    }).then((r) => r.json());
    setLoading(false);
    if (res.success) {
      close();
      setShow(false);
      setForm({ employeeId: "", leaveType: "ANNUAL", startDate: "", endDate: "", reason: "" });
      setNotice("Leave request submitted");
      load();
    } else setNotice(res.message || "Failed");
  };

  const review = async (id: string, action: "approve" | "reject") => {
    const res = await fetch(`/api/leave/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    }).then((r) => r.json());
    if (res.success) {
      setNotice(`Leave ${action}d`);
      load();
    } else setNotice(res.message || "Failed");
  };

  return (
    <div className="dash-page space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium tracking-wide text-[#5A6B5E]">Human resources</p>
          <h1 className="dash-title mt-1 text-3xl font-semibold tracking-tight text-[#0F1F12]">
            Leave
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Requests, approvals, and balance-aware entitlements.
          </p>
        </div>
        <button type="button" className="dash-btn-primary" onClick={() => setShow(true)}>
          Request leave
        </button>
      </header>

      {notice && (
        <div className="rounded-xl border border-[#d5e8c8] bg-[#E8F2E0] px-4 py-3 text-sm text-[#105820]">
          {notice}
        </div>
      )}

      <div className="dash-card p-1.5">
        <div className="flex flex-wrap gap-1">
          {["PENDING", "APPROVED", "REJECTED", ""].map((s) => (
            <button
              key={s || "all"}
              type="button"
              onClick={() => setStatus(s)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                status === s
                  ? "bg-[#105820] text-white"
                  : "text-slate-500 hover:bg-[#F3F8F0]"
              }`}
            >
              {s || "All"}
            </button>
          ))}
        </div>
      </div>

      <section className="dash-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-[#e8f2e0] text-left text-[11px] font-semibold tracking-[0.12em] text-slate-400 uppercase">
                <th className="px-5 py-3">Request</th>
                <th className="px-5 py-3">Employee</th>
                <th className="px-5 py-3">Dates</th>
                <th className="px-5 py-3">Days</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-[#f0f6eb]">
                  <td className="px-5 py-3.5">
                    <p className="font-semibold text-[#0F1F12]">{item.leaveType}</p>
                    <p className="text-xs text-slate-400">{item.leaveNumber}</p>
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-[#0F1F12]">{item.employee.fullName}</p>
                    <p className="text-xs text-slate-400">
                      {item.employee.department?.name || "—"}
                    </p>
                  </td>
                  <td className="px-5 py-3.5 text-slate-600">
                    {formatDate(item.startDate)} → {formatDate(item.endDate)}
                  </td>
                  <td className="px-5 py-3.5 tabular-nums">{Number(item.days)}</td>
                  <td className="px-5 py-3.5">
                    <span className="rounded-full bg-[#E8F2E0] px-2.5 py-0.5 text-xs font-semibold text-[#105820]">
                      {item.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    {item.status === "PENDING" && (
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          className="text-xs font-semibold text-[#105820]"
                          onClick={() => review(item.id, "approve")}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="text-xs font-semibold text-red-600"
                          onClick={() => review(item.id, "reject")}
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-400">
                    No leave requests
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {show && (
        <FormModal title="Request leave" open onOpenChange={setShow}>
          {({ close }) => (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                submit(close);
              }}
            >
              <FormField label="Employee">
                <Select
                  required
                  value={form.employeeId}
                  onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                >
                  <option value="">Select…</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.fullName}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Type">
                <Select
                  value={form.leaveType}
                  onChange={(e) => setForm({ ...form, leaveType: e.target.value })}
                >
                  {[
                    "ANNUAL",
                    "SICK",
                    "UNPAID",
                    "MATERNITY",
                    "PATERNITY",
                    "COMPASSIONATE",
                    "OTHER",
                  ].map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              </FormField>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Start">
                  <Input
                    type="date"
                    required
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  />
                </FormField>
                <FormField label="End">
                  <Input
                    type="date"
                    required
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  />
                </FormField>
              </div>
              <FormField label="Reason">
                <Input
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                />
              </FormField>
              <FormActions onCancel={close} loading={loading} submitLabel="Submit request" />
            </form>
          )}
        </FormModal>
      )}
    </div>
  );
}
