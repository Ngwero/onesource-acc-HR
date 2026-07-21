"use client";

import { useEffect, useState } from "react";
import { FormModal, FormField, FormActions } from "@/components/ui/form-modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/lib/utils";

type PayRun = {
  id: string;
  payRunNumber: string;
  periodStart: string;
  periodEnd: string;
  totalGross: number | string;
  totalDeductions?: number | string;
  totalNet: number | string;
  totalPaye?: number | string;
  totalNssfEmployee?: number | string;
  status: string;
  items: Array<{
    id: string;
    basicPay?: number | string;
    allowances?: number | string;
    grossPay: number | string;
    paye?: number | string;
    nssfEmployee?: number | string;
    deductions: number | string;
    netPay: number | string;
    employee: { fullName: string; employeeNumber: string };
  }>;
};

export default function PayrollPage() {
  const [runs, setRuns] = useState<PayRun[]>([]);
  const [selected, setSelected] = useState<PayRun | null>(null);
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({
    periodStart: "",
    periodEnd: "",
    paymentMethod: "BANK_TRANSFER",
    notes: "",
  });

  const load = () => {
    fetch("/api/payroll")
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setRuns(res.data);
      });
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (close: () => void) => {
    setLoading(true);
    const res = await fetch("/api/payroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    }).then((r) => r.json());
    setLoading(false);
    if (res.success) {
      close();
      setShow(false);
      setNotice("Pay run created with PAYE & NSSF");
      load();
      setSelected(res.data);
    } else setNotice(res.message || "Failed");
  };

  const action = async (id: string, act: "approve" | "pay" | "cancel") => {
    const res = await fetch(`/api/payroll/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: act }),
    }).then((r) => r.json());
    if (res.success) {
      setNotice(res.message || `Pay run ${act}ed`);
      load();
      setSelected(res.data);
    } else setNotice(res.message || "Failed");
  };

  return (
    <div className="dash-page space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium tracking-wide text-[#5A6B5E]">Human resources</p>
          <h1 className="dash-title mt-1 text-3xl font-semibold tracking-tight text-[#0F1F12]">
            Payroll
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Monthly runs with Uganda PAYE and NSSF (5% / 10%).
          </p>
        </div>
        <button type="button" className="dash-btn-primary" onClick={() => setShow(true)}>
          New pay run
        </button>
      </header>

      {notice && (
        <div className="rounded-xl border border-[#d5e8c8] bg-[#E8F2E0] px-4 py-3 text-sm text-[#105820]">
          {notice}
        </div>
      )}

      <section className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
        <div className="dash-card overflow-hidden">
          <div className="border-b border-[#e8f2e0] px-5 py-4">
            <h2 className="dash-title text-lg font-semibold text-[#0F1F12]">Pay runs</h2>
          </div>
          <ul className="divide-y divide-[#f0f6eb]">
            {runs.map((run) => (
              <li key={run.id}>
                <button
                  type="button"
                  onClick={() => setSelected(run)}
                  className={`flex w-full items-start justify-between px-5 py-4 text-left hover:bg-[#F3F8F0]/70 ${
                    selected?.id === run.id ? "bg-[#F3F8F0]" : ""
                  }`}
                >
                  <div>
                    <p className="font-semibold text-[#0F1F12]">{run.payRunNumber}</p>
                    <p className="text-xs text-slate-500">
                      {formatDate(run.periodStart)} → {formatDate(run.periodEnd)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold tabular-nums text-[#105820]">
                      {formatCurrency(Number(run.totalNet))}
                    </p>
                    <p className="text-xs text-slate-400">{run.status}</p>
                  </div>
                </button>
              </li>
            ))}
            {runs.length === 0 && (
              <li className="px-5 py-10 text-center text-sm text-slate-400">No pay runs yet</li>
            )}
          </ul>
        </div>

        <div className="dash-card p-5">
          {!selected ? (
            <p className="py-16 text-center text-sm text-slate-400">Select a pay run to view payslips</p>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="dash-title text-lg font-semibold text-[#0F1F12]">
                    {selected.payRunNumber}
                  </h2>
                  <p className="text-sm text-slate-500">
                    {formatDate(selected.periodStart)} → {formatDate(selected.periodEnd)} ·{" "}
                    {selected.status}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selected.status === "DRAFT" && (
                    <>
                      <button
                        type="button"
                        className="dash-btn-primary"
                        onClick={() => action(selected.id, "approve")}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="dash-btn-secondary"
                        onClick={() => action(selected.id, "cancel")}
                      >
                        Cancel
                      </button>
                    </>
                  )}
                  {selected.status === "APPROVED" && (
                    <button
                      type="button"
                      className="dash-btn-primary"
                      onClick={() => action(selected.id, "pay")}
                    >
                      Pay & post GL
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-4">
                {[
                  ["Gross", selected.totalGross],
                  ["PAYE", selected.totalPaye || 0],
                  ["NSSF (emp)", selected.totalNssfEmployee || 0],
                  ["Net", selected.totalNet],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-xl bg-[#F3F8F0] px-3 py-2">
                    <p className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
                      {label}
                    </p>
                    <p className="mt-0.5 text-sm font-semibold tabular-nums text-[#0F1F12]">
                      {formatCurrency(Number(value))}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-[#e8f2e0] text-left text-[11px] font-semibold tracking-[0.1em] text-slate-400 uppercase">
                      <th className="py-2 pr-3">Employee</th>
                      <th className="py-2 pr-3">Gross</th>
                      <th className="py-2 pr-3">PAYE</th>
                      <th className="py-2 pr-3">NSSF</th>
                      <th className="py-2">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.items.map((item) => (
                      <tr key={item.id} className="border-b border-[#f0f6eb]">
                        <td className="py-2.5 pr-3">
                          <p className="font-medium text-[#0F1F12]">{item.employee.fullName}</p>
                          <p className="text-xs text-slate-400">{item.employee.employeeNumber}</p>
                        </td>
                        <td className="py-2.5 pr-3 tabular-nums">
                          {formatCurrency(Number(item.grossPay))}
                        </td>
                        <td className="py-2.5 pr-3 tabular-nums">
                          {formatCurrency(Number(item.paye || 0))}
                        </td>
                        <td className="py-2.5 pr-3 tabular-nums">
                          {formatCurrency(Number(item.nssfEmployee || 0))}
                        </td>
                        <td className="py-2.5 font-semibold tabular-nums text-[#105820]">
                          {formatCurrency(Number(item.netPay))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </section>

      {show && (
        <FormModal title="New pay run" open={show} onOpenChange={setShow}>
          {({ close }) => (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                create(close);
              }}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Period start">
                  <Input
                    type="date"
                    required
                    value={form.periodStart}
                    onChange={(e) => setForm((prev) => ({ ...prev, periodStart: e.target.value }))}
                  />
                </FormField>
                <FormField label="Period end">
                  <Input
                    type="date"
                    required
                    value={form.periodEnd}
                    onChange={(e) => setForm((prev) => ({ ...prev, periodEnd: e.target.value }))}
                  />
                </FormField>
              </div>
              <FormField label="Payment method">
                <Select
                  value={form.paymentMethod}
                  onChange={(e) => setForm((prev) => ({ ...prev, paymentMethod: e.target.value }))}
                >
                  <option value="BANK_TRANSFER">Bank transfer</option>
                  <option value="CASH">Cash</option>
                  <option value="MOBILE_MONEY">Mobile money</option>
                </Select>
              </FormField>
              <FormField label="Notes">
                <Input
                  value={form.notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                />
              </FormField>
              <p className="rounded-xl bg-[#F3F8F0] px-3 py-2 text-xs text-slate-600">
                Includes all active / probation / on-leave staff. Gross = basic + allowances.
                Deductions = PAYE + NSSF 5%.
              </p>
              <FormActions onCancel={close} loading={loading} submitLabel="Create pay run" />
            </form>
          )}
        </FormModal>
      )}
    </div>
  );
}
