import { getAuthUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { IdleSessionGuard } from "@/components/auth/idle-session-guard";
import { getSessionIdleMinutes } from "@/lib/session-idle";
import AppsPage from "./page-client";

export default async function AppsRoute() {
  const user = await getAuthUser();
  if (!user) redirect("/login");
  const idleMinutes = await getSessionIdleMinutes();
  return (
    <IdleSessionGuard idleMinutes={idleMinutes}>
      <AppsPage userName={user.fullName} userId={user.id} />
    </IdleSessionGuard>
  );
}
