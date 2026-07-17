"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { DataTable } from "@/components/ui/data-table";
import { exportToCSV, exportToExcel } from "@/lib/export";
import { parseSpreadsheetBuffer } from "@/lib/bulk-import-parser";

type EntityOption = {
  id: string;
  label: string;
  description: string;
  module: string;
  columnCount: number;
  groupBy?: string;
};

type EntityTemplate = {
  id: string;
  label: string;
  description: string;
  columns: { key: string; label: string; required?: boolean; hint?: string }[];
  sampleRow: Record<string, string | number>;
  groupBy?: string;
};

type ImportResult = {
  entity: string;
  dryRun: boolean;
  total: number;
  succeeded: number;
  failed: number;
  rows: { row: number; success: boolean; message: string; recordId?: string }[];
};

export default function BulkImportPage() {
  const [entities, setEntities] = useState<EntityOption[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [template, setTemplate] = useState<EntityTemplate | null>(null);
  const [parsedRows, setParsedRows] = useState<Record<string, unknown>[]>([]);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  useEffect(() => {
    fetch("/api/import")
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data.length > 0) {
          setEntities(res.data);
          setSelectedId(res.data[0].id);
        }
      });
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    fetch(`/api/import?entity=${selectedId}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setTemplate(res.data);
          setParsedRows([]);
          setFileName("");
          setResult(null);
        }
      });
  }, [selectedId]);

  const handleFile = async (file: File) => {
    const buffer = await file.arrayBuffer();
    const rows = parseSpreadsheetBuffer(buffer);
    setParsedRows(rows);
    setFileName(file.name);
    setResult(null);
  };

  const downloadTemplate = (format: "csv" | "excel") => {
    if (!template) return;
    const headers = template.columns.map((c) => c.key);
    const dataRow = headers.map((h) => template.sampleRow[h] ?? "");
    if (format === "excel") exportToExcel(`${template.id}-template`, headers, [dataRow]);
    else exportToCSV(`${template.id}-template`, headers, [dataRow]);
  };

  const runImport = async (dryRun: boolean) => {
    if (!selectedId || parsedRows.length === 0) return;
    setLoading(true);
    const res = await fetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entity: selectedId, rows: parsedRows, dryRun }),
    }).then((r) => r.json());
    setLoading(false);
    if (res.success) setResult(res.data);
    else alert(res.message || "Import failed");
  };

  const previewColumns = template
    ? template.columns.slice(0, 6).map((c) => ({ key: c.key, header: c.label }))
    : [];

  const selectedEntity = entities.find((e) => e.id === selectedId);

  return (
    <div>
      <PageHeader
        title="Bulk Import"
        description="Upload CSV or Excel files to add records across all modules"
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle>1. Select Module</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
              {entities.map((e) => (
                <option key={e.id} value={e.id}>{e.label}</option>
              ))}
            </Select>
            {selectedEntity && (
              <p className="text-sm text-gray-600">{selectedEntity.description}</p>
            )}
            {template?.groupBy && (
              <p className="rounded bg-amber-50 p-2 text-xs text-amber-800">
                Rows are grouped by <strong>{template.groupBy}</strong> — multiple lines with the same value create one document.
              </p>
            )}
            {template && (
              <div>
                <p className="mb-2 text-sm font-medium text-green-900">Columns</p>
                <ul className="max-h-48 space-y-1 overflow-y-auto text-xs text-gray-600">
                  {template.columns.map((c) => (
                    <li key={c.key}>
                      <span className="font-mono">{c.key}</span>
                      {c.required && " *"}
                      {c.hint && <span className="text-gray-400"> — {c.hint}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>2. Upload File</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => downloadTemplate("csv")}>Download CSV Template</Button>
              <Button variant="outline" onClick={() => downloadTemplate("excel")}>Download Excel Template</Button>
            </div>
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-green-200 bg-green-50/50 p-8 hover:border-green-400">
              <span className="text-sm font-medium text-green-900">Drop CSV or Excel file here</span>
              <span className="mt-1 text-xs text-gray-500">.csv, .xlsx, .xls — max 500 rows</span>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />
            </label>
            {fileName && (
              <p className="text-sm text-gray-600">
                Loaded <strong>{fileName}</strong> — {parsedRows.length} row(s)
              </p>
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={!parsedRows.length || loading}
                onClick={() => runImport(true)}
              >
                {loading ? "Processing..." : "Validate (Dry Run)"}
              </Button>
              <Button
                disabled={!parsedRows.length || loading}
                onClick={() => runImport(false)}
              >
                {loading ? "Importing..." : "Import All"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {parsedRows.length > 0 && template && (
        <Card className="mt-6">
          <CardHeader><CardTitle>Preview ({parsedRows.length} rows)</CardTitle></CardHeader>
          <CardContent>
            <DataTable
              columns={previewColumns}
              data={parsedRows.slice(0, 20).map((row, i) => ({ ...row, _row: i + 2 }))}
            />
            {parsedRows.length > 20 && (
              <p className="mt-2 text-xs text-gray-500">Showing first 20 of {parsedRows.length} rows</p>
            )}
          </CardContent>
        </Card>
      )}

      {result && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>
              {result.dryRun ? "Validation Results" : "Import Results"} — {result.succeeded}/{result.total} succeeded
            </CardTitle>
          </CardHeader>
          <CardContent>
            {result.failed > 0 && (
              <p className="mb-3 text-sm text-red-600">{result.failed} row(s) failed</p>
            )}
            <DataTable
              columns={[
                { key: "row", header: "Row #" },
                {
                  key: "success",
                  header: "Status",
                  render: (i) => (
                    <span className={i.success ? "text-green-700" : "text-red-600"}>
                      {i.success ? "OK" : "Failed"}
                    </span>
                  ),
                },
                { key: "message", header: "Message" },
              ]}
              data={result.rows}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
