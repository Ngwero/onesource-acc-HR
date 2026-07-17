"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  LogOut,
  Menu,
  X,
  LayoutDashboard,
  Briefcase,
  CalendarDays,
  Clock3,
  Wallet,
  ArrowLeftRight,
  Network,
  CalendarRange,
  UserPlus,
  Star,
  GraduationCap,
  FileSignature,
  ShieldAlert,
  BarChart3,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { BrandLogo } from "@/components/layout/brand-logo";
import { HrTourTrigger, hrNavTourId } from "@/components/hr/hr-quick-tour";
import { firstNameOf } from "@/components/layout/user-context";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/generated/prisma/client";

type NavLink = { href: string; label: string; icon: LucideIcon };

const CORE_LINKS: NavLink[] = [
  { href: "/hr", label: "Overview", icon: LayoutDashboard },
  { href: "/employees", label: "Employees", icon: Briefcase },
  { href: "/hr/org", label: "Org chart", icon: Network },
];

const TIME_LINKS: NavLink[] = [
  { href: "/leave", label: "Leave", icon: CalendarDays },
  { href: "/attendance", label: "Attendance", icon: Clock3 },
  { href: "/hr/holidays", label: "Holidays", icon: CalendarRange },
];

const TALENT_LINKS: NavLink[] = [
  { href: "/hr/recruitment", label: "Recruitment", icon: UserPlus },
  { href: "/hr/performance", label: "Performance", icon: Star },
  { href: "/hr/training", label: "Training", icon: GraduationCap },
];

const COMPLIANCE_LINKS: NavLink[] = [
  { href: "/hr/contracts", label: "Contracts", icon: FileSignature },
  { href: "/hr/disciplinary", label: "Disciplinary", icon: ShieldAlert },
  { href: "/payroll", label: "Payroll", icon: Wallet },
  { href: "/hr/reports", label: "HR reports", icon: BarChart3 },
];

interface HrNavProps {
  userName: string;
  userRole: UserRole;
  notificationCount?: number;
}

function NavItem({
  href,
  label,
  icon: Icon,
  active,
  onNavigate,
  tourId,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  onNavigate: () => void;
  tourId?: string;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      data-hr-tour={tourId}
      className={cn("sidebar-link", active && "sidebar-link-active")}
    >
      <span className="sidebar-link-icon-wrap" aria-hidden>
        <Icon className="sidebar-link-icon" strokeWidth={1.75} />
      </span>
      <span className="sidebar-link-label">{label}</span>
    </Link>
  );
}

function NavGroup({
  title,
  links,
  isActive,
  onNavigate,
}: {
  title: string;
  links: NavLink[];
  isActive: (href: string) => boolean;
  onNavigate: () => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mb-1 flex w-full items-center justify-between px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/40"
      >
        {title}
        <ChevronDown
          className={cn("h-3.5 w-3.5 transition", open ? "rotate-0" : "-rotate-90")}
        />
      </button>
      {open &&
        links.map((link) => (
          <NavItem
            key={link.href}
            {...link}
            tourId={hrNavTourId(link.href)}
            active={isActive(link.href)}
            onNavigate={onNavigate}
          />
        ))}
    </div>
  );
}

export function HrNav({ userName, userRole, notificationCount = 0 }: HrNavProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeMobile = () => setMobileOpen(false);

  useEffect(() => {
    const openSidebar = () => setMobileOpen(true);
    window.addEventListener("onesource:hr-tour-sidebar-open", openSidebar);
    return () => window.removeEventListener("onesource:hr-tour-sidebar-open", openSidebar);
  }, []);

  const isActive = (href: string) =>
    href === "/hr"
      ? pathname === "/hr"
      : pathname === href || pathname.startsWith(`${href}/`);

  const firstName = firstNameOf(userName);
  const initials = userName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  const roleLabel = String(userRole).replace(/_/g, " ").toLowerCase();

  return (
    <>
      <div className="app-sidebar sticky top-0 z-40 flex h-14 items-center justify-between px-4 text-white lg:hidden">
        <Link href="/hr" onClick={closeMobile} className="flex items-center">
          <BrandLogo size="sm" variant="light" className="[&_img]:h-8 [&_img]:w-auto" />
        </Link>
        <button
          type="button"
          className="rounded-lg p-2 hover:bg-white/10"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={closeMobile} />
      )}

      <aside
        data-hr-tour="hr-sidebar"
        className={cn(
          "app-sidebar fixed inset-y-0 left-0 z-50 flex w-[272px] flex-col text-white shadow-[4px_0_24px_rgba(0,0,0,0.12)] transition-transform lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="sidebar-brand shrink-0 !h-auto flex-col items-stretch justify-center gap-1 py-3">
          <Link href="/hr" onClick={closeMobile} className="sidebar-brand-link">
            <BrandLogo
              size="sm"
              variant="light"
              className="[&_img]:h-8 [&_img]:w-auto [&_img]:max-w-[150px]"
            />
          </Link>
          <p className="px-0.5 text-[11px] font-medium tracking-wide text-white/55">
            Human Resources
          </p>
        </div>

        <nav className="sidebar-nav flex-1 overflow-y-auto px-3 py-2">
          <NavGroup title="People" links={CORE_LINKS} isActive={isActive} onNavigate={closeMobile} />
          <NavGroup title="Time" links={TIME_LINKS} isActive={isActive} onNavigate={closeMobile} />
          <NavGroup title="Talent" links={TALENT_LINKS} isActive={isActive} onNavigate={closeMobile} />
          <NavGroup
            title="Compliance"
            links={COMPLIANCE_LINKS}
            isActive={isActive}
            onNavigate={closeMobile}
          />
        </nav>

        <div className="sidebar-footer shrink-0 space-y-2">
          <HrTourTrigger />
          <Link href="/apps" onClick={closeMobile} className="sidebar-link text-white/80">
            <span className="sidebar-link-icon-wrap" aria-hidden>
              <ArrowLeftRight className="sidebar-link-icon" strokeWidth={1.75} />
            </span>
            <span className="sidebar-link-label">Switch system</span>
          </Link>

          <div className="sidebar-user">
            <div className="sidebar-user-avatar" title={userName}>
              {initials || "U"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold leading-tight text-white">
                {firstName}
              </p>
              <p className="mt-0.5 truncate text-[11px] capitalize leading-tight tracking-wide text-white/50">
                {roleLabel}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              <Link
                href="/notifications"
                onClick={closeMobile}
                className="sidebar-icon-btn relative"
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4" strokeWidth={1.75} />
                {notificationCount > 0 && (
                  <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-[#78B028] ring-2 ring-[#0C4518]" />
                )}
              </Link>
              <form action="/api/auth/logout" method="POST">
                <button type="submit" className="sidebar-icon-btn hover:text-red-300" aria-label="Sign out">
                  <LogOut className="h-4 w-4" strokeWidth={1.75} />
                </button>
              </form>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
