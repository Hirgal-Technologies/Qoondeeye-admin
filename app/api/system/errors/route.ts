import { getRecentErrors } from "@/features/analytics/system/server/queries";
import { createAdminGetHandler } from "@/lib/api/admin-route";
import { parseBoundedInteger, parseDateRange } from "@/lib/api/params";

export const GET = createAdminGetHandler(
  { operation: "system.errors" },
  (request) =>
    getRecentErrors({
      ...parseDateRange(request),
      limit: parseBoundedInteger(request, "limit", 100, {
        min: 1,
        max: 500,
      }),
    })
);
