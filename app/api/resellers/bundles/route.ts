import { listBundles } from "@/features/reseller/server/reseller-repository";
import { createAdminGetHandler } from "@/lib/api/admin-route";
import { parseBoundedInteger } from "@/lib/api/params";

export const GET = createAdminGetHandler(
  {
    operation: "resellers.bundles.list",
    minimumRole: "support",
    cacheTtlMs: 30_000,
  },
  (request) => {
    const searchParams = request.nextUrl.searchParams;
    return listBundles({
      providerId: searchParams.get("providerId")?.trim() || undefined,
      categoryId: searchParams.get("categoryId")?.trim() || undefined,
      q: searchParams.get("q")?.trim() || undefined,
      cursor: searchParams.get("cursor")?.trim() || undefined,
      limit: parseBoundedInteger(request, "limit", 20, { min: 1, max: 50 }),
    });
  },
);
