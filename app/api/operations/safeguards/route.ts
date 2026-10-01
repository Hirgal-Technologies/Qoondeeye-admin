import { getProductionSafeguardView } from "@/features/operations/server/safeguards";
import { createAdminGetHandler } from "@/lib/api/admin-route";

export const GET = createAdminGetHandler(
  {
    operation: "operations.safeguards",
    minimumRole: "admin",
    cacheTtlMs: 0,
  },
  () => getProductionSafeguardView(),
);
