import { getAccountTypeDistribution } from "@/features/analytics/finance/server/queries";
import { createAdminGetHandler } from "@/lib/api/admin-route";

export const GET = createAdminGetHandler(
  { operation: "finance.account-types" },
  getAccountTypeDistribution
);
