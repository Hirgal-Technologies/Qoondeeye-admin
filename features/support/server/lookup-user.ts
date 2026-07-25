import "server-only";
import type {
  SupportLookupInput,
  SupportLookupResult,
  SupportUser,
} from "@/features/support/contracts";
import type { AdminIdentity } from "@/features/auth/contracts";
import { isUuid, parseSupportLookupInput } from "@/features/support/validation";
import { findAuthUserByEmail } from "@/features/admin-users/server/admin-users-repository";
import { writeAuditLog } from "@/features/audit/server/audit-repository";
import { createAdminClient } from "@/lib/supabase/admin";
import type { User } from "@supabase/supabase-js";

export async function lookupSupportUser(
  actor: AdminIdentity,
  rawInput: unknown
): Promise<SupportLookupResult> {
  const input = parseSupportLookupInput(rawInput);
  if (!input) return { ok: false, reason: "invalid_request" };

  const db = createAdminClient();
  let authUser: User | null = null;

  if (isUuid(input.identifier)) {
    const { data } = await db.auth.admin.getUserById(input.identifier);
    authUser = data.user ?? null;
  } else {
    authUser = await findAuthUserByEmail(input.identifier.toLowerCase());
  }

  if (!authUser) {
    await recordLookup(actor, input, "Not found");
    return { ok: false, reason: "not_found" };
  }

  await recordLookup(actor, input, "Completed");

  return { ok: true, user: toSupportUser(authUser) };
}

export function toSupportUser(user: User): SupportUser {
  const bannedUntil = user.banned_until ?? null;
  return {
    id: user.id,
    email: user.email ?? "Unavailable",
    createdAt: user.created_at,
    lastSignInAt: user.last_sign_in_at ?? null,
    providers: (user.identities ?? []).map((identity) => identity.provider).filter(Boolean),
    bannedUntil,
    isBanned: bannedUntil !== null && new Date(bannedUntil).getTime() > Date.now(),
  };
}

function recordLookup(
  actor: AdminIdentity,
  input: SupportLookupInput,
  outcome: "Completed" | "Not found"
) {
  return writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: "support_user_lookup",
    targetUserId: isUuid(input.identifier) ? input.identifier : undefined,
    metadata: { reason: input.reason, outcome, identifier: input.identifier },
  });
}
