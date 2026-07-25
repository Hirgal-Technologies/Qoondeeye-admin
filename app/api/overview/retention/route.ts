import { getRetentionCurve } from "@/features/analytics/overview/server/queries";
import { createAdminGetHandler } from "@/lib/api/admin-route";
import { parseBoundedInteger } from "@/lib/api/params";

export const GET = createAdminGetHandler(
  { operation: "overview.retention" },
  (request) =>
    getRetentionCurve(
      parseBoundedInteger(request, "cohortWindow", 30, { min: 1, max: 365 })
    )
);
