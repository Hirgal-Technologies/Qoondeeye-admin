import { getBudgetAdherence } from "@/features/analytics/finance/server/queries";
import { createAdminGetHandler } from "@/lib/api/admin-route";
import { parseDateRange } from "@/lib/api/params";

export const GET = createAdminGetHandler(
  { operation: "finance.budget-adherence" },
  (request) => getBudgetAdherence(parseDateRange(request))
);
