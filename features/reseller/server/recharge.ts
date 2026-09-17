import "server-only";
import type { AdminIdentity } from "@/features/auth/contracts";
import { writeAuditLog } from "@/features/audit/server/audit-repository";
import { createRecharge } from "@/features/reseller/server/reseller-repository";
import { parseRechargeInput } from "@/features/reseller/validation";
import { ToptayoApiError } from "@/lib/toptayo/client";

export type RunRechargeResult =
  | { ok: true; message: string; transactionIds: string[] }
  | { ok: false; reason: "invalid_request" }
  | { ok: false; reason: "upstream_error"; status: number; message: string };

export async function runRecharge(
  actor: AdminIdentity,
  rawInput: unknown,
): Promise<RunRechargeResult> {
  const input = parseRechargeInput(rawInput);
  if (!input) return { ok: false, reason: "invalid_request" };

  try {
    const result = await createRecharge(input);

    await writeAuditLog({
      actorId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: "reseller_recharge_created",
      metadata: {
        outcome: "Completed",
        sender: input.sender,
        receiver: input.receiver,
        bundleId: input.bundleId,
        transactionIds: result.transactionIds,
      },
    });

    return { ok: true, message: result.message, transactionIds: result.transactionIds };
  } catch (error) {
    const status = error instanceof ToptayoApiError ? error.status : 500;
    const message =
      error instanceof ToptayoApiError
        ? error.message
        : "The recharge could not be completed.";

    await writeAuditLog({
      actorId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: "reseller_recharge_failed",
      metadata: {
        outcome: `Failed (${status})`,
        sender: input.sender,
        receiver: input.receiver,
        bundleId: input.bundleId,
        error: message,
      },
    });

    return { ok: false, reason: "upstream_error", status, message };
  }
}
