"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { exportToCSV, exportToExcel } from "@/lib/export";
import { parseSpreadsheetBuffer } from "@/lib/bulk-import-parser";

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

interface BulkImportPanelProps {
  entityId: string;
  onComplete?: () => void;
}

export function BulkImportPanel({ entityId, onComplete }: BulkImportPanelProps) {
  const [template, setTemplate] = useState<EntityTemplate | null>(null);
  const [parsedRows, setParsedRows] = useState<Record<string, unknown>[]>([]);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  useEffect(() => {
    fetch(`/api/import?entity=${entityId}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setTemplate(res.data);
          setParsedRows([]);
          setFileName("");
          setResult(null);
        }
      });
  }, [entityId]);

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
    if (!parsedRows.length) return;
    setLoading(true);
    const res = await fetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entity: entityId, rows: parsedRows, dryRun }),
    }).then((r) => r.json());
    setLoading(false);
    if (res.success) {
      setResult(res.data);
      if (!dryRun && res.data.succeeded > 0) onComplete?.();
    } else {
      alert(res.message || "Import failed");
    }
  };

  const previewColumns = template
    ? template.columns.slice(0, 6).map((c) => ({ key: c.key, header: c.label }))
    : [];

  return (
    <div className="space-y-4">
      {template && (
        <p className="text-sm text-gray-600">{template.description}</p>
      )}

      {template && (
        <div>
          <p className="mb-2 text-sm font-medium text-green-900">Required columns</p>
          <div className="flex flex-wrap gap-1">
            {template.columns.map((c) => (
              <span key={c.key} className="rounded bg-green-50 px-2 py-0.5 text-xs text-green-800">
                {c.key}{c.required && "*"}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => downloadTemplate("csv")}>
          Download CSV Template
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => downloadTemplate("excel")}>
          Download Excel Template
        </Button>
      </div>

      <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-green-200 bg-green-50/50 p-6 hover:border-green-400">
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
          type="button"
          variant="outline"
          disabled={!parsedRows.length || loading}
          onClick={() => runImport(true)}
        >
          {loading ? "Processing..." : "Validate"}
        </Button>
        <Button type="button" disabled={!parsedRows.length || loading} onClick={() => runImport(false)}>
          {loading ? "Importing..." : "Import All"}
        </Button>
      </div>

      {parsedRows.length > 0 && template && (
        <div>
          <p className="mb-2 text-sm font-medium text-green-900">Preview (first 10 rows)</p>
          <DataTable columns={previewColumns} data={parsedRows.slice(0, 10)} />
        </div>
      )}

      {result && (
        <div>
          <p className={`mb-2 text-sm font-medium ${result.failed ? "text-red-600" : "text-green-700"}`}>
            {result.dryRun ? "Validation" : "Import"}: {result.succeeded}/{result.total} succeeded
            {result.failed > 0 && `, ${result.failed} failed`}
          </p>
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
            data={result.rows.filter((r) => !r.success).length > 0 ? result.rows.filter((r) => !r.success) : result.rows.slice(0, 10)}
          />
        </div>
      )}
    </div>
  );
}
