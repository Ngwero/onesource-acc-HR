"use client";

import * as React from "react";
import { useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface FileUploadProps {
  module: string;
  recordId: string;
  onUploaded?: () => void;
}

export function FileUpload({ module, recordId, onUploaded }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("module", module);
    formData.append("recordId", recordId);

    const res = await fetch("/api/uploads", { method: "POST", body: formData });
    const data = await res.json();
    if (data.success) {
      onUploaded?.();
      if (inputRef.current) inputRef.current.value = "";
    } else {
      alert(data.message || "Upload failed");
    }
  };

  return <Input ref={inputRef} type="file" onChange={handleUpload} className="max-w-xs" />;
}

export function AttachmentList({ module, recordId }: { module: string; recordId: string }) {
  const [files, setFiles] = React.useState<Record<string, unknown>[]>([]);

  const load = React.useCallback(() => {
    fetch(`/api/uploads?module=${module}&recordId=${recordId}`)
      .then((r) => r.json())
      .then((res) => { if (res.success) setFiles(res.data); });
  }, [module, recordId]);

  React.useEffect(() => { load(); }, [load]);

  if (files.length === 0) return null;

  return (
    <ul className="mt-2 space-y-1 text-sm text-gray-600">
      {files.map((f) => (
        <li key={String(f.id)} className="flex items-center gap-2">
          <span>📎 {String(f.fileName)}</span>
          <a href={`/api/uploads/${f.id}`} target="_blank" rel="noreferrer">
            <Button size="sm" variant="outline" type="button">Download</Button>
          </a>
        </li>
      ))}
    </ul>
  );
}
