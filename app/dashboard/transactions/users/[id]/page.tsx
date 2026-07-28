import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { TransactionUserDetailsPage } from "@/features/transactions/components/transaction-user-details-page";
import { getTransactionUserDetails } from "@/features/transactions/server/transactions-repository";
import { isTransactionUserId } from "@/features/transactions/validation";
import { getAdminSession, hasRole } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Transaction user details",
  description: "Profile, account, and transaction information for a user.",
};

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const identity = await getAdminSession();
  if (!identity) redirect("/login");
  if (!hasRole(identity, "support")) redirect("/dashboard/users");

  const { id } = await params;
  if (!isTransactionUserId(id)) notFound();

  const canViewFinancialDetails = hasRole(identity, "admin");
  const details = await getTransactionUserDetails(id, {
    includeFinancialDetails: canViewFinancialDetails,
  });
  if (!details) notFound();

  return (
    <TransactionUserDetailsPage
      details={details}
      showFinancialDetails={canViewFinancialDetails}
    />
  );
}
