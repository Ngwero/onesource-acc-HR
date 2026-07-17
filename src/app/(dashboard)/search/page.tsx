"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

type SearchResult = { type: string; id: string; label: string; href: string };

export default function SearchPage() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return; }
    setLoading(true);
    fetch(`/api/search?q=${encodeURIComponent(query.trim())}`)
      .then((r) => r.json())
      .then((res) => { if (res.success) setResults(res.data.results || []); })
      .finally(() => setLoading(false));
  }, [query]);

  return (
    <div>
      <PageHeader title="Search" description="Find suppliers, customers, produce, purchases, and sales" />
      <Input
        placeholder="Search..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mb-6 max-w-lg"
        autoFocus
      />
      {loading && <p className="text-gray-500">Searching...</p>}
      {!loading && query.length >= 2 && results.length === 0 && (
        <p className="text-gray-500">No results for &quot;{query}&quot;</p>
      )}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {results.map((r) => (
          <Link key={`${r.type}-${r.id}`} href={r.href}>
            <Card className="transition hover:border-green-300">
              <CardContent className="p-4">
                <p className="text-xs uppercase text-gray-400">{r.type}</p>
                <p className="font-medium text-green-900">{r.label}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
