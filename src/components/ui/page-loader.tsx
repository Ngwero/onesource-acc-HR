"use client";

import { cn } from "@/lib/utils";

export function PageLoader({
  label = "Loading…",
  className,
  compact = false,
}: {
  label?: string;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "page-loader",
        compact ? "page-loader-compact" : "page-loader-full",
        className
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="page-loader-spinner" aria-hidden />
      <p className="page-loader-label">{label}</p>
    </div>
  );
}
