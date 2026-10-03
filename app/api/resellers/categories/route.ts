import { listCategories } from "@/features/reseller/server/reseller-repository";
import { createAdminGetHandler } from "@/lib/api/admin-route";
import { parseBoundedInteger } from "@/lib/api/params";
import { ApiError } from "@/lib/api/responses";
import { isToptayoId } from "@/features/reseller/validation";

function parseToptayoId(value: string | null) {
  const id = value?.trim();
  if (!id) return undefined;
  if (!isToptayoId(id)) throw new ApiError(400, "invalid TopTayo id");
  return id;
}

export const GET = createAdminGetHandler(
  {
    operation: "resellers.categories.list",
    minimumRole: "support",
    cacheTtlMs: 30_000,
  },
  (request) => {
    const searchParams = request.nextUrl.searchParams;
    return listCategories({
      providerId: parseToptayoId(searchParams.get("providerId")),
      q: searchParams.get("q")?.trim() || undefined,
      cursor: searchParams.get("cursor")?.trim() || undefined,
      limit: parseBoundedInteger(request, "limit", 20, { min: 1, max: 50 }),
    });
  },
);
