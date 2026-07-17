"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

export default function NotificationsPage() {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);

  const load = () => {
    fetch("/api/notifications").then((r) => r.json()).then((res) => {
      if (res.success) setItems(res.data || []);
    });
  };

  useEffect(() => { load(); }, []);

  const markAllRead = async () => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark-all-read" }),
    });
    load();
  };

  return (
    <div>
      <PageHeader title="Notifications" description="System alerts and updates" actions={
        <Button variant="outline" onClick={markAllRead}>Mark all read</Button>
      } />
      <div className="space-y-2">
        {items.length === 0 && <p className="text-gray-500">No notifications</p>}
        {items.map((n) => (
          <Card key={String(n.id)} className={n.isRead ? "opacity-60" : "border-green-200"}>
            <CardContent className="flex items-start justify-between p-4">
              <div>
                <p className="font-medium text-green-900">{String(n.title)}</p>
                <p className="text-sm text-gray-600">{String(n.message)}</p>
                <p className="mt-1 text-xs text-gray-400">{formatDate(String(n.createdAt))}</p>
              </div>
              {n.link ? <Link href={String(n.link)} className="text-sm text-green-700 hover:underline">View</Link> : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
