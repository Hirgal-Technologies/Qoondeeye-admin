import { getAuditLogs } from "@/features/audit/server/audit-repository";
import { createAdminGetHandler } from "@/lib/api/admin-route";
import { parseBoundedInteger } from "@/lib/api/params";

export const GET = createAdminGetHandler(
  { operation: "audit.logs", minimumRole: "admin", cacheTtlMs: 0 },
  (request) =>
    getAuditLogs(
      parseBoundedInteger(request, "limit", 100, { min: 1, max: 500 })
    )
);
