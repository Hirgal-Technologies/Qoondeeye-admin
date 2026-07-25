import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SupportPage } from "@/features/support/components/support-page";
import { getAdminSession, hasRole } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Support tools",
  description: "Individual account lookup for approved support roles.",
};

export default async function Page() {
  const identity = await getAdminSession();
  if (!identity) redirect("/login");

  return <SupportPage hasSupportRole={hasRole(identity, "support")} />;
}
