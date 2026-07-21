import { formatCurrency } from "@/lib/utils";

export type CreditLimitStatus = {
  balance: number;
  creditLimit: number;
  remaining: number;
  projectedBalance: number;
  utilizationPct: number;
  /** True when creditLimit > 0 and balance is at/over limit */
  isOverLimit: boolean;
  /** True when creditLimit > 0 and utilization >= 80% */
  isNearLimit: boolean;
  /** True when non-cash sale would push balance over limit */
  wouldExceed: boolean;
  label: string;
  tone: "ok" | "warn" | "danger";
};

export function evaluateCreditLimit(input: {
  balance: number;
  creditLimit: number;
  additionalAmount?: number;
}): CreditLimitStatus {
  const balance = Number(input.balance) || 0;
  const creditLimit = Number(input.creditLimit) || 0;
  const additionalAmount = Math.max(0, Number(input.additionalAmount) || 0);
  const projectedBalance = balance + additionalAmount;
  const remaining = creditLimit - balance;
  const utilizationPct =
    creditLimit > 0 ? Math.min(999, Math.round((balance / creditLimit) * 100)) : 0;

  const isOverLimit = creditLimit > 0 && balance >= creditLimit;
  const isNearLimit = creditLimit > 0 && !isOverLimit && utilizationPct >= 80;
  const wouldExceed =
    additionalAmount > 0 &&
    (creditLimit <= 0 ? additionalAmount > 0 : projectedBalance > creditLimit);

  let tone: CreditLimitStatus["tone"] = "ok";
  let label = creditLimit > 0 ? "Within credit limit" : "No credit limit set";

  if (creditLimit <= 0 && additionalAmount > 0) {
    tone = "warn";
    label = "No credit limit set — credit sales need manager review";
  } else if (wouldExceed || isOverLimit) {
    tone = "danger";
    label = isOverLimit
      ? `Over credit limit by ${formatCurrency(balance - creditLimit)}`
      : `This sale would exceed credit limit by ${formatCurrency(projectedBalance - creditLimit)}`;
  } else if (isNearLimit) {
    tone = "warn";
    label = `Near credit limit (${utilizationPct}% used) — ${formatCurrency(remaining)} remaining`;
  } else if (creditLimit > 0) {
    label = `${formatCurrency(remaining)} credit remaining (${utilizationPct}% used)`;
  }

  return {
    balance,
    creditLimit,
    remaining,
    projectedBalance,
    utilizationPct,
    isOverLimit,
    isNearLimit,
    wouldExceed,
    label,
    tone,
  };
}
