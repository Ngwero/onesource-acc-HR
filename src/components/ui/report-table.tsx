"use client";

import { formatCurrency } from "@/lib/utils";

interface ReportTableProps {
  data: Record<string, unknown>[];
  title?: string;
}

function formatCell(key: string, value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "number") {
    if (["amount", "balance", "total", "value", "unitCost", "budgetAmount", "actualAmount", "variance", "revenue", "costOfGoodsSold", "grossProfit", "expenses", "netProfit"].some((k) => key.toLowerCase().includes(k.toLowerCase()))) {
      return formatCurrency(value);
    }
    if (key === "variancePct") return `${value.toFixed(1)}%`;
    return String(value);
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function ReportTable({ data, title }: ReportTableProps) {
  if (!data.length) return <p className="text-sm text-gray-500">No data available</p>;

  const headers = Object.keys(data[0]).filter((k) => !k.startsWith("_"));

  return (
    <div className="overflow-x-auto">
      {title && <p className="mb-2 text-sm font-medium text-gray-700">{title}</p>}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-green-50 text-left">
            {headers.map((h) => (
              <th key={h} className="px-3 py-2 font-medium capitalize text-green-900">
                {h.replace(/([A-Z])/g, " $1").trim()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className="border-b hover:bg-gray-50">
              {headers.map((h) => (
                <td key={h} className="px-3 py-2 text-gray-700">
                  {formatCell(h, row[h])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ReportObjectView({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data).filter(([k]) => k !== "message");
  return (
    <div className="space-y-2 text-sm">
      {entries.map(([k, v]) => (
        <div key={k} className="flex justify-between border-b py-1">
          <span className="capitalize text-gray-600">{k.replace(/([A-Z])/g, " $1").trim()}</span>
          <span className="font-medium">{formatCell(k, v)}</span>
        </div>
      ))}
    </div>
  );
}
