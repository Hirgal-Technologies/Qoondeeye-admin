import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ResellerPage } from "@/features/reseller/components/reseller-page";
import { getAdminSession, hasRole } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Reseller catalog",
  description:
    "Compare live TopTayo cost with Qoondeeye selling prices from bundle_price_overrides.",
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
