import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ResellerPage } from "@/features/reseller/components/reseller-page";
import { getAdminSession, hasRole } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Reseller catalog",
  description: "Browse TopTayo providers, bundles, and transactions.",
};

export default async function Page() {
  const identity = await getAdminSession();
  if (!identity) redirect("/login");

  return (
    <ResellerPage
      hasSupportRole={hasRole(identity, "support")}
      hasAdminRole={hasRole(identity, "admin")}
    />
  );
}
