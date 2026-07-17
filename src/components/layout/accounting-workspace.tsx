"use client";

import { AppNav } from "@/components/layout/app-nav";
import { AccountingTourRoot } from "@/components/accounting/accounting-quick-tour";
import type { UserRole } from "@/generated/prisma/client";

export function AccountingWorkspace({
  userName,
  userRole,
  notificationCount,
  children,
}: {
  userName: string;
  userRole: UserRole;
  notificationCount: number;
  children: React.ReactNode;
}) {
  return (
    <>
      <AppNav
        userName={userName}
        userRole={userRole}
        notificationCount={notificationCount}
      />
      <div className="lg:ml-[272px]">
        <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">{children}</main>
      </div>
      <AccountingTourRoot />
    </>
  );
}
