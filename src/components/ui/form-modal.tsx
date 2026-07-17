"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface FormModalProps {
  title: string;
  triggerLabel?: string;
  children: React.ReactNode | ((props: { close: () => void }) => React.ReactNode);
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function FormModal({
  title,
  triggerLabel = "Add New",
  children,
  open: controlledOpen,
  onOpenChange,
}: FormModalProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  if (!open) {
    // Controlled closed: don't render a stray trigger (pages use their own buttons)
    if (controlledOpen !== undefined) return null;
    return <Button onClick={() => setOpen(true)}>{triggerLabel}</Button>;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="max-h-[90vh] w-full max-w-lg overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">{title}</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>✕</Button>
        </CardHeader>
        <CardContent>
          {typeof children === "function" ? children({ close: () => setOpen(false) }) : children}
        </CardContent>
      </Card>
    </div>
  );
}

export function FormField({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="mb-1 block text-sm font-medium text-green-900">{label}</label>
      {children}
    </div>
  );
}

export function FormActions({
  onCancel,
  onSubmit,
  loading,
  submitLabel = "Save",
}: {
  onCancel: () => void;
  onSubmit?: () => void;
  loading?: boolean;
  submitLabel?: string;
}) {
  return (
    <div className="mt-4 flex gap-2">
      <Button
        type={onSubmit ? "button" : "submit"}
        disabled={loading}
        onClick={onSubmit}
      >
        {loading ? "Saving..." : submitLabel}
      </Button>
      <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
    </div>
  );
}

export async function apiPost(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

export function useLookup(endpoint: string) {
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = () => {
    if (loaded) return;
    fetch(endpoint)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setData(res.data.items || res.data || []);
        setLoaded(true);
      });
  };

  return { data, load, setData, reload: () => setLoaded(false) };
}
