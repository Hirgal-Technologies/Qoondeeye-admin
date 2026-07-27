import { getActiveUsers } from "@/features/analytics/users/server/queries";
import { createAdminGetHandler } from "@/lib/api/admin-route";
import { parseBoundedInteger, parseDateRange } from "@/lib/api/params";

export const GET = createAdminGetHandler(
  { operation: "users.active", minimumRole: "support" },
  (request) =>
    getActiveUsers({
      ...parseDateRange(request),
      limit: parseBoundedInteger(request, "limit", 100, { min: 1, max: 500 }),
    })
);
