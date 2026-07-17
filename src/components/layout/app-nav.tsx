"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  ChevronDown,
  LogOut,
  Menu,
  X,
  LayoutDashboard,
  Tags,
  Users,
  Truck,
  Landmark,
  FileText,
  Receipt,
  BarChart3,
  UserCog,
  ShoppingCart,
  Boxes,
  Store,
  Globe,
  Wallet,
  CreditCard,
  BookOpen,
  CheckSquare,
  Settings,
  ArrowLeftRight,
  type LucideIcon,
} from "lucide-react";
import { BrandLogo } from "@/components/layout/brand-logo";
import {
  AccountingTourTrigger,
  accountingNavTourId,
} from "@/components/accounting/accounting-quick-tour";
import { firstNameOf } from "@/components/layout/user-context";
import { cn } from "@/lib/utils";
import { canAccessModule, type Module } from "@/lib/permissions";
import type { UserRole } from "@/generated/prisma/client";

type NavLink = { href: string; label: string; module: Module; icon: LucideIcon };

const PRIMARY_LINKS: NavLink[] = [
  { href: "/dashboard", label: "Dashboard", module: "dashboard", icon: LayoutDashboard },
  { href: "/produce", label: "Categories", module: "produce", icon: Tags },
  { href: "/customers", label: "Customers", module: "customers", icon: Users },
  { href: "/suppliers", label: "Suppliers", module: "suppliers", icon: Truck },
  { href: "/bank", label: "Banking", module: "bank", icon: Landmark },
  { href: "/quotes", label: "Quotes", module: "quotes", icon: FileText },
  { href: "/invoices", label: "Invoices", module: "invoices", icon: Receipt },
  { href: "/reports", label: "Reports", module: "reports", icon: BarChart3 },
  { href: "/settings/account-management", label: "Users", module: "users", icon: UserCog },
];

const TOOLS_LINKS: NavLink[] = [
  { href: "/purchases", label: "Purchases", module: "purchases", icon: ShoppingCart },
  { href: "/inventory", label: "Inventory", module: "inventory", icon: Boxes },
  { href: "/local-sales", label: "Local Sales", module: "local_sales", icon: Store },
  { href: "/export-sales", label: "Export Sales", module: "export_sales", icon: Globe },
  { href: "/expenses", label: "Expenses", module: "expenses", icon: Wallet },
  { href: "/payments", label: "Payments", module: "payments", icon: CreditCard },
  { href: "/ledger", label: "General Ledger", module: "ledger", icon: BookOpen },
  { href: "/approvals", label: "Approvals", module: "approvals", icon: CheckSquare },
  { href: "/settings", label: "Settings", module: "settings", icon: Settings },
];

interface AppNavProps {
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
  onNavigate?: () => void;
  tourId?: string;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      data-accounting-tour={tourId}
      className={cn("sidebar-link", active && "sidebar-link-active")}
    >
      <span className="sidebar-link-icon-wrap" aria-hidden>
        <Icon className="sidebar-link-icon" strokeWidth={1.75} />
      </span>
      <span className="sidebar-link-label">{label}</span>
    </Link>
  );
}

function NavLinks({
  primary,
  tools,
  toolsOpen,
  setToolsOpen,
  isActive,
  onNavigate,
}: {
  primary: NavLink[];
  tools: NavLink[];
  toolsOpen: boolean;
  setToolsOpen: (v: boolean | ((p: boolean) => boolean)) => void;
  isActive: (href: string) => boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav className="sidebar-nav flex-1 overflow-y-auto">
      <div className="sidebar-section">
        <p className="sidebar-section-label">Main</p>
        <div className="sidebar-link-group">
          {primary.map((link) => (
            <NavItem
              key={link.href}
              href={link.href}
              label={link.label}
              icon={link.icon}
              tourId={accountingNavTourId(link.href)}
              active={isActive(link.href)}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      </div>

      {tools.length > 0 && (
        <div className="sidebar-section">
          <button
            type="button"
            onClick={() => setToolsOpen((v) => !v)}
            className="sidebar-section-toggle"
            data-accounting-tour="nav-tools-section"
            aria-expanded={toolsOpen}
          >
            <span>Tools</span>
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 shrink-0 opacity-70 transition-transform duration-200",
                toolsOpen ? "rotate-0" : "-rotate-90"
              )}
            />
          </button>
          {toolsOpen && (
            <div className="sidebar-link-group">
              {tools.map((link) => (
                <NavItem
                  key={link.href}
                  href={link.href}
                  label={link.label}
                  icon={link.icon}
                  tourId={accountingNavTourId(link.href)}
                  active={isActive(link.href)}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </nav>
  );
}

export function AppNav({ userName, userRole, notificationCount = 0 }: AppNavProps) {
  const pathname = usePathname();
  const [toolsOpen, setToolsOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const openSidebar = () => setMobileOpen(true);
    const openTools = () => setToolsOpen(true);
    window.addEventListener("onesource:accounting-tour-sidebar-open", openSidebar);
    window.addEventListener("onesource:accounting-tour-tools-open", openTools);
    return () => {
      window.removeEventListener("onesource:accounting-tour-sidebar-open", openSidebar);
      window.removeEventListener("onesource:accounting-tour-tools-open", openTools);
    };
  }, []);

  const primary = PRIMARY_LINKS.filter((l) => canAccessModule(userRole, l.module));
  const tools = TOOLS_LINKS.filter((l) => canAccessModule(userRole, l.module));
  const firstName = firstNameOf(userName);
  const initials = userName
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    if (href === "/settings") return pathname === "/settings";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const closeMobile = () => setMobileOpen(false);
  const roleLabel = userRole.replace(/_/g, " ").toLowerCase();

  return (
    <>
      <div className="app-sidebar sticky top-0 z-40 flex h-14 items-center justify-between px-4 text-white lg:hidden">
        <Link href="/dashboard" onClick={closeMobile} className="flex items-center">
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
        data-accounting-tour="accounting-sidebar"
        className={cn(
          "app-sidebar fixed inset-y-0 left-0 z-50 flex w-[272px] flex-col text-white shadow-[4px_0_24px_rgba(0,0,0,0.12)] transition-transform lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="sidebar-brand shrink-0">
          <Link href="/dashboard" onClick={closeMobile} className="sidebar-brand-link">
            <BrandLogo
              size="sm"
              variant="light"
              className="[&_img]:h-8 [&_img]:w-auto [&_img]:max-w-[150px]"
            />
          </Link>
        </div>

        <NavLinks
          primary={primary}
          tools={tools}
          toolsOpen={toolsOpen}
          setToolsOpen={setToolsOpen}
          isActive={isActive}
          onNavigate={closeMobile}
        />

        <div className="sidebar-footer shrink-0 space-y-2">
          <AccountingTourTrigger />
          <Link
            href="/apps"
            onClick={closeMobile}
            className="sidebar-link text-white/80"
          >
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
                title="Notifications"
              >
                <Bell className="h-4 w-4" strokeWidth={1.75} />
                {notificationCount > 0 && (
                  <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-[#78B028] ring-2 ring-[#0C4518]" />
                )}
              </Link>
              <form action="/api/auth/logout" method="POST">
                <button
                  type="submit"
                  className="sidebar-icon-btn hover:text-red-300"
                  aria-label="Sign out"
                  title="Sign out"
                >
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
