import { getActiveUsersTrend } from "@/features/analytics/overview/server/queries";
import { createAdminGetHandler } from "@/lib/api/admin-route";
import { parseDateRange } from "@/lib/api/params";

export const GET = createAdminGetHandler(
  { operation: "overview.active-users" },
  (request) => getActiveUsersTrend(parseDateRange(request))
);
