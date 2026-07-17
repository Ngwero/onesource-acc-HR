/**
 * Uganda payroll helpers (simplified statutory).
 * NSSF: 5% employee + 10% employer on gross.
 * PAYE: progressive monthly bands (URA-style simplification).
 */

export type PayrollBreakdown = {
  basicPay: number;
  allowances: number;
  grossPay: number;
  paye: number;
  nssfEmployee: number;
  nssfEmployer: number;
  otherDeductions: number;
  deductions: number;
  netPay: number;
};

function roundMoney(n: number) {
  return Math.round(n * 100) / 100;
}

/** Monthly PAYE on taxable income after NSSF employee contribution */
export function computeUgandaPaye(taxableIncome: number): number {
  const income = Math.max(0, taxableIncome);
  const bands: Array<{ upTo: number; rate: number }> = [
    { upTo: 235_000, rate: 0 },
    { upTo: 335_000, rate: 0.1 },
    { upTo: 410_000, rate: 0.2 },
    { upTo: 10_000_000, rate: 0.3 },
    { upTo: Number.POSITIVE_INFINITY, rate: 0.4 },
  ];

  let tax = 0;
  let prev = 0;
  for (const band of bands) {
    if (income <= prev) break;
    const slice = Math.min(income, band.upTo) - prev;
    tax += slice * band.rate;
    prev = band.upTo;
  }
  return roundMoney(tax);
}

export function computeUgandaPayroll(
  basicSalary: number,
  allowances = 0,
  otherDeductions = 0
): PayrollBreakdown {
  const basicPay = roundMoney(Math.max(0, basicSalary));
  const allow = roundMoney(Math.max(0, allowances));
  const grossPay = roundMoney(basicPay + allow);
  const nssfEmployee = roundMoney(grossPay * 0.05);
  const nssfEmployer = roundMoney(grossPay * 0.1);
  const taxable = Math.max(0, grossPay - nssfEmployee);
  const paye = computeUgandaPaye(taxable);
  const other = roundMoney(Math.max(0, otherDeductions));
  const deductions = roundMoney(nssfEmployee + paye + other);
  const netPay = roundMoney(grossPay - deductions);

  return {
    basicPay,
    allowances: allow,
    grossPay,
    paye,
    nssfEmployee,
    nssfEmployer,
    otherDeductions: other,
    deductions,
    netPay,
  };
}

/** Inclusive calendar days between two dates (local midnight). */
export function countLeaveDays(start: Date, end: Date): number {
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const e = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const ms = e.getTime() - s.getTime();
  return Math.max(1, Math.floor(ms / (1000 * 60 * 60 * 24)) + 1);
}

export function todayDateOnly(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}
