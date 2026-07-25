import { getSignupTrend } from "@/features/analytics/users/server/queries";
import { createAdminGetHandler } from "@/lib/api/admin-route";
import { parseDateRange, parseGranularity } from "@/lib/api/params";

export const GET = createAdminGetHandler(
  { operation: "users.signups" },
  (request) =>
    getSignupTrend({
      ...parseDateRange(request),
      granularity: parseGranularity(request),
    })
);
