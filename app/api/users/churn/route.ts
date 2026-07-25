import { getChurn } from "@/features/analytics/users/server/queries";
import { createAdminGetHandler } from "@/lib/api/admin-route";
import { parseBoundedInteger } from "@/lib/api/params";

export const GET = createAdminGetHandler(
  { operation: "users.churn" },
  (request) =>
    getChurn(
      parseBoundedInteger(request, "inactiveDays", 30, { min: 1, max: 365 })
    )
);
