import { listTransactions } from "@/features/reseller/server/reseller-repository";
import { createAdminGetHandler } from "@/lib/api/admin-route";
import { parseBoundedInteger } from "@/lib/api/params";

export const GET = createAdminGetHandler(
  {
    operation: "resellers.transactions.list",
    minimumRole: "admin",
    cacheTtlMs: 0,
  },
  (request) => {
    const searchParams = request.nextUrl.searchParams;
    return listTransactions({
      q: searchParams.get("q")?.trim() || undefined,
      cursor: searchParams.get("cursor")?.trim() || undefined,
      limit: parseBoundedInteger(request, "limit", 20, { min: 1, max: 50 }),
    });
  },
);
