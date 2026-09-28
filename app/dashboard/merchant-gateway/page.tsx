import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { MerchantGatewayPage } from "@/features/merchant-gateway/components/merchant-gateway-page";
import { getAdminSession, hasRole } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Merchant gateway",
  description: "Review merchant gateway health, payment matches, and fulfillment status.",
};

export default async function Page() {
  const identity = await getAdminSession();
  if (!identity) redirect("/login");

  return (
    <Suspense fallback={<MerchantGatewayLoading />}>
      <MerchantGatewayPage hasAdminRole={hasRole(identity, "admin")} />
    </Suspense>
  );
}

function MerchantGatewayLoading() {
  return (
    <div className="flex flex-col gap-4" role="status" aria-label="Loading merchant gateway">
      <div className="skeleton h-16 rounded-md" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((item) => (
          <div key={item} className="skeleton h-24 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
