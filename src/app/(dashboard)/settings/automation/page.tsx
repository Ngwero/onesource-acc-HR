"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FormField, FormModal, FormActions, apiPost } from "@/components/ui/form-modal";
import { DataTable } from "@/components/ui/data-table";
import { formatDate } from "@/lib/utils";

export default function AutomationPage() {
  const [status, setStatus] = useState<Record<string, unknown> | null>(null);
  const [keys, setKeys] = useState<Record<string, unknown>[]>([]);
  const [webhooks, setWebhooks] = useState<Record<string, unknown>[]>([]);
  const [deliveries, setDeliveries] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [showKeyForm, setShowKeyForm] = useState(false);
  const [showHookForm, setShowHookForm] = useState(false);
  const [keyForm, setKeyForm] = useState({ name: "", scopes: "read:*" });
  const [hookForm, setHookForm] = useState({
    name: "", url: "", events: "PAYMENT_POSTED,INVOICE_CREATED,OVERDUE_INVOICE",
  });

  const load = useCallback(() => {
    Promise.all([
      fetch("/api/automation").then((r) => r.json()),
      fetch("/api/webhooks").then((r) => r.json()),
      fetch("/api/webhooks?view=deliveries").then((r) => r.json()),
    ]).then(([auto, hooks, dels]) => {
      if (auto.success) setStatus(auto.data);
      if (hooks.success) {
        setKeys(hooks.data.apiKeys || []);
        setWebhooks(hooks.data.webhooks || []);
      }
      if (dels.success) setDeliveries(dels.data || []);
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const runJobs = async () => {
    setLoading(true);
    const res = await apiPost("/api/automation", { action: "run-jobs" });
    setLoading(false);
    if (res.success) { alert("Scheduled jobs completed"); load(); }
    else alert(res.message);
  };

  const createKey = async (close: () => void) => {
    setLoading(true);
    const res = await apiPost("/api/webhooks", {
      action: "create-api-key",
      name: keyForm.name,
      scopes: keyForm.scopes.split(",").map((s) => s.trim()),
    });
    setLoading(false);
    if (res.success) {
      setNewKey(String(res.data.rawKey));
      load();
      close();
      setShowKeyForm(false);
    } else alert(res.message);
  };

  const createHook = async (close: () => void) => {
    setLoading(true);
    const res = await apiPost("/api/webhooks", {
      action: "create-webhook",
      name: hookForm.name,
      url: hookForm.url,
      events: hookForm.events.split(",").map((s) => s.trim()),
    });
    setLoading(false);
    if (res.success) {
      alert(`Webhook created. Secret: ${res.data.secret}`);
      load();
      close();
      setShowHookForm(false);
    } else alert(res.message);
  };

  return (
    <div>
      <PageHeader
        title="Automation & Integrations"
        description="Scheduled jobs, SMTP, partner API keys, and webhooks"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => window.location.href = "/settings"}>Back to Settings</Button>
            <Button onClick={runJobs} disabled={loading}>Run All Jobs Now</Button>
          </div>
        }
      />

      {status && (
        <div className="mb-6 grid gap-4 md:grid-cols-4">
          <Card><CardContent className="p-4"><p className="text-xs text-gray-500">Overdue AR</p><p className="text-2xl font-bold text-red-600">{String(status.overdueReceivables)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-gray-500">Overdue AP</p><p className="text-2xl font-bold text-amber-600">{String(status.overduePayables)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-gray-500">Due recurring</p><p className="text-2xl font-bold">{String(status.dueRecurringTemplates)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-gray-500">SMTP / Cron</p><p className="text-sm">{status.smtpConfigured ? "SMTP ✓" : "SMTP ✗"} · {status.cronConfigured ? "Cron ✓" : "Cron ✗"}</p></CardContent></Card>
        </div>
      )}

      {newKey && (
        <Card className="mb-6 border-green-200 bg-green-50">
          <CardContent className="p-4">
            <p className="mb-2 text-sm font-medium text-green-900">New API key (copy now):</p>
            <code className="block break-all rounded bg-white p-2 text-xs">{newKey}</code>
            <Button className="mt-2" size="sm" variant="outline" onClick={() => setNewKey(null)}>Dismiss</Button>
          </CardContent>
        </Card>
      )}

      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Partner API Keys</CardTitle>
          <Button size="sm" onClick={() => setShowKeyForm(true)}>Create API Key</Button>
        </CardHeader>
        <CardContent>
          <DataTable columns={[
            { key: "name", header: "Name" },
            { key: "keyPrefix", header: "Prefix" },
            { key: "scopes", header: "Scopes", render: (i) => (i.scopes as string[]).join(", ") },
            { key: "lastUsedAt", header: "Last used", render: (i) => i.lastUsedAt ? formatDate(String(i.lastUsedAt)) : "—" },
            { key: "isActive", header: "Active", render: (i) => i.isActive ? "Yes" : "No" },
          ]} data={keys} emptyMessage="No API keys" />
          <p className="mt-3 text-xs text-gray-500">OpenAPI: <Link href="/api/openapi" className="text-green-700 underline">/api/openapi</Link> · Usage: <code>GET /api/v1?resource=invoices</code> with <code>Authorization: Bearer ab_...</code></p>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Webhooks</CardTitle>
          <Button size="sm" onClick={() => setShowHookForm(true)}>Add Webhook</Button>
        </CardHeader>
        <CardContent>
          <DataTable columns={[
            { key: "name", header: "Name" },
            { key: "url", header: "URL" },
            { key: "events", header: "Events", render: (i) => (i.events as string[]).join(", ") },
            { key: "isActive", header: "Active", render: (i) => i.isActive ? "Yes" : "No" },
          ]} data={webhooks} emptyMessage="No webhooks configured" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Recent Webhook Deliveries</CardTitle></CardHeader>
        <CardContent>
          <DataTable columns={[
            { key: "event", header: "Event" },
            { key: "endpoint", header: "Endpoint", render: (i) => String((i.endpoint as { name?: string })?.name || "-") },
            { key: "success", header: "OK", render: (i) => i.success ? "✓" : "✗" },
            { key: "statusCode", header: "HTTP" },
            { key: "createdAt", header: "When", render: (i) => formatDate(String(i.createdAt)) },
          ]} data={deliveries} emptyMessage="No deliveries yet" />
        </CardContent>
      </Card>

      {showKeyForm && (
        <FormModal title="Create API Key" open={showKeyForm} onOpenChange={setShowKeyForm}>
          {({ close }) => (
            <form onSubmit={(e) => { e.preventDefault(); createKey(close); }} className="space-y-3">
              <FormField label="Name"><Input value={keyForm.name} onChange={(e) => setKeyForm((prev) => ({ ...prev, name: e.target.value }))} required /></FormField>
              <FormField label="Scopes (comma-separated)"><Input value={keyForm.scopes} onChange={(e) => setKeyForm((prev) => ({ ...prev, scopes: e.target.value }))} /></FormField>
              <FormActions onCancel={close} loading={loading} />
            </form>
          )}
        </FormModal>
      )}

      {showHookForm && (
        <FormModal title="Add Webhook" open={showHookForm} onOpenChange={setShowHookForm}>
          {({ close }) => (
            <form onSubmit={(e) => { e.preventDefault(); createHook(close); }} className="space-y-3">
              <FormField label="Name"><Input value={hookForm.name} onChange={(e) => setHookForm((prev) => ({ ...prev, name: e.target.value }))} required /></FormField>
              <FormField label="URL"><Input value={hookForm.url} onChange={(e) => setHookForm((prev) => ({ ...prev, url: e.target.value }))} required placeholder="https://example.com/webhook" /></FormField>
              <FormField label="Events"><Input value={hookForm.events} onChange={(e) => setHookForm((prev) => ({ ...prev, events: e.target.value }))} /></FormField>
              <FormActions onCancel={close} loading={loading} />
            </form>
          )}
        </FormModal>
      )}
    </div>
  );
}
