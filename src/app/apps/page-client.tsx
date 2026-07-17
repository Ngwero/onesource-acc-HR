"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Calculator, Users, ArrowRight, LogOut } from "lucide-react";
import { BrandLogo } from "@/components/layout/brand-logo";
import { LoginParticles } from "@/components/auth/login-particles";
import { firstNameOf } from "@/components/layout/user-context";
import { APP_SHORT_NAME } from "@/lib/branding";
import { queueAccountingTourIfNeeded, queueHrTourIfNeeded } from "@/lib/product-tour";
import type { Workspace } from "@/lib/workspace";

const SYSTEMS: {
  id: Workspace;
  title: string;
  description: string;
  icon: typeof Calculator;
}[] = [
  {
    id: "accounting",
    title: "Accounting",
    description: "Invoices, banking, ledger, reports, and day-to-day finance.",
    icon: Calculator,
  },
  {
    id: "hr",
    title: "Human Resources",
    description: "Employees, leave, attendance, and payroll.",
    icon: Users,
  },
];

export default function AppsPage({
  userName,
  userId,
}: {
  userName: string;
  userId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<Workspace | null>(null);
  const [error, setError] = useState("");
  const firstName = firstNameOf(userName);

  const select = async (workspace: Workspace) => {
    setError("");
    setLoading(workspace);
    try {
      const res = await fetch("/api/auth/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.message || "Could not open system");
        return;
      }
      if (workspace === "accounting") {
        queueAccountingTourIfNeeded(userId);
      } else if (workspace === "hr") {
        queueHrTourIfNeeded(userId);
      }
      router.push(data.data?.home || (workspace === "hr" ? "/hr" : "/dashboard"));
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="login-page relative flex min-h-screen flex-col overflow-hidden">
      <LoginParticles
        className="pointer-events-none absolute inset-0 z-0 opacity-60"
        density="soft"
      />

      <header className="relative z-[1] flex items-center justify-between px-6 py-5 sm:px-10">
        <BrandLogo size="md" className="[&_img]:h-10 [&_img]:w-auto" />
        <form action="/api/auth/logout" method="POST">
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[#5A6B5E] transition hover:bg-white/70 hover:text-[#0F1F12]"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </form>
      </header>

      <main className="relative z-[1] flex flex-1 flex-col items-center justify-center px-6 pb-16 pt-4">
        <p className="text-sm font-medium tracking-wide text-[#105820]">{APP_SHORT_NAME}</p>
        <h1 className="mt-2 max-w-lg text-center text-3xl font-semibold tracking-tight text-[#0F1F12] sm:text-4xl">
          {firstName ? `Welcome, ${firstName}` : "Choose a system"}
        </h1>
        <p className="mt-3 max-w-md text-center text-[15px] leading-relaxed text-[#5A6B5E]">
          Open Accounting or Human Resources. You can switch anytime from the sidebar.
        </p>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
        )}

        <div className="mt-10 grid w-full max-w-3xl gap-4 sm:grid-cols-2 sm:gap-6">
          {SYSTEMS.map((system) => {
            const Icon = system.icon;
            const busy = loading === system.id;
            return (
              <button
                key={system.id}
                type="button"
                disabled={!!loading}
                onClick={() => select(system.id)}
                className="group flex flex-col items-start rounded-2xl border border-[#105820]/14 bg-white/90 p-6 text-left shadow-[0_8px_30px_rgba(16,88,32,0.08)] backdrop-blur-sm transition hover:border-[#78B028]/60 hover:shadow-[0_12px_40px_rgba(16,88,32,0.12)] disabled:opacity-60"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#105820] text-white transition group-hover:bg-[#78B028]">
                  <Icon className="h-6 w-6" strokeWidth={1.75} />
                </span>
                <span className="mt-5 text-xl font-semibold text-[#0F1F12]">{system.title}</span>
                <span className="mt-2 text-sm leading-relaxed text-[#5A6B5E]">
                  {system.description}
                </span>
                <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-[#105820] group-hover:text-[#68A020]">
                  {busy ? "Opening…" : "Open"}
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </span>
              </button>
            );
          })}
        </div>
      </main>
    </div>
  );
}
