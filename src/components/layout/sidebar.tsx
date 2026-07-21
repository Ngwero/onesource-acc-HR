"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogo } from "@/components/layout/brand-logo";
import {
  LayoutDashboard,
  Leaf,
  Users,
  UserCircle,
  ShoppingCart,
  Warehouse,
  Store,
  Globe,
  Ship,
  Receipt,
  CreditCard,
  FileText,
  Wallet,
  BookOpen,
  BarChart3,
  CalendarCheck,
  CheckSquare,
  History,
  Settings,
  LogOut,
  Landmark,
  FileQuestion,
  FileMinus,
  ClipboardList,
  Repeat,
  Calculator,
  PiggyBank,
  Building2,
  Sparkles,
  Upload,
  PhoneCall,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { canAccessModule, type Module } from "@/lib/permissions";
import type { UserRole } from "@/generated/prisma/client";

type NavItem = { href: string; label: string; icon: React.ElementType; module: Module };

const navSections: { title: string; items: NavItem[] }[] = [
  {
    title: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, module: "dashboard" },
      { href: "/accounting", label: "Xero Accounting", icon: Sparkles, module: "reports" },
    ],
  },
  {
    title: "Operations",
    items: [
      { href: "/produce", label: "Produce", icon: Leaf, module: "produce" },
      { href: "/suppliers", label: "Suppliers", icon: Users, module: "suppliers" },
      { href: "/customers", label: "Customers", icon: UserCircle, module: "customers" },
      { href: "/purchase-orders", label: "Purchase Orders", icon: ClipboardList, module: "purchase_orders" },
      { href: "/purchases", label: "Purchases", icon: ShoppingCart, module: "purchases" },
      { href: "/inventory", label: "Inventory", icon: Warehouse, module: "inventory" },
      { href: "/quotes", label: "Quotes", icon: FileQuestion, module: "quotes" },
      { href: "/local-sales", label: "Local Sales", icon: Store, module: "local_sales" },
      { href: "/export-sales", label: "Export Sales", icon: Globe, module: "export_sales" },
      { href: "/export-shipments", label: "Export Shipments", icon: Ship, module: "export_shipments" },
    ],
  },
  {
    title: "Xero Finance",
    items: [
      { href: "/bank", label: "Bank Accounts", icon: Landmark, module: "bank" },
      { href: "/invoices", label: "Invoices", icon: FileText, module: "invoices" },
      { href: "/credit-notes", label: "Credit Notes", icon: FileMinus, module: "credit_notes" },
      { href: "/payables", label: "Accounts Payable", icon: CreditCard, module: "payables" },
      { href: "/receivables", label: "Accounts Receivable", icon: Wallet, module: "receivables" },
      { href: "/collections", label: "Collections", icon: PhoneCall, module: "receivables" },
      { href: "/payments", label: "Payments", icon: CreditCard, module: "payments" },
      { href: "/recurring", label: "Repeating", icon: Repeat, module: "recurring" },
      { href: "/expenses", label: "Expenses", icon: Receipt, module: "expenses" },
      { href: "/tax", label: "Tax / VAT", icon: Calculator, module: "tax" },
    ],
  },
  {
    title: "Accounting",
    items: [
      { href: "/ledger", label: "General Ledger", icon: BookOpen, module: "ledger" },
      { href: "/period-close", label: "Period Close", icon: CalendarCheck, module: "ledger" },
      { href: "/budgets", label: "Budgets", icon: PiggyBank, module: "budgets" },
      { href: "/fixed-assets", label: "Fixed Assets", icon: Building2, module: "fixed_assets" },
      { href: "/reports", label: "Reports", icon: BarChart3, module: "reports" },
      { href: "/approvals", label: "Approvals", icon: CheckSquare, module: "approvals" },
      { href: "/audit-trail", label: "Audit Trail", icon: History, module: "audit" },
      { href: "/import", label: "Bulk Import", icon: Upload, module: "settings" },
      { href: "/settings/account-management", label: "Account Management", icon: Users, module: "users" },
      { href: "/settings", label: "Settings", icon: Settings, module: "settings" },
    ],
  },
];

interface SidebarProps {
  userRole: UserRole;
  userName: string;
}

export function Sidebar({ userRole, userName }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-green-100 bg-white">
      <div className="border-b border-green-100 px-4 py-4">
        <Link href="/dashboard">
          <BrandLogo size="sm" showTagline />
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {navSections.map((section) => {
          const items = section.items.filter((item) => canAccessModule(userRole, item.module));
          if (items.length === 0) return null;
          return (
            <div key={section.title} className="mb-4">
              <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                {section.title}
              </p>
              <ul className="space-y-1">
                {items.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                          isActive ? "bg-green-700 text-white" : "text-green-800 hover:bg-green-50"
                        )}
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-green-100 p-4">
        <p className="truncate text-sm font-medium text-green-900">{userName}</p>
        <form action="/api/auth/logout" method="POST">
          <button type="submit" className="mt-2 flex items-center gap-2 text-sm text-gray-500 hover:text-red-600">
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
