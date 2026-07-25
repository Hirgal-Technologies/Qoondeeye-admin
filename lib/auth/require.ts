import "server-only";
import type { AdminRole } from "@/features/auth/contracts";
import { apiFailure } from "@/lib/api/responses";
import { getAdminSession, hasRole } from "@/lib/auth/session";

/**
 * Route Handler guard. Returns the caller's admin identity, or a ready-to-return
 * NextResponse (401/403) if the caller doesn't qualify.
 */
export async function requireAdmin(minRole: AdminRole = "viewer") {
  const identity = await getAdminSession();

  if (!identity) {
    return {
      identity: null,
      response: apiFailure("unauthorized", 401),
    } as const;
  }

  if (!hasRole(identity, minRole)) {
    return {
      identity: null,
      response: apiFailure("forbidden", 403),
    } as const;
  }

  return { identity, response: null } as const;
}
