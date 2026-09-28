import { getGatewayHistory } from "@/features/merchant-gateway/server/queries";
import { createAdminGetHandler } from "@/lib/api/admin-route";

export const GET = createAdminGetHandler(
  {
    operation: "merchant-gateway.alerts",
    minimumRole: "admin",
    cacheTtlMs: 0,
  },
  () => getGatewayHistory(),
);
