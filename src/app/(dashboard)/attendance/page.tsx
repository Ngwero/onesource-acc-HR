"use client";

import { useEffect, useState } from "react";
import { FormModal, FormField, FormActions } from "@/components/ui/form-modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatDate } from "@/lib/utils";

type Row = {
  id: string;
  date: string;
  status: string;
  checkIn?: string | null;
  checkOut?: string | null;
  notes?: string | null;
  employee: { fullName: string; employeeNumber: string; department?: { name: string } | null };
};

type Emp = { id: string; fullName: string };

export default function AttendancePage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [employees, setEmployees] = useState<Emp[]>([]);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({
    employeeId: "",
    date: new Date().toISOString().slice(0, 10),
    status: "PRESENT",
    notes: "",
  });

  const load = () => {
    Promise.all([
      fetch(`/api/attendance?from=${date}&to=${date}`).then((r) => r.json()),
      fetch("/api/employees").then((r) => r.json()),
    ]).then(([a, e]) => {
      if (a.success) setRows(a.data);
      if (e.success) setEmployees(e.data);
    });
  };

  useEffect(() => {
    load();
  }, [date]);

  const save = async (close: () => void) => {
    setLoading(true);
    const res = await fetch("/api/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    }).then((r) => r.json());
    setLoading(false);
    if (res.success) {
      close();
      setShow(false);
      setNotice("Attendance saved");
      load();
    } else setNotice(res.message || "Failed");
  };

  const markAll = async (status: string) => {
    const res = await fetch("/api/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "bulk", date, status }),
    }).then((r) => r.json());
    if (res.success) {
      setNotice(res.message);
      load();
    } else setNotice(res.message || "Failed");
  };

  return (
    <div className="dash-page space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium tracking-wide text-[#5A6B5E]">Human resources</p>
          <h1 className="dash-title mt-1 text-3xl font-semibold tracking-tight text-[#0F1F12]">
            Attendance
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">Daily presence for the team.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-auto"
          />
          <button type="button" className="dash-btn-secondary" onClick={() => markAll("PRESENT")}>
            Mark all present
          </button>
          <button type="button" className="dash-btn-primary" onClick={() => setShow(true)}>
            Record attendance
          </button>
        </div>
      </header>

      {notice && (
        <div className="rounded-xl border border-[#d5e8c8] bg-[#E8F2E0] px-4 py-3 text-sm text-[#105820]">
          {notice}
        </div>
      )}

      <section className="dash-card overflow-hidden">
        <div className="border-b border-[#e8f2e0] px-5 py-4">
          <h2 className="dash-title text-lg font-semibold text-[#0F1F12]">
            {formatDate(date)}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-[#e8f2e0] text-left text-[11px] font-semibold tracking-[0.12em] text-slate-400 uppercase">
                <th className="px-5 py-3">Employee</th>
                <th className="px-5 py-3">Department</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Notes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-[#f0f6eb]">
                  <td className="px-5 py-3.5">
                    <p className="font-semibold text-[#0F1F12]">{row.employee.fullName}</p>
                    <p className="text-xs text-slate-400">{row.employee.employeeNumber}</p>
                  </td>
                  <td className="px-5 py-3.5 text-slate-600">
                    {row.employee.department?.name || "—"}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="rounded-full bg-[#E8F2E0] px-2.5 py-0.5 text-xs font-semibold text-[#105820]">
                      {row.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-slate-500">{row.notes || "—"}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-slate-400">
                    No attendance recorded for this day
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {show && (
        <FormModal title="Record attendance" open={show} onOpenChange={setShow}>
          {({ close }) => (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                save(close);
              }}
            >
              <FormField label="Employee">
                <Select
                  required
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
              <FormField label="Date">
                <Input
                  type="date"
                  required
                  value={form.date}
                  onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
                />
              </FormField>
              <FormField label="Status">
                <Select
                  value={form.status}
                  onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
                >
                  {["PRESENT", "ABSENT", "HALF_DAY", "LATE", "ON_LEAVE", "HOLIDAY"].map((s) => (
                    <option key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Notes">
                <Input
                  value={form.notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                />
              </FormField>
              <FormActions onCancel={close} loading={loading} />
            </form>
          )}
        </FormModal>
      )}
    </div>
  );
}
