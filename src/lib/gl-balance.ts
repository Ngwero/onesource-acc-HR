import type { AccountType } from "@/generated/prisma/client";

/** Accumulated depreciation (1210) is contra-asset / credit-normal */
export function isDebitNormalAccount(type: AccountType, code?: string): boolean {
  if (code === "1210") return false;
  return type === "ASSET" || type === "EXPENSE" || type === "COGS";
}

/** Trial-balance signed balance from raw debit/credit activity */
export function signedGlBalance(
  type: AccountType,
  debits: number,
  credits: number,
  code?: string
): number {
  return isDebitNormalAccount(type, code) ? debits - credits : credits - debits;
}
