import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TransactionsPage } from "@/features/transactions/components/transactions-page";
import { getAdminSession, hasRole } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Transactions",
  description: "Search and filter individual user transactions.",
};

export default async function Page() {
  const identity = await getAdminSession();
  if (!identity) redirect("/login");

  return <TransactionsPage hasAdminRole={hasRole(identity, "admin")} />;
}
