import "server-only";
import type { AdminIdentity } from "@/features/auth/contracts";
import { writeAuditLog } from "@/features/audit/server/audit-repository";
import { executeManualFulfillment } from "@/features/merchant-gateway/manual-fulfillment-flow";
import { callQoondeeyeAdmin } from "@/features/qoondeeye/admin-functions";
import { createRecharge } from "@/features/reseller/server/reseller-repository";
import { getAdminAccessToken } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const COPY = {
  completed: "Qoondeeye recorded the TopTayo transaction.",
  recording_pending:
    "Bundle purchase was submitted to TopTayo. Qoondeeye recording is still pending. Do not purchase again.",
  uncertain:
    "Reconciliation required. The TopTayo result is unknown, so another purchase was not sent.",
  claimed_ready: "Manual fulfillment claimed — ready to continue. No recharge was sent.",
  recording_unavailable:
    "No stored TopTayo transaction id was found. Refresh the order. Do not purchase again.",
  not_sent: "No recharge was sent.",
  begin_send_unconfirmed:
    "Qoondeeye did not confirm that sending started. No recharge was sent. Refresh before continuing.",
  invalid_request: "The manual fulfillment request was incomplete.",
  unauthenticated: "The admin session expired. No recharge was sent.",
} as const;

export type ManualFulfillmentResult =
  | {
      ok: true;
      state: "completed" | "recording_pending" | "uncertain" | "claimed_ready" | "not_sent";
      message: string;
      transactionId: string | null;
    }
  | { ok: false; status: number; message: string };

/**
 * Claim, begin-send, then one admin-server TopTayo recharge, then finalize.
 * Destination, bundle, and cost come from Qoondeeye. The browser body is only an order id.
 */
export async function runManualFulfillment(
  actor: AdminIdentity,
  rawBody: unknown,
): Promise<ManualFulfillmentResult> {
  const orderId = readOrderId(rawBody);
  if (!orderId) return { ok: false, status: 400, message: COPY.invalid_request };

  const retryRecording = readRetry(rawBody);
  const accessToken = await getAdminAccessToken();
  if (!accessToken) return { ok: false, status: 401, message: COPY.unauthenticated };

  let sent = false;
  const result = await executeManualFulfillment(
    {
      claim: (id) => callQoondeeyeAdmin(accessToken, "claim", { orderId: id }),
      beginSend: (id, claimId) =>
        callQoondeeyeAdmin(accessToken, "beginSend", { orderId: id, claimId }),
      createRecharge: async (purchase) => {
        if (sent) throw new Error("recharge_already_sent");
        sent = true;
        const recharge = await createRecharge(purchase);
        const transactionIds = Array.isArray(recharge.transactionIds)
          ? recharge.transactionIds
          : [];
        return { transactionIds };
      },
      finalize: async (id, transactionId) => {
        const call = await callQoondeeyeAdmin(accessToken, "finalize", {
          orderId: id,
          topTayoTransactionId: transactionId,
        });
        if (call.networkError || call.status !== 200 || !isRecord(call.body)) return "failed";
        return call.body.ok === true ? "recorded" : "failed";
      },
      uncertain: (id) => callQoondeeyeAdmin(accessToken, "uncertain", { orderId: id }).then(() => undefined),
      payerPhone: loadPayerPhone,
      rememberTransaction: (id, transactionId) =>
        writeAuditLog({
          actorId: actor.id,
          actorEmail: actor.email,
          actorRole: actor.role,
          action: "manual_fulfillment_toptayo_accepted",
          metadata: { outcome: "Accepted", orderId: id, transactionId },
        }),
      readPendingTransaction: readPendingTransaction,
    },
    { orderId, retryRecording },
  );

  const transactionId =
    result.kind === "completed" || result.kind === "recording_pending" ? result.transactionId : null;

  await writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: "manual_fulfillment_result",
    metadata: {
      outcome: result.kind,
      orderId,
      transactionId,
      retryRecording,
    },
  }).catch(() => undefined);

  if (result.kind === "not_sent") {
    return {
      ok: true,
      state: "not_sent",
      message: result.code === "begin_send_unconfirmed" ? COPY.begin_send_unconfirmed : COPY.not_sent,
      transactionId: null,
    };
  }
  if (result.kind === "recording_unavailable") {
    return { ok: true, state: "not_sent", message: COPY.recording_unavailable, transactionId: null };
  }
  if (result.kind === "claimed_ready") {
    return { ok: true, state: "claimed_ready", message: COPY.claimed_ready, transactionId: null };
  }
  if (result.kind === "uncertain") {
    return { ok: true, state: "uncertain", message: COPY.uncertain, transactionId: null };
  }
  return {
    ok: true,
    state: result.kind,
    message: COPY[result.kind],
    transactionId,
  };
}

async function loadPayerPhone(orderId: string) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("bundle_purchase_orders")
    .select("payer_phone")
    .eq("id", orderId)
    .maybeSingle();
  if (error || !data) return null;
  return typeof data.payer_phone === "string" ? data.payer_phone : null;
}

async function readPendingTransaction(orderId: string) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("audit_log")
    .select("metadata, created_at")
    .eq("action", "manual_fulfillment_toptayo_accepted")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return null;
  for (const row of data ?? []) {
    const metadata = isRecord(row.metadata) ? row.metadata : null;
    const storedOrderId = typeof metadata?.orderId === "string" ? metadata.orderId : "";
    const transactionId =
      typeof metadata?.transactionId === "string" ? metadata.transactionId.trim() : "";
    if (storedOrderId === orderId && transactionId) return transactionId;
  }
  return null;
}

function readOrderId(body: unknown) {
  if (!isRecord(body)) return null;
  const orderId = body.orderId;
  return typeof orderId === "string" && UUID_PATTERN.test(orderId) ? orderId : null;
}

function readRetry(body: unknown) {
  return isRecord(body) && body.retryRecording === true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
