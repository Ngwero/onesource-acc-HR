"use client";

import { cn, formatCurrency } from "@/lib/utils";
import { evaluateCreditLimit, type CreditLimitStatus } from "@/lib/credit-limit";

export function CreditLimitAlert({
  balance,
  creditLimit,
  additionalAmount = 0,
  className,
  compact = false,
}: {
  balance: number;
  creditLimit: number;
  additionalAmount?: number;
  className?: string;
  compact?: boolean;
}) {
  const status = evaluateCreditLimit({ balance, creditLimit, additionalAmount });
  return <CreditLimitAlertView status={status} additionalAmount={additionalAmount} className={className} compact={compact} />;
}

export function CreditLimitAlertView({
  status,
  additionalAmount = 0,
  className,
  compact = false,
}: {
  status: CreditLimitStatus;
  additionalAmount?: number;
  className?: string;
  compact?: boolean;
}) {
  const tones = {
    ok: "border-[#d5e8c8] bg-[#F3F8F0] text-[#105820]",
    warn: "border-amber-200 bg-amber-50 text-amber-900",
    danger: "border-red-200 bg-red-50 text-red-800",
  };

  return (
    <div
      className={cn("rounded-xl border px-3 py-2.5 text-sm", tones[status.tone], className)}
      role="status"
    >
      <p className="font-semibold">{status.label}</p>
      {!compact && (
        <p className="mt-1 text-xs opacity-80">
          Balance {formatCurrency(status.balance)}
          {status.creditLimit > 0
            ? ` · Limit ${formatCurrency(status.creditLimit)} · ${status.utilizationPct}% used`
            : " · Limit not set"}
          {additionalAmount > 0
            ? ` · After this sale ${formatCurrency(status.projectedBalance)}`
            : ""}
        </p>
      )}
    </div>
  );
}
