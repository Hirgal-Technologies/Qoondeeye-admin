import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ActiveUsersPage } from "@/features/analytics/users/components/active-users-page";
import { getAdminSession, hasRole } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Active users",
  description: "Engagement totals and the roster of accounts with recent activity.",
};

export default async function Page() {
  const identity = await getAdminSession();
  if (!identity) redirect("/login");

  return <ActiveUsersPage hasSupportRole={hasRole(identity, "support")} />;
}
