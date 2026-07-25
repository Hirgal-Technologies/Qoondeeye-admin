import { getSupportAuditEvents } from "@/features/audit/server/audit-repository";
import { createAdminGetHandler } from "@/lib/api/admin-route";

export const GET = createAdminGetHandler(
  { operation: "support.activity", minimumRole: "support", cacheTtlMs: 0 },
  () => getSupportAuditEvents(15)
);
