"use client";

import { useEffect, useState } from "react";
import { FormModal, FormField, FormActions } from "@/components/ui/form-modal";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";

type Holiday = {
  id: string;
  name: string;
  date: string;
  isRecurring: boolean;
  notes?: string | null;
};

export default function HolidaysPage() {
  const [items, setItems] = useState<Holiday[]>([]);
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({ name: "", date: "", notes: "" });

  const load = () => {
    fetch("/api/hr/holidays")
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setItems(res.data);
      });
  };

  useEffect(() => {
    load();
  }, []);

  const seed = async () => {
    setLoading(true);
    const res = await fetch("/api/hr/holidays", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "seed" }),
    }).then((r) => r.json());
    setLoading(false);
    if (res.success) {
      setNotice("Uganda public holidays added");
      setItems(res.data);
    } else setNotice(res.message || "Failed");
  };

  const submit = async (close: () => void) => {
    setLoading(true);
    const res = await fetch("/api/hr/holidays", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    }).then((r) => r.json());
    setLoading(false);
    if (res.success) {
      close();
      setShow(false);
      setForm({ name: "", date: "", notes: "" });
      setNotice("Holiday created");
      load();
    } else setNotice(res.message || "Failed");
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this holiday?")) return;
    const res = await fetch(`/api/hr/holidays?id=${id}`, { method: "DELETE" }).then((r) =>
      r.json()
    );
    if (res.success) {
      setNotice("Deleted");
      load();
    } else setNotice(res.message || "Failed");
  };

  return (
    <div className="dash-page space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-[#5A6B5E]">Time & attendance</p>
          <h1 className="dash-title mt-1 text-3xl font-semibold text-[#0F1F12]">
            Company holidays
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Public and company holidays used for attendance and leave planning.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="dash-btn-secondary" onClick={seed} disabled={loading}>
            Seed UG holidays
          </button>
          <button type="button" className="dash-btn-primary" onClick={() => setShow(true)}>
            Add holiday
          </button>
        </div>
      </header>

      {notice && (
        <p className="rounded-lg bg-[#F3F8F0] px-4 py-2 text-sm text-[#105820]">{notice}</p>
      )}

      <div className="dash-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Recurring</th>
              <th className="px-4 py-3">Notes</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {items.map((h) => (
              <tr key={h.id} className="border-b last:border-0">
                <td className="px-4 py-3 font-medium">{formatDate(h.date)}</td>
                <td className="px-4 py-3">{h.name}</td>
                <td className="px-4 py-3">{h.isRecurring ? "Yes" : "No"}</td>
                <td className="px-4 py-3 text-slate-500">{h.notes || "—"}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    className="text-sm text-red-600 hover:underline"
                    onClick={() => remove(h.id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                  No holidays yet. Seed Uganda public holidays or add your own.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <FormModal open={show} onOpenChange={setShow} title="Add holiday">
        <FormField label="Name">
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </FormField>
        <FormField label="Date">
          <Input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
        </FormField>
        <FormField label="Notes">
          <Input
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </FormField>
        <FormActions
          onCancel={() => setShow(false)}
          onSubmit={() => submit(() => {})}
          loading={loading}
          submitLabel="Save"
        />
      </FormModal>
    </div>
  );
}
