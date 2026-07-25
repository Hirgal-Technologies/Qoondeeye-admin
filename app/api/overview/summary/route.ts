import { getOverviewSummary } from "@/features/analytics/overview/server/queries";
import { createAdminGetHandler } from "@/lib/api/admin-route";

export const GET = createAdminGetHandler(
  { operation: "overview.summary" },
  getOverviewSummary
);
