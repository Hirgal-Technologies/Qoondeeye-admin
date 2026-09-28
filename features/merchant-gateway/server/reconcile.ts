import "server-only";
import type { ReconciliationRequest, ReconciliationResult } from "@/features/merchant-gateway/contracts";
import { createAdminClient } from "@/lib/supabase/admin";

export type ReconcileCallResult =
  | { ok: true; result: ReconciliationResult }
  | { ok: false; status: number; code: string; message?: string };

/**
 * Forwards an admin session token to the backend reconciliation function.
 * The request body never includes an admin id or email. TopTayo is not called.
 */
export async function reconcileMerchantPayment(
  accessToken: string,
  request: ReconciliationRequest,
): Promise<ReconcileCallResult> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_KEY;
  if (!supabaseUrl || !anonKey) {
    return { ok: false, status: 500, code: "invalid_request", message: "Supabase is not configured." };
  }

  const body: ReconciliationRequest = {
    eventId: request.eventId,
    orderId: request.orderId,
    allowPayerMismatch: request.allowPayerMismatch,
    allowExpiredOrder: request.allowExpiredOrder,
  };
  if (request.reason) body.reason = request.reason;

  let response: Response;
  try {
    response = await fetch(`${supabaseUrl}/functions/v1/bundles-merchant-reconcile`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        apikey: anonKey,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    return { ok: false, status: 502, code: "unavailable" };
  }

  const payload = (await response.json().catch(() => null)) as unknown;
  const record = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
  if (record?.ok === true) {
    const result = toResult(record);
    if (!result) return { ok: false, status: 502, code: "invalid_response" };
    const orderState = await readOrderState(request.orderId);
    return { ok: true, result: { ...result, ...orderState } };
  }

  const code =
    typeof record?.code === "string"
      ? record.code
      : typeof record?.error === "string"
        ? record.error
        : response.status === 401
          ? "unauthenticated"
          : response.status === 403
            ? "forbidden"
            : "rejected";
  const message = typeof record?.message === "string" ? record.message : undefined;
  const status = response.status >= 400 && response.status < 500 ? response.status : 400;
  return { ok: false, status, code, message };
}

function toResult(record: Record<string, unknown>): Omit<
  ReconciliationResult,
  "orderFulfillmentStatus" | "orderPaymentStatus"
> | null {
  if (typeof record.eventId !== "string" || typeof record.orderId !== "string") return null;
  return {
    ok: true,
    idempotent: record.idempotent === true,
    eventId: record.eventId,
    orderId: record.orderId,
    matchStatus: typeof record.matchStatus === "string" ? record.matchStatus : "MATCHED",
    resolutionType: typeof record.resolutionType === "string" ? record.resolutionType : "",
    auditId: typeof record.auditId === "string" ? record.auditId : "",
    fulfillment: typeof record.fulfillment === "string" ? record.fulfillment : "",
  };
}

async function readOrderState(orderId: string) {
  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from("bundle_purchase_orders")
      .select("fulfillment_status, payment_status")
      .eq("id", orderId)
      .maybeSingle();
    if (error || !data) {
      return { orderFulfillmentStatus: null, orderPaymentStatus: null };
    }
    const row = data as { fulfillment_status?: string | null; payment_status?: string | null };
    return {
      orderFulfillmentStatus: row.fulfillment_status ?? null,
      orderPaymentStatus: row.payment_status ?? null,
    };
  } catch {
    return { orderFulfillmentStatus: null, orderPaymentStatus: null };
  }
}
