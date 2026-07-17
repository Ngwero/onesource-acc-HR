"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { FormField, FormModal, FormActions } from "@/components/ui/form-modal";
import Link from "next/link";

type MasterType = "unit" | "location" | "category";

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [master, setMaster] = useState<Record<string, unknown[]>>({});
  const [exchangeRates, setExchangeRates] = useState<Record<string, unknown>[]>([]);
  const [currencies, setCurrencies] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showMaster, setShowMaster] = useState(false);
  const [showRate, setShowRate] = useState(false);
  const [masterForm, setMasterForm] = useState({ type: "unit" as MasterType, code: "", name: "", description: "" });
  const [rateForm, setRateForm] = useState({ currencyId: "", rate: 0, effectiveDate: "" });

  const loadMaster = () => {
    Promise.all([
      fetch("/api/settings").then((r) => r.json()),
      fetch("/api/settings?section=master").then((r) => r.json()),
      fetch("/api/exchange-rates").then((r) => r.json()),
    ]).then(([s, m, er]) => {
      if (s.success && s.data) setSettings(s.data);
      if (m.success) setMaster(m.data);
      if (er.success) {
        setExchangeRates(er.data.rates || []);
        setCurrencies(er.data.currencies || []);
      }
    });
  };

  useEffect(() => { loadMaster(); }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    }).then((r) => r.json());
    setLoading(false);
    if (res.success) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
  };

  const handleMasterCreate = async (close: () => void) => {
    setLoading(true);
    const res = await fetch("/api/master", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: masterForm.type, action: "create", code: masterForm.code, name: masterForm.name, description: masterForm.description }),
    }).then((r) => r.json());
    setLoading(false);
    if (res.success) { loadMaster(); close(); setShowMaster(false); }
    else alert(res.message);
  };

  const handleRateCreate = async (close: () => void) => {
    setLoading(true);
    const res = await fetch("/api/exchange-rates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rateForm),
    }).then((r) => r.json());
    setLoading(false);
    if (res.success) { loadMaster(); close(); setShowRate(false); }
    else alert(res.message);
  };

  const update = (key: string, value: string | number) => setSettings({ ...settings, [key]: value });

  return (
    <div>
      <PageHeader title="Settings" description="Company profile, system settings, and master data" actions={
        <div className="flex gap-2">
            <Link href="/import"><Button variant="outline">Bulk Import</Button></Link>
            <Link href="/settings/account-management"><Button variant="outline">Account Management</Button></Link>
            <Link href="/settings/automation"><Button variant="outline">Automation & API</Button></Link>
        </div>
      } />

      <form onSubmit={handleSave} className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Company Profile</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <FormField label="Company Name"><Input value={String(settings.companyName || "")} onChange={(e) => update("companyName", e.target.value)} /></FormField>
            <FormField label="Address"><Input value={String(settings.address || "")} onChange={(e) => update("address", e.target.value)} /></FormField>
            <FormField label="Phone"><Input value={String(settings.phone || "")} onChange={(e) => update("phone", e.target.value)} /></FormField>
            <FormField label="Email"><Input value={String(settings.email || "")} onChange={(e) => update("email", e.target.value)} /></FormField>
            <FormField label="Website"><Input value={String(settings.website || "")} onChange={(e) => update("website", e.target.value)} /></FormField>
            <FormField label="Tax ID"><Input value={String(settings.taxId || "")} onChange={(e) => update("taxId", e.target.value)} /></FormField>
            <FormField label="Bank Details"><Input value={String(settings.bankDetails || "")} onChange={(e) => update("bankDetails", e.target.value)} /></FormField>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>System Settings</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <FormField label="Default Payment Terms (days)"><Input type="number" value={Number(settings.defaultPaymentTerms || 30)} onChange={(e) => update("defaultPaymentTerms", +e.target.value)} /></FormField>
            <FormField label="Default Tax Rate (%)"><Input type="number" step="0.01" value={Number(settings.defaultTaxRate || 0)} onChange={(e) => update("defaultTaxRate", +e.target.value)} /></FormField>
            <FormField label="Fiscal Year Start Month"><Input type="number" min={1} max={12} value={Number(settings.fiscalYearStartMonth || 1)} onChange={(e) => update("fiscalYearStartMonth", +e.target.value)} /></FormField>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Email / SMTP</CardTitle>
            <p className="text-sm text-slate-500">
              Required to send login and password-reset OTPs to user email addresses.
              Use your company mail server, Gmail app password, or Mailtrap for testing.
            </p>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <FormField label="SMTP Host">
              <Input
                placeholder="smtp.gmail.com"
                value={String(settings.smtpHost || "")}
                onChange={(e) => update("smtpHost", e.target.value)}
              />
            </FormField>
            <FormField label="SMTP Port">
              <Input
                type="number"
                placeholder="587"
                value={Number(settings.smtpPort || 587)}
                onChange={(e) => update("smtpPort", +e.target.value)}
              />
            </FormField>
            <FormField label="SMTP Username">
              <Input
                placeholder="you@company.com"
                value={String(settings.smtpUser || "")}
                onChange={(e) => update("smtpUser", e.target.value)}
              />
            </FormField>
            <FormField label="SMTP Password">
              <Input
                type="password"
                placeholder="App password / SMTP password"
                value={String(settings.smtpPass || "")}
                onChange={(e) => update("smtpPass", e.target.value)}
              />
            </FormField>
            <FormField label="From address">
              <Input
                placeholder="OneSource <noreply@company.com>"
                value={String(settings.smtpFrom || "")}
                onChange={(e) => update("smtpFrom", e.target.value)}
              />
            </FormField>
            <div className="flex items-end">
              <p className="pb-2 text-sm text-slate-500">
                {settings.smtpConfigured || (settings.smtpHost && settings.smtpUser && settings.smtpPass && settings.smtpPass !== "")
                  ? "SMTP credentials saved"
                  : "Not configured — OTPs use a temporary email preview until SMTP is set"}
              </p>
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={loading}>
                {loading ? "Saving..." : saved ? "Saved ✓" : "Save Settings"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Master Data</CardTitle>
          <Button size="sm" onClick={() => setShowMaster(true)}>Add Item</Button>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { label: "Units of Measure", data: master.units, type: "unit" },
              { label: "Stock Locations", data: master.locations, type: "location" },
              { label: "Expense Categories", data: master.categories, type: "category" },
            ].map((section) => (
              <div key={section.label} className="rounded-lg border border-green-100 p-3">
                <p className="mb-2 font-medium text-green-900">{section.label}</p>
                <ul className="space-y-1 text-sm text-gray-600">
                  {(section.data || []).map((item) => {
                    const row = item as Record<string, unknown>;
                    return (
                      <li key={String(row.id)} className="flex justify-between">
                        <span>{String(row.name || row.code)}</span>
                        <button
                          type="button"
                          className="text-xs text-red-600"
                          onClick={async () => {
                            if (!confirm("Delete this item?")) return;
                            await fetch("/api/master", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ type: section.type, action: "delete", id: row.id }),
                            });
                            loadMaster();
                          }}
                        >
                          ×
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Exchange Rates</CardTitle>
          <Button size="sm" onClick={() => setShowRate(true)}>Add Rate</Button>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1 text-sm">
            {exchangeRates.slice(0, 10).map((r) => (
              <li key={String(r.id)} className="flex justify-between border-b py-1">
                <span>{String((r.currency as { code?: string })?.code || "-")}</span>
                <span>{Number(r.rate).toFixed(4)} — {new Date(String(r.effectiveDate)).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {showMaster && (
        <FormModal title="Add Master Data" open onOpenChange={setShowMaster}>
          {({ close }) => (
            <form onSubmit={(e) => { e.preventDefault(); handleMasterCreate(close); }} className="space-y-3">
              <FormField label="Type">
                <Select value={masterForm.type} onChange={(e) => setMasterForm({ ...masterForm, type: e.target.value as MasterType })}>
                  <option value="unit">Unit of Measure</option>
                  <option value="location">Stock Location</option>
                  <option value="category">Expense Category</option>
                </Select>
              </FormField>
              <FormField label="Code"><Input value={masterForm.code} onChange={(e) => setMasterForm({ ...masterForm, code: e.target.value })} required /></FormField>
              <FormField label="Name"><Input value={masterForm.name} onChange={(e) => setMasterForm({ ...masterForm, name: e.target.value })} required /></FormField>
              {masterForm.type === "location" && (
                <FormField label="Description"><Input value={masterForm.description} onChange={(e) => setMasterForm({ ...masterForm, description: e.target.value })} /></FormField>
              )}
              <FormActions onCancel={close} loading={loading} />
            </form>
          )}
        </FormModal>
      )}

      {showRate && (
        <FormModal title="Add Exchange Rate" open onOpenChange={setShowRate}>
          {({ close }) => (
            <form onSubmit={(e) => { e.preventDefault(); handleRateCreate(close); }} className="space-y-3">
              <FormField label="Currency">
                <Select value={rateForm.currencyId} onChange={(e) => setRateForm({ ...rateForm, currencyId: e.target.value })} required>
                  <option value="">Select currency</option>
                  {currencies.map((c) => <option key={String(c.id)} value={String(c.id)}>{String(c.code)} — {String(c.name)}</option>)}
                </Select>
              </FormField>
              <FormField label="Rate"><Input type="number" step="0.000001" value={rateForm.rate} onChange={(e) => setRateForm({ ...rateForm, rate: +e.target.value })} required /></FormField>
              <FormField label="Effective Date"><Input type="date" value={rateForm.effectiveDate} onChange={(e) => setRateForm({ ...rateForm, effectiveDate: e.target.value })} /></FormField>
              <FormActions onCancel={close} loading={loading} />
            </form>
          )}
        </FormModal>
      )}
    </div>
  );
}
