import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OverviewPage } from "@/features/analytics/overview/components/overview-page";
import { getAdminSession, hasRole } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Overview",
  description: "Aggregated growth, engagement, financial activity, and platform reliability.",
};

export default async function Page() {
  const identity = await getAdminSession();
  if (!identity) redirect("/login");

  // Roster drill-downs are support-gated, so viewers get plain KPI tiles.
  return <OverviewPage hasSupportRole={hasRole(identity, "support")} />;
}
