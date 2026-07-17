import { getAuthUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppsPage from "./page-client";

export default async function AppsRoute() {
  const user = await getAuthUser();
  if (!user) redirect("/login");
  return <AppsPage userName={user.fullName} userId={user.id} />;
}
