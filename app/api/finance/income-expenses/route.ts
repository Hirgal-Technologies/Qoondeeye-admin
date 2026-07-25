import { getIncomeExpenseTrend } from "@/features/analytics/finance/server/queries";
import { createAdminGetHandler } from "@/lib/api/admin-route";
import { parseDateRange, parseGranularity } from "@/lib/api/params";

export const GET = createAdminGetHandler(
  { operation: "finance.income-expenses" },
  (request) =>
    getIncomeExpenseTrend({
      ...parseDateRange(request),
      granularity: parseGranularity(request),
    })
);
