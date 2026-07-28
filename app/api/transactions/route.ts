import { getTransactions } from "@/features/transactions/server/transactions-repository";
import { createAdminGetHandler } from "@/lib/api/admin-route";
import { parseBoundedInteger, parseDateRange } from "@/lib/api/params";

export const GET = createAdminGetHandler(
  {
    operation: "transactions.list",
    minimumRole: "admin",
    cacheTtlMs: 0,
  },
  (request) => {
    const searchParams = request.nextUrl.searchParams;
    return getTransactions({
      ...parseDateRange(request),
      page: parseBoundedInteger(request, "page", 1, { min: 1, max: 10_000 }),
      pageSize: parseBoundedInteger(request, "pageSize", 50, {
        min: 10,
        max: 100,
      }),
      search: searchParams.get("search")?.trim() || undefined,
      userId: searchParams.get("userId")?.trim() || undefined,
      type: searchParams.get("type")?.trim() || undefined,
    });
  },
);
