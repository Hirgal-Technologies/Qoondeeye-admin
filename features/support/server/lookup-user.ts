import "server-only";
import type {
  SupportLookupInput,
  SupportLookupResult,
} from "@/features/support/contracts";
import type { AdminIdentity } from "@/features/auth/contracts";
import { parseSupportLookupInput } from "@/features/support/validation";
import { writeAuditLog } from "@/features/audit/server/audit-repository";
import { createAdminClient } from "@/lib/supabase/admin";

export async function lookupSupportUser(
  actor: AdminIdentity,
  rawInput: unknown
): Promise<SupportLookupResult> {
  const input = parseSupportLookupInput(rawInput);
  if (!input) return { ok: false, reason: "invalid_request" };

  const db = createAdminClient();
  const { data, error } = await db.auth.admin.getUserById(input.userId);
  if (error || !data.user) {
    await recordLookup(actor, input, "Not found");
    return { ok: false, reason: "not_found" };
  }

  await recordLookup(actor, input, "Completed");

  return {
    ok: true,
    user: {
      id: data.user.id,
      email: data.user.email ?? "Unavailable",
      createdAt: data.user.created_at,
      lastSignInAt: data.user.last_sign_in_at ?? null,
      providers: (data.user.identities ?? [])
        .map((identity) => identity.provider)
        .filter(Boolean),
    },
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
    targetUserId: input.userId,
    metadata: { reason: input.reason, outcome },
  });
}
