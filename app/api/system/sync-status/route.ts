import { getSyncStatus } from "@/features/analytics/system/server/queries";
import { createAdminGetHandler } from "@/lib/api/admin-route";

export const GET = createAdminGetHandler(
  { operation: "system.sync-status" },
  () => getSyncStatus()
);
