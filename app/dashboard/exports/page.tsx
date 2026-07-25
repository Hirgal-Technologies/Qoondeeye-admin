import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ExportsPage } from "@/features/exports/components/exports-page";
import { getAdminSession, hasRole } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Data exports",
  description: "Download approved, aggregate CSV datasets.",
};

export default async function Page() {
  const identity = await getAdminSession();
  if (!identity) redirect("/login");

  return <ExportsPage isAdmin={hasRole(identity, "admin")} />;
}
