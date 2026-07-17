"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, StatusBadge, formatCurrency } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/ui/page-loader";

interface ModuleListPageProps {
  title: string;
  description: string;
  apiEndpoint: string;
  queryParams?: Record<string, string>;
  columns: Array<{
    key: string;
    header: string;
    render?: (item: Record<string, unknown>) => React.ReactNode;
  }>;
  searchPlaceholder?: string;
}

export function ModuleListPage({
  title,
  description,
  apiEndpoint,
  queryParams = {},
  columns,
  searchPlaceholder = "Search...",
}: ModuleListPageProps) {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const [path, existingQuery] = apiEndpoint.split("?");
    const params = new URLSearchParams(existingQuery || "");
    Object.entries(queryParams).forEach(([key, value]) => params.set(key, value));
    if (search) params.set("search", search);
    else params.delete("search");
    const qs = params.toString();
    const url = qs ? `${path}?${qs}` : path;
    fetch(url)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setItems(res.data.items || res.data.batches?.items || res.data || []);
        }
      })
      .finally(() => setLoading(false));
  }, [apiEndpoint, JSON.stringify(queryParams), search]);

  return (
    <div>
      <PageHeader title={title} description={description} />
      <div className="mb-4 flex gap-2">
        <Input
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Button variant="outline" onClick={() => setSearch("")}>
          Clear
        </Button>
      </div>
      {loading ? (
        <PageLoader compact label="Loading…" />
      ) : (
        <DataTable columns={columns} data={items} />
      )}
    </div>
  );
}

export { StatusBadge, formatCurrency };
