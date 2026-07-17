import { cookies } from "next/headers";
import { getAuthUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppNav } from "@/components/layout/app-nav";
import { AccountingWorkspace } from "@/components/layout/accounting-workspace";
import { HrWorkspace } from "@/components/layout/hr-workspace";
import { UserProvider } from "@/components/layout/user-context";
import { prisma } from "@/lib/prisma";
import { WORKSPACE_COOKIE, isWorkspace } from "@/lib/workspace";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const cookieStore = await cookies();
  const raw = cookieStore.get(WORKSPACE_COOKIE)?.value;
  if (!isWorkspace(raw)) redirect("/apps");

  const notificationCount = await prisma.notification.count({
    where: { userId: user.id, isRead: false },
  });

  if (raw === "hr") {
    return (
      <UserProvider user={user}>
        <div className="min-h-screen app-shell">
          <HrWorkspace
            userName={user.fullName}
            userRole={user.role}
            notificationCount={notificationCount}
          >
            {children}
          </HrWorkspace>
        </div>
      </UserProvider>
    );
  }

  return (
    <UserProvider user={user}>
      <div className="min-h-screen app-shell">
        <AccountingWorkspace
          userName={user.fullName}
          userRole={user.role}
          notificationCount={notificationCount}
        >
          {children}
        </AccountingWorkspace>
      </div>
    </UserProvider>
  );
}
