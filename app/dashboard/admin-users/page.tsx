import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminUsersPage } from "@/features/admin-users/components/admin-users-page";
import { getAdminSession, hasRole } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Admin users",
  description: "Manage dashboard access for the admin user roster.",
};

export default async function Page() {
  const identity = await getAdminSession();
  if (!identity) redirect("/login");

  return (
    <AdminUsersPage
      isAdmin={hasRole(identity, "admin")}
      currentUserId={identity.id}
    />
  );
}
