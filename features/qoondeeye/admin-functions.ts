import "server-only";

export type QoondeeyeCall = {
  status: number;
  body: unknown;
  networkError: boolean;
};

const FUNCTION_NAMES = {
  productionStatus: "bundles-admin-production-status",
  claim: "bundles-admin-manual-fulfillment-claim",
  beginSend: "bundles-admin-manual-fulfillment-begin-send",
  finalize: "bundles-admin-manual-fulfillment-finalize",
  uncertain: "bundles-admin-manual-fulfillment-uncertain",
  revokeGateway: "bundles-admin-gateway-revoke",
  preproductionCleanup: "bundles-admin-preproduction-cleanup",
  orderStatusRefresh: "bundles-admin-order-status-refresh",
} as const;

export type QoondeeyeAdminFunction = keyof typeof FUNCTION_NAMES;

/**
 * Forwards the signed-in admin JWT. The body never includes an admin id.
 */
export async function callQoondeeyeAdmin(
  accessToken: string,
  name: QoondeeyeAdminFunction,
  body: Record<string, unknown> = {},
): Promise<QoondeeyeCall> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_KEY;
  if (!supabaseUrl || !anonKey || !accessToken) {
    return { status: 500, body: { ok: false, code: "not_configured" }, networkError: false };
  }

  const payload = { ...body };
  delete payload.adminUserId;
  delete payload.adminEmail;
  delete payload.sender;
  delete payload.receiver;
  delete payload.destination;
  delete payload.bundleId;
  delete payload.cost;

  let response: Response;
  try {
    response = await fetch(`${supabaseUrl}/functions/v1/${FUNCTION_NAMES[name]}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        apikey: anonKey,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
  } catch {
    return { status: 502, body: null, networkError: true };
  }

  const parsed = (await response.json().catch(() => null)) as unknown;
  return { status: response.status, body: parsed, networkError: false };
}
