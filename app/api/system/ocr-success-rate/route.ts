import { getOcrSuccessRate } from "@/features/analytics/system/server/queries";
import { createAdminGetHandler } from "@/lib/api/admin-route";
import { parseDateRange } from "@/lib/api/params";

export const GET = createAdminGetHandler(
  { operation: "system.ocr-success-rate" },
  (request) => getOcrSuccessRate(parseDateRange(request))
);
