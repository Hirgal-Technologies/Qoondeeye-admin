import { getAuthMethodBreakdown } from "@/features/analytics/users/server/queries";
import { createAdminGetHandler } from "@/lib/api/admin-route";

export const GET = createAdminGetHandler(
  { operation: "users.auth-methods" },
  getAuthMethodBreakdown
);
