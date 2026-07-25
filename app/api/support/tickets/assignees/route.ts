import { getAssignableAdmins } from "@/features/support-tickets/server/support-tickets-repository";
import { createAdminGetHandler } from "@/lib/api/admin-route";

export const GET = createAdminGetHandler(
  { operation: "support.tickets.assignees", minimumRole: "support", cacheTtlMs: 30_000 },
  () => getAssignableAdmins()
);
