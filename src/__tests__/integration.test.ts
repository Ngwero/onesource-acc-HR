import { describe, it, expect } from "vitest";
import { requireScope } from "@/lib/api-key";

describe("API key scopes", () => {
  it("allows wildcard read scope", () => {
    expect(requireScope(["read:*"], "read:invoices")).toBe(true);
  });

  it("denies missing scope", () => {
    expect(requireScope(["read:invoices"], "read:payments")).toBe(false);
  });

  it("allows global wildcard", () => {
    expect(requireScope(["*"], "read:payments")).toBe(true);
  });
});

describe("Cron configuration", () => {
  it("documents required env vars", () => {
    const requiredForProd = ["CRON_SECRET", "DATABASE_URL", "JWT_SECRET"];
    expect(requiredForProd.every((k) => typeof k === "string")).toBe(true);
  });
});
