import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { NewUsersPage } from "@/features/analytics/users/components/new-users-page";
import { getAdminSession, hasRole } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "New signups",
  description: "Total new signups and the roster of newly registered users.",
};

export default async function Page() {
  const identity = await getAdminSession();
  if (!identity) redirect("/login");

  return <NewUsersPage hasSupportRole={hasRole(identity, "support")} />;
}
