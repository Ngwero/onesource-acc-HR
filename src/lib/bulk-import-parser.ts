import * as XLSX from "xlsx";

export function parseSpreadsheetBuffer(buffer: ArrayBuffer): Record<string, unknown>[] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];

  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  return raw.map(normalizeRow);
}

export function normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const cleanKey = key.trim().replace(/\s+/g, "");
    const camelKey = cleanKey.charAt(0).toLowerCase() + cleanKey.slice(1);
    normalized[camelKey] = normalizeValue(value);
  }
  return normalized;
}

function normalizeValue(value: unknown): unknown {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "number") return value;
  const str = String(value).trim();
  if (str === "") return "";
  const num = Number(str.replace(/,/g, ""));
  if (!Number.isNaN(num) && /^-?\d+(\.\d+)?$/.test(str.replace(/,/g, ""))) return num;
  return str;
}

export function str(row: Record<string, unknown>, key: string): string {
  const val = row[key];
  return val === undefined || val === null ? "" : String(val).trim();
}

export function num(row: Record<string, unknown>, key: string): number {
  const val = row[key];
  if (typeof val === "number") return val;
  const parsed = Number(String(val).replace(/,/g, ""));
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function optNum(row: Record<string, unknown>, key: string): number | undefined {
  const val = row[key];
  if (val === "" || val === undefined || val === null) return undefined;
  return num(row, key);
}
