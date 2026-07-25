import { getSyncHealth } from "@/features/analytics/system/server/queries";
import { createAdminGetHandler } from "@/lib/api/admin-route";
import { parseDateRange } from "@/lib/api/params";

export const GET = createAdminGetHandler(
  { operation: "system.sync-health" },
  (request) => getSyncHealth(parseDateRange(request))
);
