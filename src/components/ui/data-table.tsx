"use client";

import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { Badge } from "./badge";
import { PageLoader } from "./page-loader";

interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyField?: string;
  emptyMessage?: string;
  onRowClick?: (item: T) => void;
  loading?: boolean;
  loadingLabel?: string;
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  keyField = "id",
  emptyMessage = "No records found",
  onRowClick,
  loading = false,
  loadingLabel = "Loading data…",
}: DataTableProps<T>) {
  const getRowKey = (item: T, index: number) => {
    const primary = item[keyField];
    if (primary !== undefined && primary !== null && primary !== "") {
      return String(primary);
    }
    for (const fallback of ["row", "code", "_row"]) {
      const value = item[fallback];
      if (value !== undefined && value !== null && value !== "") {
        return String(value);
      }
    }
    return `row-${index}`;
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-green-100 bg-white">
        <PageLoader compact label={loadingLabel} />
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-green-100">
      <table className="w-full text-sm">
        <thead className="bg-green-50 text-left">
          <tr>
            {columns.map((col) => (
              <th key={col.key} className={cn("px-4 py-3 font-medium text-green-900", col.className)}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-500">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((item, index) => (
              <tr
                key={getRowKey(item, index)}
                className={cn(
                  "border-t border-green-50 hover:bg-green-50/50",
                  onRowClick && "cursor-pointer"
                )}
                onClick={() => onRowClick?.(item)}
              >
                {columns.map((col) => (
                  <td key={col.key} className={cn("px-4 py-3", col.className)}>
                    {col.render
                      ? col.render(item)
                      : String(item[col.key] ?? "-")}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, "default" | "success" | "warning" | "danger" | "secondary"> = {
    ACTIVE: "success",
    PAID: "success",
    CONFIRMED: "success",
    APPROVED: "success",
    POSTED: "success",
    DELIVERED: "success",
    DRAFT: "secondary",
    PENDING: "warning",
    UNPAID: "warning",
    PARTIALLY_PAID: "warning",
    IN_TRANSIT: "warning",
    INACTIVE: "secondary",
    CANCELLED: "danger",
    REJECTED: "danger",
    OVERDUE: "danger",
  };
  return <Badge variant={map[status] || "default"}>{status.replace(/_/g, " ")}</Badge>;
}

export { formatCurrency, formatDate };
