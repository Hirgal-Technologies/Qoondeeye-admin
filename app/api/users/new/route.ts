import { getNewUsers } from "@/features/analytics/users/server/queries";
import { createAdminGetHandler } from "@/lib/api/admin-route";
import { parseBoundedInteger, parseDateRange } from "@/lib/api/params";

// Roster endpoints return account identifiers, so they sit behind the same
// role gate as the support tools rather than the viewer-level aggregates.
export const GET = createAdminGetHandler(
  { operation: "users.new", minimumRole: "support" },
  (request) =>
    getNewUsers({
      ...parseDateRange(request),
      limit: parseBoundedInteger(request, "limit", 100, { min: 1, max: 500 }),
    })
);
