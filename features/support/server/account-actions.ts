import "server-only";
import type {
  SupportAccountActionInput,
  SupportAccountActionResult,
} from "@/features/support/contracts";
import type { AdminIdentity } from "@/features/auth/contracts";
import { parseSupportAccountActionInput } from "@/features/support/validation";
import { toSupportUser } from "@/features/support/server/lookup-user";
import { writeAuditLog } from "@/features/audit/server/audit-repository";
import { createAdminClient } from "@/lib/supabase/admin";

// GoTrue represents "no ban" as ban_duration: 'none' and an indefinite ban as
// a very long duration string (there is no dedicated permanent-ban value).
const INDEFINITE_BAN_DURATION = "876000h";

export async function runSupportAccountAction(
  actor: AdminIdentity,
  rawInput: unknown
): Promise<SupportAccountActionResult> {
  const input = parseSupportAccountActionInput(rawInput);
  if (!input) return { ok: false, reason: "invalid_request" };

  const db = createAdminClient();
  const { data: existing, error: findError } = await db.auth.admin.getUserById(
    input.userId
  );
  if (findError || !existing.user) return { ok: false, reason: "not_found" };

  if (input.action === "reset_password") {
    if (!existing.user.email) return { ok: false, reason: "invalid_request" };
    const { error } = await db.auth.resetPasswordForEmail(existing.user.email);
    if (error) throw error;
    await recordAction(actor, input, existing.user.email);
    return { ok: true, user: toSupportUser(existing.user) };
  }

  const { data, error } = await db.auth.admin.updateUserById(input.userId, {
    ban_duration: input.action === "disable" ? INDEFINITE_BAN_DURATION : "none",
  });
  if (error || !data.user) throw error ?? new Error("account update failed");

  await recordAction(actor, input, existing.user.email);
  return { ok: true, user: toSupportUser(data.user) };
}

function recordAction(
  actor: AdminIdentity,
  input: SupportAccountActionInput,
  targetEmail?: string
) {
  const action =
    input.action === "disable"
      ? "support_user_disabled"
      : input.action === "enable"
        ? "support_user_enabled"
        : "support_password_reset_triggered";

  return writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    action,
    targetUserId: input.userId,
    metadata: { reason: input.reason, outcome: "Completed", targetEmail },
  });
}
