import type { Metadata } from "next";
import { FinancePage } from "@/features/analytics/finance/components/finance-page";

export const metadata: Metadata = {
  title: "Financial activity",
  description: "Anonymized transaction, budget, subscription, loan, and account trends.",
};

export default function Page() {
  return <FinancePage />;
}
