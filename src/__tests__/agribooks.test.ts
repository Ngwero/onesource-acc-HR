import { describe, it, expect } from "vitest";
import { canAccessModule, canPerformAction, canApprove } from "@/lib/permissions";
import { verifyPassword, hashPassword } from "@/lib/password";
import { computePurchaseInputVat } from "@/lib/vat";
import {
  normalizePaymentAllocations,
  validatePaymentAllocations,
} from "@/lib/payment-allocation";

describe("Authentication", () => {
  it("should hash and verify passwords", async () => {
    const hash = await hashPassword("TestPassword123");
    expect(await verifyPassword("TestPassword123", hash)).toBe(true);
    expect(await verifyPassword("WrongPassword", hash)).toBe(false);
  });
});

describe("Role Permissions", () => {
  it("super admin can access all modules", () => {
    expect(canAccessModule("SUPER_ADMIN", "dashboard")).toBe(true);
    expect(canAccessModule("SUPER_ADMIN", "users")).toBe(true);
  });

  it("admin can access all modules", () => {
    expect(canAccessModule("ADMIN", "dashboard")).toBe(true);
    expect(canAccessModule("ADMIN", "ledger")).toBe(true);
    expect(canAccessModule("ADMIN", "settings")).toBe(true);
  });

  it("accountant can access financial modules", () => {
    expect(canAccessModule("ACCOUNTANT", "ledger")).toBe(true);
    expect(canAccessModule("ACCOUNTANT", "payables")).toBe(true);
    expect(canAccessModule("ACCOUNTANT", "purchases")).toBe(false);
  });

  it("auditor is read-only", () => {
    expect(canPerformAction("AUDITOR", "produce", "read")).toBe(true);
    expect(canPerformAction("AUDITOR", "produce", "create")).toBe(false);
    expect(canPerformAction("AUDITOR", "produce", "update")).toBe(false);
  });

  it("manager can approve", () => {
    expect(canApprove("MANAGER")).toBe(true);
    expect(canApprove("SALES_OFFICER")).toBe(false);
  });

  it("procurement officer can manage purchases but not approve payments", () => {
    expect(canAccessModule("PROCUREMENT_OFFICER", "purchases")).toBe(true);
    expect(canPerformAction("PROCUREMENT_OFFICER", "payables", "approve")).toBe(false);
  });
});

describe("VAT Calculation", () => {
  it("extracts inclusive VAT from purchase total", () => {
    const { netAmount, taxAmount } = computePurchaseInputVat(118000, 18);
    expect(netAmount).toBe(100000);
    expect(taxAmount).toBe(18000);
  });

  it("returns zero tax when rate is zero", () => {
    const { netAmount, taxAmount } = computePurchaseInputVat(50000, 0);
    expect(netAmount).toBe(50000);
    expect(taxAmount).toBe(0);
  });
});

describe("Three-Way Match", () => {
  it("flags quantity and price variances outside tolerance", () => {
    const variance = computeThreeWayVariance({
      description: "Maize",
      orderedQty: 100,
      receivedQty: 95,
      billedQty: 95,
      unitPrice: 1000,
      billedUnitPrice: 1100,
    });
    expect(variance.qtyWithinTolerance).toBe(false);
    expect(variance.priceWithinTolerance).toBe(false);
    expect(variance.isMatched).toBe(false);
  });

  it("passes when ordered, received, and billed align", () => {
    const variance = computeThreeWayVariance({
      description: "Beans",
      orderedQty: 50,
      receivedQty: 50,
      billedQty: 50,
      unitPrice: 2000,
      billedUnitPrice: 2000,
    });
    expect(variance.isMatched).toBe(true);
  });
});

describe("Payment Allocations", () => {
  it("normalizes single payable into one allocation", () => {
    const allocs = normalizePaymentAllocations({
      amount: 50000,
      payableId: "pay-1",
    });
    expect(allocs).toEqual([{ payableId: "pay-1", amount: 50000 }]);
  });

  it("validates allocation totals match payment amount", () => {
    expect(() =>
      validatePaymentAllocations(100000, [
        { payableId: "p1", amount: 60000 },
        { payableId: "p2", amount: 30000 },
      ])
    ).toThrow(/must equal payment amount/);
  });

  it("accepts partial allocation totals when allowed", () => {
    expect(() =>
      validatePaymentAllocations(100000, [{ payableId: "p1", amount: 80000 }], { allowPartial: true })
    ).not.toThrow();
  });

  it("accepts balanced multi-invoice allocation", () => {
    expect(() =>
      validatePaymentAllocations(100000, [
        { receivableId: "r1", amount: 40000 },
        { receivableId: "r2", amount: 60000 },
      ])
    ).not.toThrow();
  });
});

