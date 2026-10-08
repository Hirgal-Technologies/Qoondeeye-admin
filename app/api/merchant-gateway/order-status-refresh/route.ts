import type { NextRequest } from "next/server";
import { writeAuditLog } from "@/features/audit/server/audit-repository";
import { callQoondeeyeAdmin } from "@/features/qoondeeye/admin-functions";
import { apiFailure, apiSuccess } from "@/lib/api/responses";
import { getAdminAccessToken } from "@/lib/auth/session";
import { requireAdmin } from "@/lib/auth/require";

const ORDER_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Asks Qoondeeye to read stored TopTayo transaction ids.
 * This route does not call the reseller recharge API.
 */
export async function POST(request: NextRequest) {
  const { identity, response } = await requireAdmin("admin");
  if (response) return response;

  const body = (await request.json().catch(() => null)) as { orderId?: unknown } | null;
  const orderId = typeof body?.orderId === "string" ? body.orderId.trim() : "";
  if (!ORDER_ID.test(orderId)) {
    return apiFailure("A valid order id is required. Nothing was changed.", 400);
  }

  const accessToken = await getAdminAccessToken();
  if (!accessToken) return apiFailure("The admin session expired. Nothing was changed.", 401);

  const call = await callQoondeeyeAdmin(accessToken, "orderStatusRefresh", { orderId });
  if (call.networkError) {
    return apiFailure(
      "Qoondeeye could not be reached. The order was not changed and no recharge was sent.",
      502,
    );
  }
  const record =
    call.body && typeof call.body === "object" ? (call.body as Record<string, unknown>) : null;
  if (!record || record.ok !== true) {
    const message =
      record && typeof record.message === "string"
        ? record.message
        : "TopTayo status could not be checked. The order was not changed and no recharge was sent.";
    return apiFailure(message, call.status >= 400 ? call.status : 502);
  }

  await writeAuditLog({
    actorId: identity.id,
    actorEmail: identity.email,
    actorRole: identity.role,
    action: "order_status_refresh",
    metadata: {
      orderId,
      code: typeof record.code === "string" ? record.code : null,
      changed: record.changed === true,
      fulfillmentStatus:
        typeof record.fulfillmentStatus === "string" ? record.fulfillmentStatus : null,
    },
  }).catch(() => undefined);

  return apiSuccess({
    changed: record.changed === true,
    code: typeof record.code === "string" ? record.code : "unchanged",
    fulfillmentStatus:
      typeof record.fulfillmentStatus === "string" ? record.fulfillmentStatus : null,
    message: typeof record.message === "string" ? record.message : "TopTayo status was checked.",
  });
}
