"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, formatCurrency } from "@/components/ui/data-table";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FormModal, FormField, FormActions, apiPost } from "@/components/ui/form-modal";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

function parseBankCsv(text: string) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const dateIdx = headers.findIndex((h) => h.includes("date"));
  const descIdx = headers.findIndex((h) => h.includes("desc") || h.includes("narration") || h.includes("detail"));
  const amountIdx = headers.findIndex((h) => h.includes("amount") || h.includes("value"));
  const refIdx = headers.findIndex((h) => h.includes("ref"));

  return lines.slice(1).map((line) => {
    const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const amount = parseFloat(cols[amountIdx >= 0 ? amountIdx : cols.length - 1]) || 0;
    return {
      date: cols[dateIdx >= 0 ? dateIdx : 0] || new Date().toISOString(),
      description: cols[descIdx >= 0 ? descIdx : 1] || "Imported transaction",
      reference: refIdx >= 0 ? cols[refIdx] : undefined,
      amount: Math.abs(amount),
      type: amount >= 0 ? "RECEIPT" as const : "PAYMENT" as const,
    };
  });
}

export default function BankPage() {
  const [accounts, setAccounts] = useState<Record<string, unknown>[]>([]);
  const [unreconciled, setUnreconciled] = useState<Record<string, unknown>[]>([]);
  const [reconciliations, setReconciliations] = useState<Record<string, unknown>[]>([]);
  const [payables, setPayables] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showCsv, setShowCsv] = useState(false);
  const [showReconcile, setShowReconcile] = useState(false);
  const [showMatch, setShowMatch] = useState(false);
  const [matchData, setMatchData] = useState<Record<string, unknown> | null>(null);
  const [selectedTxId, setSelectedTxId] = useState("");
  const [createAllocTarget, setCreateAllocTarget] = useState("");
  const [allocations, setAllocations] = useState<Array<{ id: string; amount: number }>>([{ id: "", amount: 0 }]);
  const [showSplit, setShowSplit] = useState(false);
  const [splitForm, setSplitForm] = useState({ amount1: 0, amount2: 0, desc1: "", desc2: "" });
  const [form, setForm] = useState({ code: "", name: "", bankName: "", accountNumber: "", openingBalance: 0, currency: "UGX" });
  const [importForm, setImportForm] = useState({ bankAccountId: "", description: "", amount: 0, type: "RECEIPT" });
  const [csvForm, setCsvForm] = useState({ bankAccountId: "", csvText: "" });
  const [reconcileForm, setReconcileForm] = useState({
    bankAccountId: "", statementDate: "", openingBalance: 0, closingBalance: 0, notes: "", bookBalance: 0, variance: 0,
  });

  const load = useCallback(() => {
    Promise.all([
      fetch("/api/bank").then((r) => r.json()),
      fetch("/api/bank?view=unreconciled").then((r) => r.json()),
      fetch("/api/bank?view=reconciliations").then((r) => r.json()),
      fetch("/api/payables").then((r) => r.json()),
    ]).then(([acc, unrec, recs, pay]) => {
      if (acc.success) setAccounts(acc.data);
      if (unrec.success) setUnreconciled(unrec.data);
      if (recs.success) setReconciliations(recs.data);
      if (pay.success) setPayables(pay.data.items || []);
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadReconcileSummary = async (bankAccountId: string, closingBalance: number) => {
    const res = await fetch(`/api/bank?view=summary&bankAccountId=${bankAccountId}`).then((r) => r.json());
    if (res.success) {
      setReconcileForm((f) => ({
        ...f,
        bookBalance: res.data.bookBalance,
        variance: closingBalance - res.data.bookBalance,
      }));
    }
  };

  const openMatch = async (txId: string) => {
    setSelectedTxId(txId);
    setCreateAllocTarget("");
    setAllocations([{ id: "", amount: 0 }]);
    const res = await fetch(`/api/bank?view=suggest-matches&transactionId=${txId}`).then((r) => r.json());
    if (res.success) {
      setMatchData(res.data);
      const tx = res.data.transaction as Record<string, unknown>;
      setAllocations([{ id: "", amount: Number(tx.amount) }]);
      setShowMatch(true);
    } else alert(res.message);
  };

  const handleCreate = async (close: () => void) => {
    setLoading(true);
    const res = await apiPost("/api/bank", { action: "create-account", ...form });
    setLoading(false);
    if (res.success) { load(); close(); setShowCreate(false); }
    else alert(res.message);
  };

  const handleImport = async (close: () => void) => {
    setLoading(true);
    const res = await apiPost("/api/bank", {
      action: "import",
      bankAccountId: importForm.bankAccountId,
      transactions: [{ date: new Date().toISOString(), description: importForm.description, amount: importForm.amount, type: importForm.type }],
    });
    setLoading(false);
    if (res.success) { load(); close(); }
    else alert(res.message);
  };

  const handleCsvImport = async (close: () => void) => {
    const transactions = parseBankCsv(csvForm.csvText);
    if (!csvForm.bankAccountId || transactions.length === 0) return alert("Select account and paste valid CSV");
    setLoading(true);
    const res = await apiPost("/api/bank", { action: "import", bankAccountId: csvForm.bankAccountId, transactions });
    setLoading(false);
    if (res.success) { alert(`${res.data?.imported || transactions.length} transactions imported`); load(); close(); setShowCsv(false); }
    else alert(res.message);
  };

  const handleCompleteReconciliation = async (close: () => void) => {
    setLoading(true);
    const res = await apiPost("/api/bank", { action: "complete-reconciliation", ...reconcileForm, postVariance: true });
    setLoading(false);
    if (res.success) {
      const v = res.data?.varianceAmount;
      alert(Math.abs(Number(v)) >= 0.01
        ? `Reconciliation complete. Variance ${formatCurrency(Number(v))} posted to GL.`
        : "Reconciliation complete — no variance.");
      load();
      close();
      setShowReconcile(false);
    } else alert(res.message);
  };

  const handleMatchPayment = async (paymentId: string) => {
    setLoading(true);
    const res = await apiPost("/api/bank", { action: "match-payment", transactionId: selectedTxId, paymentId });
    setLoading(false);
    if (res.success) { setShowMatch(false); load(); }
    else alert(res.message);
  };

  const handleCreateAndMatch = async () => {
    const tx = matchData?.transaction as Record<string, unknown>;
    const outflow = ["WITHDRAWAL", "PAYMENT", "FEE", "TRANSFER"].includes(String(tx?.type));
    const validAllocs = allocations.filter((a) => a.id && a.amount > 0);
    if (validAllocs.length === 0) return alert("Add at least one allocation");

    const allocTotal = validAllocs.reduce((s, a) => s + a.amount, 0);
    if (Math.abs(allocTotal - Number(tx?.amount)) > 0.01) {
      return alert(`Allocations (${formatCurrency(allocTotal)}) must equal transaction amount (${formatCurrency(Number(tx?.amount))})`);
    }

    setLoading(true);
    const res = await apiPost("/api/bank", {
      action: "match-create-payment",
      transactionId: selectedTxId,
      allocations: validAllocs.map((a) => ({
        ...(outflow ? { payableId: a.id } : { receivableId: a.id }),
        amount: a.amount,
      })),
      reference: String(tx?.reference || ""),
    });
    setLoading(false);
    if (res.success) { setShowMatch(false); load(); }
    else alert(res.message);
  };

  const handleSplit = async (close: () => void) => {
    const total = splitForm.amount1 + splitForm.amount2;
    const tx = matchData?.transaction as Record<string, unknown> | undefined;
    if (tx && Math.abs(total - Number(tx.amount)) > 0.01) {
      return alert("Split amounts must equal transaction total");
    }
    setLoading(true);
    const res = await apiPost("/api/bank", {
      action: "split-transaction",
      transactionId: selectedTxId,
      splits: [
        { amount: splitForm.amount1, description: splitForm.desc1 || undefined },
        { amount: splitForm.amount2, description: splitForm.desc2 || undefined },
      ],
    });
    setLoading(false);
    if (res.success) { setShowSplit(false); setShowMatch(false); close(); load(); }
    else alert(res.message);
  };

  const handleExclude = async (txId: string) => {
    if (!confirm("Exclude this transaction from reconciliation?")) return;
    const res = await apiPost("/api/bank", { action: "exclude", transactionId: txId });
    if (res.success) load();
    else alert(res.message);
  };

  const handleBatchPay = async () => {
    const ids = payables.slice(0, 3).map((p) => p.id as string);
    const bankId = accounts[0]?.id as string;
    if (!bankId || ids.length === 0) return alert("Need bank account and payables");
    const res = await apiPost("/api/bank", { action: "batch-payment", bankAccountId: bankId, payableIds: ids });
    if (res.success) { alert("Batch payment processed with GL posting"); load(); }
    else alert(res.message);
  };

  const totalBalance = accounts.reduce((s, a) => s + Number(a.currentBalance), 0);
  const suggestedPayments = (matchData?.suggestedPayments as Record<string, unknown>[]) || [];
  const openPayables = (matchData?.openPayables as Record<string, unknown>[]) || [];
  const openReceivables = (matchData?.openReceivables as Record<string, unknown>[]) || [];
  const matchTx = matchData?.transaction as Record<string, unknown> | undefined;
  const isOutflow = matchTx && ["WITHDRAWAL", "PAYMENT", "FEE", "TRANSFER"].includes(String(matchTx.type));

  return (
    <div>
      <PageHeader
        title="Bank Accounts"
        description="Import transactions, match to payments, and reconcile with GL variance posting"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setShowCreate(true)}>Add Account</Button>
            <Button variant="outline" onClick={() => setShowImport(true)}>Import Transaction</Button>
            <Button variant="outline" onClick={() => setShowCsv(true)}>Import CSV</Button>
            <Button variant="outline" onClick={() => setShowReconcile(true)}>Complete Reconciliation</Button>
            <Button onClick={handleBatchPay}>Batch Pay Suppliers</Button>
          </div>
        }
      />

      {showMatch && matchTx && (
        <FormModal title="Match Bank Transaction" open={showMatch} onOpenChange={setShowMatch}>
          {() => (
            <div className="space-y-4">
              <div className="rounded border bg-gray-50 p-3 text-sm">
                <p><strong>{String(matchTx.description)}</strong></p>
                <p>{formatDate(String(matchTx.date))} · {formatCurrency(Number(matchTx.amount))} · {String(matchTx.type)}</p>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">Suggested payments</p>
                {suggestedPayments.length === 0 ? (
                  <p className="text-sm text-gray-500">No matching payments found by amount/date.</p>
                ) : (
                  <div className="space-y-2">
                    {suggestedPayments.map((p) => (
                      <div key={String(p.id)} className="flex items-center justify-between rounded border p-2 text-sm">
                        <span>
                          {String(p.paymentNumber)} — {formatCurrency(Number(p.amount))}
                          {p.payable ? ` · ${String((p.payable as { supplier?: { name?: string } }).supplier?.name || "")}` : ""}
                          {p.receivable ? ` · ${String((p.receivable as { customer?: { name?: string } }).customer?.name || "")}` : ""}
                        </span>
                        <Button size="sm" onClick={() => handleMatchPayment(String(p.id))} disabled={loading}>Match</Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">Or create payment with multi-invoice allocation</p>
                {allocations.map((alloc, idx) => (
                  <div key={idx} className="mb-2 grid grid-cols-2 gap-2">
                    <Select
                      value={alloc.id}
                      onChange={(e) => {
                        const next = [...allocations];
                        next[idx] = { ...next[idx], id: e.target.value };
                        setAllocations(next);
                      }}
                    >
                      <option value="">Select {isOutflow ? "payable" : "receivable"}</option>
                      {(isOutflow ? openPayables : openReceivables).map((i) => (
                        <option key={String(i.id)} value={String(i.id)}>
                          {String(i.payableNumber || i.receivableNumber)} — {formatCurrency(Number(i.balance))}
                        </option>
                      ))}
                    </Select>
                    <Input
                      type="number"
                      value={alloc.amount}
                      onChange={(e) => {
                        const next = [...allocations];
                        next[idx] = { ...next[idx], amount: +e.target.value };
                        setAllocations(next);
                      }}
                    />
                  </div>
                ))}
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setAllocations([...allocations, { id: "", amount: 0 }])}>
                    Add line
                  </Button>
                  <Button variant="outline" onClick={handleCreateAndMatch} disabled={loading}>
                    Create payment & match
                  </Button>
                  <Button variant="outline" onClick={() => {
                    const tx = matchData?.transaction as Record<string, unknown>;
                    setSplitForm({
                      amount1: Number(tx?.amount) / 2,
                      amount2: Number(tx?.amount) / 2,
                      desc1: `${String(tx?.description)} (1)`,
                      desc2: `${String(tx?.description)} (2)`,
                    });
                    setShowSplit(true);
                  }}>
                    Split transaction
                  </Button>
                </div>
              </div>
            </div>
          )}
        </FormModal>
      )}

      {showSplit && (
        <FormModal title="Split Bank Transaction" open={showSplit} onOpenChange={setShowSplit}>
          {({ close }) => (
            <form onSubmit={(e) => { e.preventDefault(); handleSplit(close); }} className="space-y-3">
              <FormField label="Split 1 Amount"><Input type="number" value={splitForm.amount1} onChange={(e) => setSplitForm((prev) => ({ ...prev, amount1: +e.target.value }))} /></FormField>
              <FormField label="Split 1 Description"><Input value={splitForm.desc1} onChange={(e) => setSplitForm((prev) => ({ ...prev, desc1: e.target.value }))} /></FormField>
              <FormField label="Split 2 Amount"><Input type="number" value={splitForm.amount2} onChange={(e) => setSplitForm((prev) => ({ ...prev, amount2: +e.target.value }))} /></FormField>
              <FormField label="Split 2 Description"><Input value={splitForm.desc2} onChange={(e) => setSplitForm((prev) => ({ ...prev, desc2: e.target.value }))} /></FormField>
              <FormActions onCancel={close} loading={loading} />
            </form>
          )}
        </FormModal>
      )}

      {showCreate && (
        <FormModal title="Add Bank Account" open={showCreate} onOpenChange={setShowCreate}>
          {({ close }) => (
            <form onSubmit={(e) => { e.preventDefault(); handleCreate(close); }} className="space-y-3">
              <FormField label="Code"><Input value={form.code} onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))} required /></FormField>
              <FormField label="Account Name"><Input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} required /></FormField>
              <FormField label="Bank Name"><Input value={form.bankName} onChange={(e) => setForm((prev) => ({ ...prev, bankName: e.target.value }))} /></FormField>
              <FormField label="Account Number"><Input value={form.accountNumber} onChange={(e) => setForm((prev) => ({ ...prev, accountNumber: e.target.value }))} /></FormField>
              <FormField label="Opening Balance"><Input type="number" value={form.openingBalance} onChange={(e) => setForm((prev) => ({ ...prev, openingBalance: +e.target.value }))} /></FormField>
              <FormActions onCancel={close} loading={loading} />
            </form>
          )}
        </FormModal>
      )}

      {showImport && (
        <FormModal title="Import Bank Transaction" open={showImport} onOpenChange={setShowImport}>
          {({ close }) => (
            <form onSubmit={(e) => { e.preventDefault(); handleImport(close); }} className="space-y-3">
              <FormField label="Bank Account">
                <Select value={importForm.bankAccountId} onChange={(e) => setImportForm((prev) => ({ ...prev, bankAccountId: e.target.value }))} required>
                  <option value="">Select account</option>
                  {accounts.map((a) => <option key={String(a.id)} value={String(a.id)}>{String(a.name)}</option>)}
                </Select>
              </FormField>
              <FormField label="Description"><Input value={importForm.description} onChange={(e) => setImportForm((prev) => ({ ...prev, description: e.target.value }))} required /></FormField>
              <FormField label="Amount"><Input type="number" value={importForm.amount} onChange={(e) => setImportForm((prev) => ({ ...prev, amount: +e.target.value }))} required /></FormField>
              <FormField label="Type">
                <Select value={importForm.type} onChange={(e) => setImportForm((prev) => ({ ...prev, type: e.target.value }))}>
                  <option value="RECEIPT">Receipt</option>
                  <option value="PAYMENT">Payment</option>
                  <option value="FEE">Fee</option>
                </Select>
              </FormField>
              <FormActions onCancel={close} loading={loading} />
            </form>
          )}
        </FormModal>
      )}

      {showCsv && (
        <FormModal title="Import Bank CSV" open={showCsv} onOpenChange={setShowCsv}>
          {({ close }) => (
            <form onSubmit={(e) => { e.preventDefault(); handleCsvImport(close); }} className="space-y-3">
              <FormField label="Bank Account">
                <Select value={csvForm.bankAccountId} onChange={(e) => setCsvForm((prev) => ({ ...prev, bankAccountId: e.target.value }))} required>
                  <option value="">Select account</option>
                  {accounts.map((a) => <option key={String(a.id)} value={String(a.id)}>{String(a.name)}</option>)}
                </Select>
              </FormField>
              <FormField label="CSV Data (date, description, amount)">
                <textarea
                  className="min-h-32 w-full rounded-md border border-gray-300 p-2 text-sm"
                  value={csvForm.csvText}
                  onChange={(e) => setCsvForm((prev) => ({ ...prev, csvText: e.target.value }))}
                  placeholder={"date,description,amount\n2025-01-15,Supplier payment,-50000\n2025-01-16,Customer receipt,120000"}
                />
              </FormField>
              <FormActions onCancel={close} loading={loading} />
            </form>
          )}
        </FormModal>
      )}

      {showReconcile && (
        <FormModal title="Complete Bank Reconciliation" open={showReconcile} onOpenChange={setShowReconcile}>
          {({ close }) => (
            <form onSubmit={(e) => { e.preventDefault(); handleCompleteReconciliation(close); }} className="space-y-3">
              <p className="text-xs text-amber-600">All transactions must be matched or excluded. Statement variance posts to GL (1110/5900/4300).</p>
              <FormField label="Bank Account">
                <Select
                  value={reconcileForm.bankAccountId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setReconcileForm((prev) => ({ ...prev, bankAccountId: id }));
                    if (id) loadReconcileSummary(id, reconcileForm.closingBalance);
                  }}
                  required
                >
                  <option value="">Select account</option>
                  {accounts.map((a) => <option key={String(a.id)} value={String(a.id)}>{String(a.name)}</option>)}
                </Select>
              </FormField>
              <FormField label="Statement Date"><Input type="date" value={reconcileForm.statementDate} onChange={(e) => setReconcileForm((prev) => ({ ...prev, statementDate: e.target.value }))} required /></FormField>
              <FormField label="Opening Balance"><Input type="number" value={reconcileForm.openingBalance} onChange={(e) => setReconcileForm((prev) => ({ ...prev, openingBalance: +e.target.value }))} required /></FormField>
              <FormField label="Closing Balance (Statement)">
                <Input
                  type="number"
                  value={reconcileForm.closingBalance}
                  onChange={(e) => {
                    const closing = +e.target.value;
                    setReconcileForm((prev) => ({
                      ...prev,
                      closingBalance: closing,
                      variance: closing - reconcileForm.bookBalance,
                    }));
                  }}
                  required
                />
              </FormField>
              {reconcileForm.bankAccountId && (
                <div className="rounded border p-3 text-sm">
                  <p>Book balance: {formatCurrency(reconcileForm.bookBalance)}</p>
                  <p className={Math.abs(reconcileForm.variance) >= 0.01 ? "text-amber-700" : "text-green-700"}>
                    Variance: {formatCurrency(reconcileForm.variance)}
                  </p>
                </div>
              )}
              <FormField label="Notes"><Input value={reconcileForm.notes} onChange={(e) => setReconcileForm((prev) => ({ ...prev, notes: e.target.value }))} /></FormField>
              <FormActions onCancel={close} loading={loading} />
            </form>
          )}
        </FormModal>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="p-4"><p className="text-xs text-gray-500">Total Balance</p><p className="text-2xl font-bold">{formatCurrency(totalBalance)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-gray-500">Accounts</p><p className="text-2xl font-bold">{accounts.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-gray-500">Unreconciled</p><p className="text-2xl font-bold text-amber-600">{unreconciled.length}</p></CardContent></Card>
      </div>

      <h2 className="mb-3 text-lg font-semibold">Bank Accounts</h2>
      <DataTable columns={[
        { key: "code", header: "Code" }, { key: "name", header: "Name" }, { key: "bankName", header: "Bank" },
        { key: "currentBalance", header: "Balance", render: (i) => formatCurrency(Number(i.currentBalance)) },
      ]} data={accounts} />

      <h2 className="mb-3 mt-8 text-lg font-semibold">Unreconciled — match to payments</h2>
      <DataTable columns={[
        { key: "date", header: "Date", render: (i) => formatDate(String(i.date)) },
        { key: "description", header: "Description" },
        { key: "type", header: "Type" },
        { key: "amount", header: "Amount", render: (i) => formatCurrency(Number(i.amount)) },
        {
          key: "id",
          header: "Actions",
          render: (i) => (
            <div className="flex gap-2">
              <Button size="sm" onClick={() => openMatch(String(i.id))}>Match</Button>
              <Button size="sm" variant="outline" onClick={() => handleExclude(String(i.id))}>Exclude</Button>
            </div>
          ),
        },
      ]} data={unreconciled} emptyMessage="All reconciled ✓" />

      <h2 className="mb-3 mt-8 text-lg font-semibold">Reconciliation History</h2>
      <DataTable columns={[
        { key: "statementDate", header: "Statement Date", render: (i) => formatDate(String(i.statementDate)) },
        { key: "bankAccount", header: "Account", render: (i) => String((i.bankAccount as { name?: string })?.name || "-") },
        { key: "bookBalance", header: "Book", render: (i) => formatCurrency(Number(i.bookBalance)) },
        { key: "closingBalance", header: "Statement", render: (i) => formatCurrency(Number(i.closingBalance)) },
        { key: "varianceAmount", header: "Variance", render: (i) => formatCurrency(Number(i.varianceAmount)) },
        { key: "varianceJournalRef", header: "GL Journal", render: (i) => String(i.varianceJournalRef || "-") },
        { key: "reconciledAt", header: "Completed", render: (i) => i.reconciledAt ? formatDate(String(i.reconciledAt)) : "-" },
      ]} data={reconciliations} emptyMessage="No reconciliations yet" />
    </div>
  );
}
