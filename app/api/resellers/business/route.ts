import { getBusiness } from "@/features/reseller/server/reseller-repository";
import { createAdminGetHandler } from "@/lib/api/admin-route";

export const GET = createAdminGetHandler(
  {
    operation: "resellers.business.get",
    minimumRole: "support",
    cacheTtlMs: 15_000,
  },
  () => getBusiness(),
);
