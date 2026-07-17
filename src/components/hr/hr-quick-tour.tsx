"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Briefcase,
  CalendarDays,
  Compass,
  FileSignature,
  LayoutDashboard,
  Sparkles,
  Star,
  UserPlus,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppUserOptional } from "@/components/layout/user-context";
import {
  consumeHrTourStart,
  hrTourStorageKey,
  markHrTourCompleted,
  TOUR_SESSION,
} from "@/lib/product-tour";

const TOUR_START_EVENT = "onesource:hr-tour-start";
const TOUR_SIDEBAR_OPEN_EVENT = "onesource:hr-tour-sidebar-open";
const SPOTLIGHT_PAD = 8;
const AUTO_START_DELAY_MS = 900;

export type HrTourStep = {
  id: string;
  title: string;
  body: string;
  icon: LucideIcon;
  /** data-hr-tour value on the element to spotlight */
  target: string;
  tips?: string[];
};

export const HR_TOUR_STEPS: HrTourStep[] = [
  {
    id: "welcome",
    title: "Welcome to Human Resources",
    body: "This sidebar is your home base. Everything in HR lives here — grouped by People, Time, Talent, and Compliance.",
    icon: Sparkles,
    target: "hr-sidebar",
    tips: ["You chose HR after login. Switch system returns you to Accounting."],
  },
  {
    id: "overview",
    title: "HR overview",
    body: "Open Overview for headcount, leave queues, attendance today, open roles, and shortcuts into every module.",
    icon: LayoutDashboard,
    target: "nav-overview",
  },
  {
    id: "people",
    title: "Employees",
    body: "Manage staff records, profiles, contracts, onboarding checklists, and reporting lines from Employees and Org chart.",
    icon: Briefcase,
    target: "nav-employees",
    tips: ["Org chart is right below Employees in the sidebar."],
  },
  {
    id: "time",
    title: "Leave",
    body: "Submit and approve leave, track balances by policy, and connect time off to attendance.",
    icon: CalendarDays,
    target: "nav-leave",
    tips: ["Attendance and Holidays are in the same Time group."],
  },
  {
    id: "talent",
    title: "Recruitment",
    body: "Post job openings, track applicants through the pipeline, and hand off to Performance and Training.",
    icon: UserPlus,
    target: "nav-recruitment",
  },
  {
    id: "compliance",
    title: "Contracts",
    body: "Store employment contracts, watch expiry dates, and keep disciplinary records alongside payroll compliance.",
    icon: FileSignature,
    target: "nav-contracts",
    tips: ["Disciplinary and HR reports sit in this Compliance group too."],
  },
  {
    id: "reports",
    title: "HR reports",
    body: "Headcount by department, turnover, leave usage, attendance trends, and recruitment pipeline analytics.",
    icon: Star,
    target: "nav-reports",
  },
  {
    id: "payroll",
    title: "Payroll",
    body: "Create monthly pay runs, approve totals, then mark as paid — Uganda PAYE and NSSF with GL posting.",
    icon: Wallet,
    target: "nav-payroll",
  },
  {
    id: "finish",
    title: "Quick tour anytime",
    body: "You're set. Reopen this guided tour from Quick tour in the sidebar whenever someone new joins the team.",
    icon: Compass,
    target: "nav-tour",
    tips: ["Use Switch system below to return to Accounting."],
  },
];

type SpotlightRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

function measureTarget(targetId: string): SpotlightRect | null {
  const el = document.querySelector(`[data-hr-tour="${targetId}"]`);
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

/** Start the tour from anywhere in the HR app. */
export function requestHrTourStart() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(TOUR_START_EVENT));
  }
}

