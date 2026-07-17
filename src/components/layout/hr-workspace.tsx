"use client";

import { HrNav } from "@/components/layout/hr-nav";
import { HrTourRoot } from "@/components/hr/hr-quick-tour";
import { RouteProgress } from "@/components/layout/route-progress";
import type { UserRole } from "@/generated/prisma/client";

export function HrWorkspace({
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
      <RouteProgress />
      <HrNav
        userName={userName}
        userRole={userRole}
        notificationCount={notificationCount}
      />
      <div className="lg:ml-[272px]">
        <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">{children}</main>
      </div>
      <HrTourRoot />
    </>
  );
}
