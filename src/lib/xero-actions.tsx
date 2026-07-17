"use client";

export async function xeroPatch(body: Record<string, unknown>) {
  const res = await fetch("/api/xero", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function xeroDelete(module: string, id: string) {
  const res = await fetch("/api/xero", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ module, id }),
  });
  return res.json();
}

export function ModuleActions({ module, id, onDone, label = "Delete" }: { module: string; id: string; onDone: () => void; label?: string }) {
  const handleDelete = async () => {
    if (!confirm(`Delete this ${module.replace(/-/g, " ")}?`)) return;
    const res = await xeroDelete(module, id);
    if (res.success) onDone();
    else alert(res.message);
  };
  return (
    <button type="button" onClick={handleDelete} className="text-xs text-red-600 hover:underline">
      {label}
    </button>
  );
}