/** Mount once in the HR workspace — spotlight tour overlay. */
export function HrTourRoot() {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAppUserOptional();
  const userId = user?.id;
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [completed, setCompleted] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [rect, setRect] = useState<SpotlightRect | null>(null);

  const current = HR_TOUR_STEPS[step];

  const updateRect = useCallback(() => {
    setRect(measureTarget(current.target));
  }, [current.target]);

  useEffect(() => {
    if (!userId) return;
    setCompleted(localStorage.getItem(hrTourStorageKey(userId)) === "1");
    setHydrated(true);
  }, [userId]);

  const startTour = useCallback(() => {
    setStep(0);
    setOpen(true);
    if (window.innerWidth < 1024) {
      window.dispatchEvent(new CustomEvent(TOUR_SIDEBAR_OPEN_EVENT));
    }
    if (window.location.pathname !== "/hr") {
      router.push("/hr");
    }
  }, [router]);

  useEffect(() => {
    const onStart = () => startTour();
    window.addEventListener(TOUR_START_EVENT, onStart);
    return () => window.removeEventListener(TOUR_START_EVENT, onStart);
  }, [startTour]);

  useEffect(() => {
    if (!hydrated || !userId || pathname !== "/hr" || open) return;
    const pending = sessionStorage.getItem(TOUR_SESSION.START_HR) === "1";
    if (completed && !pending) return;
    const t = window.setTimeout(() => {
      consumeHrTourStart();
      startTour();
    }, AUTO_START_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [hydrated, userId, pathname, open, completed, startTour]);

  useLayoutEffect(() => {
    if (!open) return;

    const el = document.querySelector(`[data-hr-tour="${current.target}"]`);
    el?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });

    document.body.classList.add("hr-tour-active");

    const t = window.setTimeout(updateRect, 80);
    return () => {
      window.clearTimeout(t);
      document.body.classList.remove("hr-tour-active");
    };
  }, [open, step, current.target, updateRect]);

  useEffect(() => {
    if (!open) return;

    updateRect();
    const onLayout = () => updateRect();
    const onSidebarOpen = () => window.setTimeout(updateRect, 400);
    window.addEventListener("resize", onLayout);
    window.addEventListener("scroll", onLayout, true);
    window.addEventListener(TOUR_SIDEBAR_OPEN_EVENT, onSidebarOpen);
    return () => {
      window.removeEventListener("resize", onLayout);
      window.removeEventListener("scroll", onLayout, true);
      window.removeEventListener(TOUR_SIDEBAR_OPEN_EVENT, onSidebarOpen);
    };
  }, [open, step, updateRect]);

  useEffect(() => {
    if (!open) return;
    document.querySelectorAll("[data-hr-tour]").forEach((node) => {
      node.classList.remove("hr-tour-target-active");
    });
    const active = document.querySelector(`[data-hr-tour="${current.target}"]`);
    active?.classList.add("hr-tour-target-active");
    return () => active?.classList.remove("hr-tour-target-active");
  }, [open, step, current.target]);

  const closeTour = useCallback(
    (markComplete = false) => {
      setOpen(false);
      setStep(0);
      setRect(null);
      document.body.classList.remove("hr-tour-active");
      document.querySelectorAll(".hr-tour-target-active").forEach((n) => {
        n.classList.remove("hr-tour-target-active");
      });
      if (markComplete && userId) {
        markHrTourCompleted(userId);
        setCompleted(true);
      }
    },
    [userId]
  );

  const next = useCallback(() => {
    if (step >= HR_TOUR_STEPS.length - 1) {
      closeTour(true);
      return;
    }
    setStep((s) => s + 1);
  }, [step, closeTour]);

  const prev = useCallback(() => {
    setStep((s) => Math.max(0, s - 1));
  }, []);

  const goTo = useCallback((index: number) => {
    setStep(Math.max(0, Math.min(HR_TOUR_STEPS.length - 1, index)));
  }, []);

  if (!open) return null;

  const Icon = current.icon;
  const isLast = step === HR_TOUR_STEPS.length - 1;
  const isFirst = step === 0;
  const clip = spotlightClipPath(rect);

  return (
    <div className="hr-tour-overlay fixed inset-0 z-[200]" role="presentation">
      {/* Blurred dim layer with cutout */}
      <div
        className="pointer-events-none fixed inset-0 backdrop-blur-[6px] bg-[#0F1F12]/55 transition-[clip-path] duration-300 ease-out"
        style={{ clipPath: clip }}
        aria-hidden
      />

      {/* Click-catcher on dimmed area only */}
      {clip && (
        <div
          className="fixed inset-0"
          style={{ clipPath: clip }}
          onClick={() => closeTour(false)}
          aria-hidden
        />
      )}

      {/* Spotlight ring */}
      {rect && (
        <>
          <div
            className="hr-tour-ring pointer-events-none fixed rounded-xl transition-all duration-300 ease-out"
            style={{
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
            }}
            aria-hidden
          />
          {/* Block accidental clicks on highlighted control during tour */}
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

      {/* Tooltip */}
      <div
        className="hr-tour-tooltip fixed z-[201] overflow-hidden rounded-2xl border border-[#105820]/15 bg-white shadow-[0_24px_80px_rgba(16,88,32,0.28)] transition-all duration-300 ease-out"
        style={tooltipStyle(rect)}
        role="dialog"
        aria-modal="true"
        aria-labelledby="hr-tour-title"
      >
        <div className="bg-gradient-to-br from-[#105820] to-[#1a6b28] px-5 py-4 text-white">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
                <Icon className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/60">
                  Step {step + 1} of {HR_TOUR_STEPS.length}
                </p>
                <h2 id="hr-tour-title" className="mt-0.5 text-lg font-semibold leading-snug">
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
            {HR_TOUR_STEPS.map((s, i) => (
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

/** Sidebar / header trigger */
export function HrTourTrigger({
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
        data-hr-tour="header-tour"
        onClick={requestHrTourStart}
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
      data-hr-tour="nav-tour"
      onClick={requestHrTourStart}
      className={cn("sidebar-link w-full text-white/80", className)}
    >
      <span className="sidebar-link-icon-wrap" aria-hidden>
        <Compass className="sidebar-link-icon" strokeWidth={1.75} />
      </span>
      <span className="sidebar-link-label">Quick tour</span>
    </button>
  );
}

/** @deprecated Use HrTourRoot */
export function HrTourProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <HrTourRoot />
    </>
  );
}

/** Map nav href → data-hr-tour id for spotlight steps */
export function hrNavTourId(href: string): string | undefined {
  const map: Record<string, string> = {
    "/hr": "nav-overview",
    "/employees": "nav-employees",
    "/hr/org": "nav-org",
    "/leave": "nav-leave",
    "/attendance": "nav-attendance",
    "/hr/holidays": "nav-holidays",
    "/hr/recruitment": "nav-recruitment",
    "/hr/performance": "nav-performance",
    "/hr/training": "nav-training",
    "/hr/contracts": "nav-contracts",
    "/hr/disciplinary": "nav-disciplinary",
    "/payroll": "nav-payroll",
    "/hr/reports": "nav-reports",
  };
  return map[href];
}
