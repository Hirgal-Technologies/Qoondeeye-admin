import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { AdminIdentity, AdminRole } from "@/features/auth/contracts";
import { hasMinimumRole } from "@/lib/permissions";

export type { AdminIdentity, AdminRole } from "@/features/auth/contracts";

/**
 * Resolves the current request's admin identity, if any.
 * Two checks: confirm a valid Supabase Auth session, and confirm that user
 * exists in admin_users (auth alone does not grant dashboard access).
 * Memoized per request (React.cache), so a layout and page that both check
 * the session share one lookup; nothing is shared between requests.
 *
 * Uses the session-bound (anon-key) client, not the service-role client:
 * the admin_users RLS policy ("id = auth.uid() OR caller is an admin")
 * lets a signed-in user read their own row, so this path works even before
 * SUPABASE_SERVICE_ROLE_KEY is configured. Aggregate analytics queries in
 * Server-only feature query modules require the service-role key — RLS blocks
 * anon-key reads across other users' rows, and there's no way around that
 * without it.
 */
export const getAdminSession = cache(async (): Promise<AdminIdentity | null> => {
  const supabase = await createClient();

  // Each step is a Supabase round trip, so run them together: the roster
  // lookup is keyed on the user id claimed by the session cookie's token, and
  // only counts if Auth then verifies that same user. PostgREST checks the
  // token's signature and RLS scopes the row, so a forged token reads nothing.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const claimedUserId = tokenSubject(session?.access_token);
  if (!claimedUserId) return null;

  const [{ data: userData }, { data: adminRow }] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("admin_users")
      .select("id, email, role")
      .eq("id", claimedUserId)
      .maybeSingle(),
  ]);

  const user = userData.user;
  if (!user || !user.email || user.id !== claimedUserId) return null;
  if (!adminRow || adminRow.id !== user.id) return null;

  return { id: adminRow.id, email: adminRow.email, role: adminRow.role as AdminRole };
});

/** Reads `sub` from a JWT without trusting it; callers must verify the user. */
function tokenSubject(accessToken: string | undefined) {
  const payload = accessToken?.split(".")[1];
  if (!payload) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      sub?: unknown;
    };
    return typeof claims.sub === "string" && claims.sub ? claims.sub : null;
  } catch {
    return null;
  }
}

export async function getAdminAccessToken() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  return typeof token === "string" && token.length > 0 ? token : null;
}

export function hasRole(identity: AdminIdentity, minRole: AdminRole) {
  return hasMinimumRole(identity.role, minRole);
}
