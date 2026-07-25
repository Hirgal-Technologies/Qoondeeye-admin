import { getCohortRetention } from "@/features/analytics/users/server/queries";
import { createAdminGetHandler } from "@/lib/api/admin-route";
import { parseDateRange } from "@/lib/api/params";

export const GET = createAdminGetHandler(
  { operation: "users.cohort-retention" },
  (request) => getCohortRetention(parseDateRange(request, 60))
);
