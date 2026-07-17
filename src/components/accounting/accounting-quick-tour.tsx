"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  Compass,
  Landmark,
  LayoutDashboard,
  Receipt,
  Sparkles,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppUserOptional } from "@/components/layout/user-context";
import {
  consumeAccountingTourStart,
  isAccountingTourCompleted,
  markAccountingTourCompleted,
  TOUR_SESSION,
} from "@/lib/product-tour";

const TOUR_START_EVENT = "onesource:accounting-tour-start";
const TOUR_SIDEBAR_OPEN_EVENT = "onesource:accounting-tour-sidebar-open";
const TOUR_TOOLS_OPEN_EVENT = "onesource:accounting-tour-tools-open";
const SPOTLIGHT_PAD = 8;
const TOUR_ATTR = "data-accounting-tour";
const AUTO_START_DELAY_MS = 900;

export type AccountingTourStep = {
  id: string;
  title: string;
  body: string;
  icon: LucideIcon;
  target: string;
  tips?: string[];
  openTools?: boolean;
};

export const ACCOUNTING_TOUR_STEPS: AccountingTourStep[] = [
  {
    id: "welcome",
    title: "Welcome to Accounting",
    body: "This sidebar is your finance command centre — daily operations up top, deeper tools in the Tools section below.",
    icon: Sparkles,
    target: "accounting-sidebar",
    tips: ["You chose Accounting after login. Switch system opens Human Resources."],
  },
  {
    id: "dashboard",
    title: "Dashboard",
    body: "Your home view: sales, expenses, profit, cash, payables, receivables, and trends at a glance.",
    icon: LayoutDashboard,
    target: "nav-dashboard",
  },
  {
    id: "customers",
    title: "Customers & suppliers",
    body: "Manage buyers and vendors. Customers link to invoices and sales; suppliers link to purchases and payables.",
    icon: Users,
    target: "nav-customers",
    tips: ["Suppliers is the next item in the Main menu."],
  },
  {
    id: "banking",
    title: "Banking",
    body: "Track bank accounts, import transactions, reconcile statements, and match payments to invoices.",
    icon: Landmark,
    target: "nav-bank",
  },
  {
    id: "invoices",
    title: "Invoices",
    body: "Create and send invoices, record payments, and keep receivables up to date.",
    icon: Receipt,
    target: "nav-invoices",
  },
  {
    id: "reports",
    title: "Reports",
    body: "Trial balance, P&L, balance sheet, VAT returns, and exportable financial statements.",
    icon: BarChart3,
    target: "nav-reports",
  },
  {
    id: "ledger",
    title: "Tools & ledger",
    body: "Open the Tools section for purchases, inventory, sales, expenses, payments, and settings. General ledger is your books of record.",
    icon: BookOpen,
    target: "nav-ledger",
    openTools: true,
    tips: [
      "Purchases, Payments, and Settings are all under Tools.",
      "Users & permissions sit under Users in the Main menu.",
    ],
  },
  {
    id: "finish",
    title: "Quick tour anytime",
    body: "You're ready. Reopen this guided tour from Quick tour in the sidebar whenever you need a refresher.",
    icon: Compass,
    target: "nav-tour",
  },
];

type SpotlightRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

