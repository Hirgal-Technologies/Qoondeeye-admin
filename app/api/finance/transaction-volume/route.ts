import { getTransactionVolume } from "@/features/analytics/finance/server/queries";
import { createAdminGetHandler } from "@/lib/api/admin-route";
import {
  parseDateRange,
  parseGranularity,
  parseTransactionType,
} from "@/lib/api/params";

export const GET = createAdminGetHandler(
  { operation: "finance.transaction-volume" },
  (request) =>
    getTransactionVolume({
      ...parseDateRange(request),
      granularity: parseGranularity(request),
      type: parseTransactionType(request),
    })
);
