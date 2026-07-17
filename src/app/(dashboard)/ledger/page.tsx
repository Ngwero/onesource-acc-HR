"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, formatCurrency } from "@/components/ui/data-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormModal, FormField, FormActions, apiPost } from "@/components/ui/form-modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export default function LedgerPage() {
  const [entries, setEntries] = useState<Record<string, unknown>[]>([]);
  const [trialBalance, setTrialBalance] = useState<Record<string, unknown>[]>([]);
  const [accounts, setAccounts] = useState<Record<string, unknown>[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showCoa, setShowCoa] = useState(false);
  const [reconciliation, setReconciliation] = useState<Record<string, unknown> | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [journalAction, setJournalAction] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    description: "", reference: "", debitAccountCode: "", creditAccountCode: "", amount: 0,
  });
  const [coaForm, setCoaForm] = useState({ code: "", name: "", accountType: "EXPENSE" });

  const load = () => {
    Promise.all([
      fetch("/api/ledger").then((r) => r.json()),
      fetch("/api/ledger?view=trial-balance").then((r) => r.json()),
      fetch("/api/ledger?view=reconciliation").then((r) => r.json()),
      fetch("/api/chart-of-accounts").then((r) => r.json()),
    ]).then(([entriesRes, tbRes, recRes, accRes]) => {
      if (entriesRes.success) setEntries(entriesRes.data);
      if (tbRes.success) setTrialBalance(tbRes.data);
      if (recRes.success) setReconciliation(recRes.data);
      if (accRes.success) setAccounts(accRes.data);
    });
  };

  const syncBalances = async () => {
    setSyncing(true);
    const res = await apiPost("/api/ledger", { action: "sync-balances" });
    setSyncing(false);
    if (res.success) { alert(res.message); load(); }
    else alert(res.message);
  };

  const postJournal = async (entryId: string) => {
    if (!confirm("Post this draft journal to the general ledger?")) return;
    setJournalAction(entryId);
    const res = await apiPost("/api/ledger", { action: "post-journal", entryId });
    setJournalAction(null);
    if (res.success) load();
    else alert(res.message);
  };

  const reverseJournal = async (entryId: string) => {
    if (!confirm("Create a reversing journal entry for this posting?")) return;
    setJournalAction(entryId);
    const res = await apiPost("/api/ledger", { action: "reverse-journal", entryId });
    setJournalAction(null);
    if (res.success) load();
    else alert(res.message);
  };

  useEffect(() => { load(); }, []);

  const handleJournal = async (close: () => void) => {
    setLoading(true);
    const res = await apiPost("/api/ledger", {
      description: form.description,
      reference: form.reference,
      lines: [{
        debitAccountCode: form.debitAccountCode,
        creditAccountCode: form.creditAccountCode,
        amount: form.amount,
      }],
    });
    setLoading(false);
    if (res.success) { load(); close(); setShowForm(false); }
    else alert(res.message);
  };

  const handleCoaCreate = async (close: () => void) => {
    setLoading(true);
    const res = await fetch("/api/chart-of-accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(coaForm),
    }).then((r) => r.json());
    setLoading(false);
    if (res.success) { load(); close(); setShowCoa(false); }
    else alert(res.message);
  };

  const deactivateAccount = async (id: string) => {
    if (!confirm("Deactivate this account?")) return;
    await fetch(`/api/chart-of-accounts?id=${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div>
      <PageHeader title="Accounting Ledger" description="Journal entries, GL trial balance, and subledger reconciliation" actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={syncBalances} disabled={syncing}>{syncing ? "Syncing..." : "Sync GL Balances"}</Button>
          <Button variant="outline" onClick={() => setShowCoa(true)}>Add Account</Button>
          <Button onClick={() => setShowForm(true)}>Manual Journal Entry</Button>
        </div>
      } />

      {showForm && (
        <FormModal title="Manual Journal Entry" open onOpenChange={setShowForm}>
          {({ close }) => (
            <form onSubmit={(e) => { e.preventDefault(); handleJournal(close); }} className="space-y-3">
              <FormField label="Description"><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required /></FormField>
              <FormField label="Reference"><Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></FormField>
              <FormField label="Debit Account Code">
                <Input list="accounts" value={form.debitAccountCode} onChange={(e) => setForm({ ...form, debitAccountCode: e.target.value })} required placeholder="e.g. 5200" />
              </FormField>
              <FormField label="Credit Account Code">
                <Input list="accounts" value={form.creditAccountCode} onChange={(e) => setForm({ ...form, creditAccountCode: e.target.value })} required placeholder="e.g. 1100" />
              </FormField>
              <datalist id="accounts">
                {accounts.filter((a) => a.isActive !== false).map((a) => <option key={String(a.id)} value={String(a.code)}>{String(a.name)}</option>)}
              </datalist>
              <FormField label="Amount"><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: +e.target.value })} required /></FormField>
              <FormActions onCancel={close} loading={loading} />
            </form>
          )}
        </FormModal>
      )}

      {showCoa && (
        <FormModal title="Add Chart of Account" open onOpenChange={setShowCoa}>
          {({ close }) => (
            <form onSubmit={(e) => { e.preventDefault(); handleCoaCreate(close); }} className="space-y-3">
              <FormField label="Code"><Input value={coaForm.code} onChange={(e) => setCoaForm({ ...coaForm, code: e.target.value })} required /></FormField>
              <FormField label="Name"><Input value={coaForm.name} onChange={(e) => setCoaForm({ ...coaForm, name: e.target.value })} required /></FormField>
              <FormField label="Type">
                <Select value={coaForm.accountType} onChange={(e) => setCoaForm({ ...coaForm, accountType: e.target.value })}>
                  {["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"].map((t) => <option key={t} value={t}>{t}</option>)}
                </Select>
              </FormField>
              <FormActions onCancel={close} loading={loading} />
            </form>
          )}
        </FormModal>
      )}

      <Card className="mb-6">
        <CardHeader><CardTitle className="text-lg">Chart of Accounts</CardTitle></CardHeader>
        <CardContent>
          <DataTable columns={[
            { key: "code", header: "Code" },
            { key: "name", header: "Account" },
            { key: "accountType", header: "Type" },
            { key: "isActive", header: "Active", render: (i) => (i.isActive !== false ? "Yes" : "No") },
            { key: "id", header: "Action", render: (i) => i.isActive !== false ? (
              <Button size="sm" variant="outline" onClick={() => deactivateAccount(String(i.id))}>Deactivate</Button>
            ) : null },
          ]} data={accounts} />
        </CardContent>
      </Card>

      {reconciliation && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Subledger vs GL Reconciliation</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`mb-3 text-sm ${reconciliation.isBalanced ? "text-green-700" : "text-amber-700"}`}>
              {reconciliation.isBalanced
                ? "All subledgers match their GL control accounts."
                : "Variances found — historical transactions may predate GL posting. Click Sync GL Balances after reviewing."}
            </p>
            <DataTable columns={[
              { key: "subledger", header: "Subledger" },
              { key: "glAccount", header: "GL Account" },
              { key: "subledgerBalance", header: "Subledger", render: (i) => formatCurrency(Number(i.subledgerBalance)) },
              { key: "glBalance", header: "GL Balance", render: (i) => formatCurrency(Number(i.glBalance)) },
              { key: "variance", header: "Variance", render: (i) => (
                <span className={Math.abs(Number(i.variance)) >= 1 ? "text-amber-700 font-medium" : ""}>
                  {formatCurrency(Number(i.variance))}
                </span>
              ) },
            ]} data={(reconciliation.rows as Record<string, unknown>[]) || []} />
          </CardContent>
        </Card>
      )}

      <Card className="mb-6">
        <CardHeader><CardTitle className="text-lg">Trial Balance (from Posted Journals)</CardTitle></CardHeader>
        <CardContent>
          <DataTable columns={[
            { key: "code", header: "Code" },
            { key: "name", header: "Account" },
            { key: "type", header: "Type" },
            { key: "balance", header: "Balance", render: (i) => formatCurrency(Number(i.balance)) },
          ]} data={trialBalance} />
        </CardContent>
      </Card>

      <h2 className="mb-3 text-lg font-semibold">Recent Journal Entries</h2>
      <DataTable columns={[
        { key: "journalNumber", header: "Journal #" },
        { key: "description", header: "Description" },
        { key: "status", header: "Status" },
        { key: "id", header: "Actions", render: (i) => {
          const status = String(i.status);
          const id = String(i.id);
          if (status === "DRAFT") {
            return (
              <Button size="sm" variant="outline" disabled={journalAction === id} onClick={() => postJournal(id)}>
                {journalAction === id ? "Posting..." : "Post"}
              </Button>
            );
          }
          if (status === "POSTED" && !String(i.reference || "").startsWith("Reversal of")) {
            return (
              <Button size="sm" variant="outline" disabled={journalAction === id} onClick={() => reverseJournal(id)}>
                {journalAction === id ? "Reversing..." : "Reverse"}
              </Button>
            );
          }
          return null;
        } },
      ]} data={entries} />
    </div>
  );
}
