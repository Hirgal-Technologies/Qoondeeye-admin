import "server-only";
import { NextResponse } from "next/server";
import { getAdminSession, hasRole, type AdminRole } from "@/lib/auth/session";

/**
 * Route Handler guard. Returns the caller's admin identity, or a ready-to-return
 * NextResponse (401/403) if the caller doesn't qualify.
 */
export async function requireAdmin(minRole: AdminRole = "viewer") {
  const identity = await getAdminSession();

  if (!identity) {
    return {
      identity: null,
      response: NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 }),
    } as const;
  }

  if (!hasRole(identity, minRole)) {
    return {
      identity: null,
      response: NextResponse.json({ data: null, error: "forbidden" }, { status: 403 }),
    } as const;
  }

  return { identity, response: null } as const;
}
