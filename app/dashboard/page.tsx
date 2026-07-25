import type { Metadata } from "next";
import { OverviewPage } from "@/features/analytics/overview/components/overview-page";

export const metadata: Metadata = {
  title: "Overview",
  description: "Aggregated growth, engagement, financial activity, and platform reliability.",
};

export default function Page() {
  return <OverviewPage />;
}
