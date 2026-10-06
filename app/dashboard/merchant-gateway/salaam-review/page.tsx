import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SalaamReviewPage } from "@/features/merchant-gateway/components/salaam-review-page";
import { getAdminSession, hasRole } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Salaam review",
  description: "Correct the destination for a Salaam bundle payment that was already received.",
};

export default async function Page() {
  const identity = await getAdminSession();
  if (!identity) redirect("/login");
  return <SalaamReviewPage hasAdminRole={hasRole(identity, "admin")} />;
}
