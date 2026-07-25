import type { Metadata } from "next";
import { ReportsPage } from "@/features/reports/components/reports-page";

export const metadata: Metadata = {
  title: "Reports",
  description: "Standard reports and saved report definitions.",
};

export default function Page() {
  return <ReportsPage />;
}
