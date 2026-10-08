import type { NextRequest } from "next/server";
import { writeAuditLog } from "@/features/audit/server/audit-repository";
import { parsePreproductionCleanupRequest } from "@/features/merchant-gateway/preproduction-cleanup";
import { callQoondeeyeAdmin } from "@/features/qoondeeye/admin-functions";
import { apiFailure, apiSuccess } from "@/lib/api/responses";
import { getAdminAccessToken } from "@/lib/auth/session";
import { requireAdmin } from "@/lib/auth/require";

export async function POST(request: NextRequest) {
  const { identity, response } = await requireAdmin("admin");
  if (response) return response;

  const parsed = parsePreproductionCleanupRequest(await request.json().catch(() => null));
  if (!parsed.ok) return apiFailure(parsed.message, 400);

  const accessToken = await getAdminAccessToken();
  if (!accessToken) return apiFailure("The admin session expired. Nothing was changed.", 401);

  const call = await callQoondeeyeAdmin(accessToken, "preproductionCleanup", parsed.value);
  if (call.networkError) {
    return apiFailure("Qoondeeye could not be reached. Nothing was changed.", 502);
  }
  const record = call.body && typeof call.body === "object" ? (call.body as Record<string, unknown>) : null;
  if (!record || record.ok !== true || call.status !== 200) {
    const message =
      record && typeof record.message === "string"
        ? record.message
        : "Qoondeeye did not accept the cleanup. Nothing was changed.";
    return apiFailure(message, call.status >= 400 ? call.status : 502);
  }

  await writeAuditLog({
    actorId: identity.id,
    actorEmail: identity.email,
    actorRole: identity.role,
    action: parsed.value.apply ? "preproduction_cleanup_applied" : "preproduction_cleanup_preview",
    metadata: {
      outcome: parsed.value.apply ? "Applied" : "Preview",
      protectedDeviceId: parsed.value.protectedDeviceId,
      cutoffAt: parsed.value.cutoffAt,
      counts: record.counts ?? null,
    },
  }).catch(() => undefined);

  return apiSuccess(record);
}
