import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuditPage } from "@/features/audit/components/audit-page";
import { getAdminSession, hasRole } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Audit logs",
  description: "Recorded admin and support access events.",
};

export default async function Page() {
  const identity = await getAdminSession();
  if (!identity) redirect("/login");

  return <AuditPage isAdmin={hasRole(identity, "admin")} />;
}