function measureTarget(targetId: string): SpotlightRect | null {
  const el = document.querySelector(`[${TOUR_ATTR}="${targetId}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return {
    top: r.top - SPOTLIGHT_PAD,
    left: r.left - SPOTLIGHT_PAD,
    width: r.width + SPOTLIGHT_PAD * 2,
    height: r.height + SPOTLIGHT_PAD * 2,
  };
}

function spotlightClipPath(rect: SpotlightRect | null): string | undefined {
  if (!rect) return undefined;
  const W = window.innerWidth;
  const H = window.innerHeight;
  const { top, left, width, height } = rect;
  const x2 = left + width;
  const y2 = top + height;
  return `polygon(evenodd, 0 0, ${W}px 0, ${W}px ${H}px, 0 ${H}px, 0 0, ${left}px ${top}px, ${left}px ${y2}px, ${x2}px ${y2}px, ${x2}px ${top}px, ${left}px ${top}px)`;
}

function tooltipStyle(rect: SpotlightRect | null): React.CSSProperties {
  const margin = 16;
  const maxW = 360;
  if (!rect) {
    return {
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      width: maxW,
      maxWidth: `calc(100vw - ${margin * 2}px)`,
    };
  }

  const spaceRight = window.innerWidth - (rect.left + rect.width);
  const spaceBelow = window.innerHeight - (rect.top + rect.height);

  if (spaceRight >= maxW + margin) {
    return {
      top: Math.max(margin, rect.top),
      left: rect.left + rect.width + margin,
      width: maxW,
      maxWidth: spaceRight - margin,
    };
  }

  if (spaceBelow >= 220) {
    return {
      top: rect.top + rect.height + margin,
      left: Math.max(margin, Math.min(rect.left, window.innerWidth - maxW - margin)),
      width: maxW,
      maxWidth: `calc(100vw - ${margin * 2}px)`,
    };
  }

  return {
    top: Math.max(margin, rect.top - 240),
    left: Math.max(margin, Math.min(rect.left, window.innerWidth - maxW - margin)),
    width: maxW,
    maxWidth: `calc(100vw - ${margin * 2}px)`,
  };
}

export function requestAccountingTourStart() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(TOUR_START_EVENT));
  }
}

export function AccountingTourRoot() {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAppUserOptional();
  const userId = user?.id;
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [completed, setCompleted] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [rect, setRect] = useState<SpotlightRect | null>(null);

  const current = ACCOUNTING_TOUR_STEPS[step];

  const updateRect = useCallback(() => {
    setRect(measureTarget(current.target));
  }, [current.target]);

  const prepareStep = useCallback(() => {
    if (current.openTools) {
      window.dispatchEvent(new CustomEvent(TOUR_TOOLS_OPEN_EVENT));
    }
  }, [current.openTools]);

  useEffect(() => {
    if (!userId) return;
    setCompleted(isAccountingTourCompleted(userId));
    setHydrated(true);
  }, [userId]);

  const startTour = useCallback(() => {
    setStep(0);
    setOpen(true);
    if (window.innerWidth < 1024) {
      window.dispatchEvent(new CustomEvent(TOUR_SIDEBAR_OPEN_EVENT));
    }
    if (window.location.pathname !== "/dashboard") {
      router.push("/dashboard");
    }
  }, [router]);

  useEffect(() => {
    const onStart = () => startTour();
    window.addEventListener(TOUR_START_EVENT, onStart);
    return () => window.removeEventListener(TOUR_START_EVENT, onStart);
  }, [startTour]);

  // Auto-start on dashboard: first login / first time opening Accounting
  useEffect(() => {
    if (!hydrated || !userId || pathname !== "/dashboard" || open) return;

    const pending = sessionStorage.getItem(TOUR_SESSION.START_ACCOUNTING) === "1";
    if (completed && !pending) return;

    const t = window.setTimeout(() => {
      consumeAccountingTourStart();
      startTour();
    }, AUTO_START_DELAY_MS);

    return () => window.clearTimeout(t);
  }, [hydrated, userId, pathname, open, completed, startTour]);

  useLayoutEffect(() => {
    if (!open) return;

    prepareStep();

    const el = document.querySelector(`[${TOUR_ATTR}="${current.target}"]`);
    el?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });

    document.body.classList.add("spotlight-tour-active");

    const t = window.setTimeout(updateRect, current.openTools ? 320 : 80);
    return () => {
      window.clearTimeout(t);
      document.body.classList.remove("spotlight-tour-active");
    };
  }, [open, step, current.target, current.openTools, updateRect, prepareStep]);

  useEffect(() => {
    if (!open) return;

    updateRect();
    const onLayout = () => updateRect();
    const onSidebarOpen = () => window.setTimeout(updateRect, 400);
    const onToolsOpen = () => window.setTimeout(updateRect, 350);
    window.addEventListener("resize", onLayout);
    window.addEventListener("scroll", onLayout, true);
    window.addEventListener(TOUR_SIDEBAR_OPEN_EVENT, onSidebarOpen);
    window.addEventListener(TOUR_TOOLS_OPEN_EVENT, onToolsOpen);
    return () => {
      window.removeEventListener("resize", onLayout);
      window.removeEventListener("scroll", onLayout, true);
      window.removeEventListener(TOUR_SIDEBAR_OPEN_EVENT, onSidebarOpen);
      window.removeEventListener(TOUR_TOOLS_OPEN_EVENT, onToolsOpen);
    };
  }, [open, step, updateRect]);

  useEffect(() => {
    if (!open) return;
    document.querySelectorAll(`[${TOUR_ATTR}]`).forEach((node) => {
      node.classList.remove("spotlight-tour-target-active");
    });
    const active = document.querySelector(`[${TOUR_ATTR}="${current.target}"]`);
    active?.classList.add("spotlight-tour-target-active");
    return () => active?.classList.remove("spotlight-tour-target-active");
  }, [open, step, current.target]);

  const closeTour = useCallback(
    (markComplete = false) => {
      setOpen(false);
      setStep(0);
      setRect(null);
      document.body.classList.remove("spotlight-tour-active");
      document.querySelectorAll(".spotlight-tour-target-active").forEach((n) => {
        n.classList.remove("spotlight-tour-target-active");
      });
      if (markComplete && userId) {
        markAccountingTourCompleted(userId);
        setCompleted(true);
      }
    },
    [userId]
  );

  const next = useCallback(() => {
    if (step >= ACCOUNTING_TOUR_STEPS.length - 1) {
      closeTour(true);
      return;
    }
    setStep((s) => s + 1);
  }, [step, closeTour]);

  const prev = useCallback(() => {
    setStep((s) => Math.max(0, s - 1));
  }, []);

  const goTo = useCallback((index: number) => {
    setStep(Math.max(0, Math.min(ACCOUNTING_TOUR_STEPS.length - 1, index)));
  }, []);

  if (!open) return null;

  const Icon = current.icon;
  const isLast = step === ACCOUNTING_TOUR_STEPS.length - 1;
  const isFirst = step === 0;
  const clip = spotlightClipPath(rect);

  return (
    <div className="fixed inset-0 z-[200]" role="presentation">
      <div
        className="pointer-events-none fixed inset-0 backdrop-blur-[6px] bg-[#0F1F12]/55 transition-[clip-path] duration-300 ease-out"
        style={{ clipPath: clip }}
        aria-hidden
      />

      {clip && (
        <div
          className="fixed inset-0"
          style={{ clipPath: clip }}
          onClick={() => closeTour(false)}
          aria-hidden
        />
      )}

      {rect && (
        <>
          <div
            className="spotlight-tour-ring pointer-events-none fixed rounded-xl transition-all duration-300 ease-out"
            style={{
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
            }}
            aria-hidden
          />
          <div
            className="fixed rounded-xl"
            style={{
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
              zIndex: 201,
            }}
            aria-hidden
          />
        </>
      )}

      <div
        className="fixed z-[201] overflow-hidden rounded-2xl border border-[#105820]/15 bg-white shadow-[0_24px_80px_rgba(16,88,32,0.28)] transition-all duration-300 ease-out"
        style={tooltipStyle(rect)}
        role="dialog"
        aria-modal="true"
        aria-labelledby="accounting-tour-title"
      >
        <div className="bg-gradient-to-br from-[#105820] to-[#1a6b28] px-5 py-4 text-white">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
                <Icon className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/60">
                  Step {step + 1} of {ACCOUNTING_TOUR_STEPS.length}
                </p>
                <h2 id="accounting-tour-title" className="mt-0.5 text-lg font-semibold leading-snug">
                  {current.title}
                </h2>
              </div>
            </div>
            <button
              type="button"
              onClick={() => closeTour(false)}
              className="shrink-0 rounded-lg p-1 text-white/70 hover:bg-white/10 hover:text-white"
              aria-label="Close tour"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="px-5 py-4">
          <p className="text-sm leading-relaxed text-slate-600">{current.body}</p>
          {current.tips && current.tips.length > 0 && (
            <ul className="mt-3 space-y-1.5 rounded-xl bg-[#F3F8F0] px-3 py-2.5 text-xs text-[#0F1F12]">
              {current.tips.map((tip) => (
                <li key={tip} className="flex gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#78B028]" />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3">
          <button
            type="button"
            onClick={() => closeTour(true)}
            className="text-xs font-medium text-slate-500 hover:text-slate-700"
          >
            Skip tour
          </button>

          <div className="flex items-center gap-1">
            {ACCOUNTING_TOUR_STEPS.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => goTo(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === step ? "w-5 bg-[#105820]" : "w-1.5 bg-slate-200 hover:bg-[#78B028]/60"
                )}
                aria-label={`Step ${i + 1}`}
              />
            ))}
          </div>

          <div className="flex gap-2">
            {!isFirst && (
              <button
                type="button"
                onClick={prev}
                className="dash-btn-secondary !px-3 !py-1.5 text-xs"
              >
                Back
              </button>
            )}
            <button type="button" onClick={next} className="dash-btn-primary !px-3 !py-1.5 text-xs">
              {isLast ? "Finish" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AccountingTourTrigger({
  className,
  variant = "sidebar",
}: {
  className?: string;
  variant?: "sidebar" | "button";
}) {
  if (variant === "button") {
    return (
      <button
        type="button"
        data-accounting-tour="header-tour"
        onClick={requestAccountingTourStart}
        className={cn("dash-btn-secondary", className)}
      >
        <Compass className="mr-2 inline h-4 w-4" />
        Quick tour
      </button>
    );
  }

  return (
    <button
      type="button"
      data-accounting-tour="nav-tour"
      onClick={requestAccountingTourStart}
      className={cn("sidebar-link w-full text-white/80", className)}
    >
      <span className="sidebar-link-icon-wrap" aria-hidden>
        <Compass className="sidebar-link-icon" strokeWidth={1.75} />
      </span>
      <span className="sidebar-link-label">Quick tour</span>
    </button>
  );
}

export function accountingNavTourId(href: string): string | undefined {
  const map: Record<string, string> = {
    "/dashboard": "nav-dashboard",
    "/produce": "nav-produce",
    "/customers": "nav-customers",
    "/suppliers": "nav-suppliers",
    "/bank": "nav-bank",
    "/quotes": "nav-quotes",
    "/invoices": "nav-invoices",
    "/reports": "nav-reports",
    "/settings/account-management": "nav-users",
    "/purchases": "nav-purchases",
    "/inventory": "nav-inventory",
    "/local-sales": "nav-local-sales",
    "/export-sales": "nav-export-sales",
    "/expenses": "nav-expenses",
    "/payments": "nav-payments",
    "/ledger": "nav-ledger",
    "/approvals": "nav-approvals",
    "/settings": "nav-settings",
  };
  return map[href];
}
