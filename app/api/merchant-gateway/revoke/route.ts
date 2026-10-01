import type { NextRequest } from "next/server";
import { writeAuditLog } from "@/features/audit/server/audit-repository";
import { publicRevokeBody } from "@/features/merchant-gateway/manual-fulfillment-flow";
import { callQoondeeyeAdmin } from "@/features/qoondeeye/admin-functions";
import { apiFailure, apiSuccess } from "@/lib/api/responses";
import { getAdminAccessToken } from "@/lib/auth/session";
import { requireAdmin } from "@/lib/auth/require";

const DEVICE_ID = /^[a-zA-Z0-9._-]{2,64}$/;

export async function POST(request: NextRequest) {
  const { identity, response } = await requireAdmin("admin");
  if (response) return response;

  const body = await request.json().catch(() => null);
  const deviceId =
    body && typeof body === "object" && typeof (body as { deviceId?: unknown }).deviceId === "string"
      ? (body as { deviceId: string }).deviceId.trim()
      : "";
  if (!DEVICE_ID.test(deviceId)) {
    return apiFailure("That device id is not valid.", 400);
  }

  const accessToken = await getAdminAccessToken();
  if (!accessToken) return apiFailure("The admin session expired. The gateway was not revoked.", 401);

  const call = await callQoondeeyeAdmin(accessToken, "revokeGateway", publicRevokeBody(deviceId));
  if (call.networkError) {
    return apiFailure("Qoondeeye could not be reached. The gateway was not revoked.", 502);
  }
  if (call.status === 404) return apiFailure("That gateway was not found.", 404);
  const record =
    call.body && typeof call.body === "object" ? (call.body as { ok?: unknown; status?: unknown }) : null;
  if (call.status !== 200 || record?.ok !== true || record.status !== "revoked") {
    return apiFailure("Qoondeeye did not revoke the gateway.", 502);
  }

  await writeAuditLog({
    actorId: identity.id,
    actorEmail: identity.email,
    actorRole: identity.role,
    action: "merchant_gateway_revoked",
    metadata: { outcome: "Revoked", deviceId },
  }).catch(() => undefined);

  return apiSuccess({ deviceId, status: "revoked" as const });
}
