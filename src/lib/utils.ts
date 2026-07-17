import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | string, currency = "UGX") {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat("en-UG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

export function formatNumber(num: number | string, decimals = 2) {
  const n = typeof num === "string" ? parseFloat(num) : num;
  return new Intl.NumberFormat("en-UG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(n);
}

export async function generateDocumentNumber(
  prefix: string,
  prisma: { documentSequence: { upsert: Function; findUnique: Function } }
): Promise<string> {
  const year = new Date().getFullYear();
  const seq = await prisma.documentSequence.upsert({
    where: { prefix_year: { prefix, year } },
    create: { prefix, year, lastNumber: 1 },
    update: { lastNumber: { increment: 1 } },
  });
  const num = String(seq.lastNumber).padStart(5, "0");
  return `${prefix}-${year}-${num}`;
}

export function decimalToNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  return Number(value);
}
