import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AdminIdentity, AdminRole } from "@/features/auth/contracts";
import { hasMinimumRole } from "@/lib/permissions";

export type { AdminIdentity, AdminRole } from "@/features/auth/contracts";

/**
 * Resolves the current request's admin identity, if any.
 * Two-step: confirm a valid Supabase Auth session, then confirm that user
 * exists in admin_users (auth alone does not grant dashboard access).
 *
 * Uses the session-bound (anon-key) client, not the service-role client:
 * the admin_users RLS policy ("id = auth.uid() OR caller is an admin")
 * lets a signed-in user read their own row, so this path works even before
 * SUPABASE_SERVICE_ROLE_KEY is configured. Aggregate analytics queries in
 * Server-only feature query modules require the service-role key — RLS blocks
 * anon-key reads across other users' rows, and there's no way around that
 * without it.
 */
export async function getAdminSession(): Promise<AdminIdentity | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) return null;

  const { data: adminRow } = await supabase
    .from("admin_users")
    .select("id, email, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!adminRow) return null;

  return { id: adminRow.id, email: adminRow.email, role: adminRow.role as AdminRole };
}

export function hasRole(identity: AdminIdentity, minRole: AdminRole) {
  return hasMinimumRole(identity.role, minRole);
}
