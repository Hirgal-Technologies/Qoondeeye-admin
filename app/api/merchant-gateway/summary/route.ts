import { getMerchantGatewaySummary } from "@/features/merchant-gateway/server/queries";
import { createAdminGetHandler } from "@/lib/api/admin-route";

export const GET = createAdminGetHandler(
  {
    operation: "merchant-gateway.summary",
    minimumRole: "admin",
    cacheTtlMs: 0,
  },
  (request) =>
    getMerchantGatewaySummary({
      forceMoney: request.nextUrl.searchParams.get("freshMoney") === "1",
    }),
);
