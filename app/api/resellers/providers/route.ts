import { listProviders } from "@/features/reseller/server/reseller-repository";
import { createAdminGetHandler } from "@/lib/api/admin-route";
import { parseBoundedInteger } from "@/lib/api/params";

export const GET = createAdminGetHandler(
  {
    operation: "resellers.providers.list",
    minimumRole: "support",
    cacheTtlMs: 30_000,
  },
  (request) => {
    const searchParams = request.nextUrl.searchParams;
    return listProviders({
      q: searchParams.get("q")?.trim() || undefined,
      cursor: searchParams.get("cursor")?.trim() || undefined,
      limit: parseBoundedInteger(request, "limit", 20, { min: 1, max: 50 }),
    });
  },
);
