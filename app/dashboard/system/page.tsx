import type { Metadata } from "next";
import { SystemHealthPage } from "@/features/analytics/system/components/system-page";

export const metadata: Metadata = {
  title: "System health",
  description: "Ledger entry timeliness, alerts, and admin activity monitoring.",
};

export default function Page() {
  return <SystemHealthPage />;
}