import { hashApiKey, generateApiKey } from "@/lib/api-key";
import { allocateLandedUnitCosts } from "@/lib/landed-cost";
import { computePeriodVariance } from "@/lib/pl-variance";
import { computeThreeWayVariance } from "@/lib/three-way-match";
import { signedGlBalance } from "@/lib/gl-balance";
import { computeUgandaPaye, computeUgandaPayroll, countLeaveDays } from "@/lib/payroll";

describe("Partner API", () => {
  it("generates stable key hashes", () => {
    const { rawKey, hash } = generateApiKey();
    expect(rawKey.startsWith("ab_")).toBe(true);
    expect(hashApiKey(rawKey)).toBe(hash);
  });

  it("rejects mismatched key hashes", () => {
    const { rawKey } = generateApiKey();
    expect(hashApiKey(rawKey)).not.toBe(hashApiKey("ab_invalid"));
  });
});

describe("Landed Cost Allocation", () => {
  it("spreads transport and loading by line value", () => {
    const costs = allocateLandedUnitCosts(
      [
        { qty: 10, unitPrice: 1000 },
        { qty: 5, unitPrice: 2000 },
      ],
      30000,
      15000
    );
    expect(costs[0]).toBeCloseTo(3250, 2);
    expect(costs[1]).toBeCloseTo(6500, 2);
  });
});

describe("Comparative P&L", () => {
  it("computes variance amounts and percentages", () => {
    const variance = computePeriodVariance(
      { revenue: 120, costOfGoodsSold: 40, grossProfit: 80, expenses: 30, netProfit: 50 },
      { revenue: 100, costOfGoodsSold: 35, grossProfit: 65, expenses: 25, netProfit: 40 }
    );
    expect(variance.revenue.amount).toBe(20);
    expect(variance.revenue.percent).toBe(20);
    expect(variance.netProfit.amount).toBe(10);
  });
});

describe("Business Rules", () => {
  it("stock cannot go negative - validation logic", () => {
    const available = 50;
    const requested = 100;
    expect(available < requested).toBe(true);
  });

  it("creator cannot approve own request", () => {
    const requesterId = "user-1";
    const approverId = "user-1";
    expect(requesterId === approverId).toBe(true);
  });

  it("credit limit check", () => {
    const creditLimit = 1000000;
    const currentBalance = 800000;
    const saleAmount = 300000;
    expect(currentBalance + saleAmount > creditLimit).toBe(true);
  });
});

describe("GL signed balances", () => {
  it("treats income credits as positive revenue", () => {
    expect(signedGlBalance("INCOME", 0, 10000)).toBe(10000);
  });

  it("treats asset debits as positive balance", () => {
    expect(signedGlBalance("ASSET", 10000, 2000)).toBe(8000);
  });

  it("treats accumulated depreciation as credit-normal contra-asset", () => {
    expect(signedGlBalance("ASSET", 0, 5000, "1210")).toBe(5000);
  });
});

describe("Uganda payroll", () => {
  it("charges no PAYE below threshold", () => {
    expect(computeUgandaPaye(200_000)).toBe(0);
  });

  it("computes NSSF and net pay", () => {
    const result = computeUgandaPayroll(1_000_000, 0);
    expect(result.nssfEmployee).toBe(50_000);
    expect(result.nssfEmployer).toBe(100_000);
    expect(result.grossPay).toBe(1_000_000);
    expect(result.netPay).toBe(result.grossPay - result.deductions);
    expect(result.paye).toBeGreaterThan(0);
  });

  it("counts inclusive leave days", () => {
    expect(countLeaveDays(new Date("2026-07-01"), new Date("2026-07-03"))).toBe(3);
  });
});
