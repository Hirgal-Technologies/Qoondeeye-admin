/**
 * Coordinates Qoondeeye claim → begin-send → one TopTayo recharge → finalize.
 * Network clients are injected so tests never call TopTayo.
 * A recharge runs only after begin-send returns HTTP 200 and sendAuthorized true.
 */

export type AdminCall = {
  status: number;
  body: unknown;
  networkError?: boolean;
};

export type PurchaseRequest = {
  sender: number;
  receiver: number;
  bundleId: string;
};

export type ManualFlowDeps = {
  claim: (orderId: string) => Promise<AdminCall>;
  beginSend: (orderId: string, claimId: string) => Promise<AdminCall>;
  createRecharge: (purchase: PurchaseRequest) => Promise<{ transactionIds: string[] }>;
  finalize: (orderId: string, transactionId: string) => Promise<"recorded" | "failed">;
  uncertain: (orderId: string) => Promise<void>;
  payerPhone: (orderId: string) => Promise<string | null>;
  rememberTransaction: (orderId: string, transactionId: string) => Promise<void>;
  readPendingTransaction: (orderId: string) => Promise<string | null>;
};

export type ManualFlowResult =
  | { kind: "not_sent"; code: string }
  | {
      kind: "claimed_ready";
      claimId: string;
      destination: string;
      bundleId: string;
      rechargeCostCents: number;
    }
  | { kind: "completed"; transactionId: string }
  | { kind: "recording_pending"; transactionId: string }
  | { kind: "uncertain" }
  | { kind: "recording_unavailable" };

type ClaimReady = {
  claimId: string;
  destination: string;
  providerId: string;
  bundleId: string;
  rechargeCostCents: number;
};

type SendReady = ClaimReady;

export function toRechargeHandset(value: string | null | undefined): number | null {
  const digits = (value ?? "").replace(/\D/g, "");
  const national = digits.startsWith("252") && digits.length === 12 ? digits.slice(3) : digits;
  if (!/^[1-9][0-9]{5,14}$/.test(national)) return null;
  const number = Number(national);
  if (!Number.isSafeInteger(number) || number <= 0) return null;
  return number;
}

export function parseClaim(call: AdminCall): { ok: true; claim: ClaimReady } | { ok: false; code: string } {
  if (call.networkError || call.status !== 200) {
    return { ok: false, code: codeOf(call.body) ?? "claim_failed" };
  }
  const record = asRecord(call.body);
  if (!record || record.ok !== true || record.sendAuthorized !== false) {
    return { ok: false, code: codeOf(call.body) ?? "claim_failed" };
  }
  if (record.reservationOutcome !== "manual_claimed") {
    return { ok: false, code: "claim_failed" };
  }
  const claimId = stringField(record.claimId);
  const destination = stringField(record.destination);
  const providerId = stringField(record.providerId);
  const bundleId = stringField(record.bundleId);
  const rechargeCostCents = record.rechargeCostCents;
  if (
    !claimId ||
    !destination ||
    !providerId ||
    !bundleId ||
    typeof rechargeCostCents !== "number" ||
    !Number.isFinite(rechargeCostCents)
  ) {
    return { ok: false, code: "claim_incomplete" };
  }
  return {
    ok: true,
    claim: { claimId, destination, providerId, bundleId, rechargeCostCents },
  };
}

export function parseBeginSend(call: AdminCall): { authorized: true; send: SendReady } | { authorized: false } {
  if (call.networkError || call.status !== 200) return { authorized: false };
  const record = asRecord(call.body);
  if (!record || record.ok !== true || record.sendAuthorized !== true) return { authorized: false };
  if (record.reservationOutcome !== "manual_sending") return { authorized: false };
  const claimId = stringField(record.claimId);
  const destination = stringField(record.destination);
  const providerId = stringField(record.providerId);
  const bundleId = stringField(record.bundleId);
  const rechargeCostCents = record.rechargeCostCents;
  if (
    !claimId ||
    !destination ||
    !providerId ||
    !bundleId ||
    typeof rechargeCostCents !== "number" ||
    !Number.isFinite(rechargeCostCents)
  ) {
    return { authorized: false };
  }
  return {
    authorized: true,
    send: { claimId, destination, providerId, bundleId, rechargeCostCents },
  };
}

export function publicRevokeBody(deviceId: string) {
  return { deviceId };
}

export async function executeManualFulfillment(
  deps: ManualFlowDeps,
  input: { orderId: string; retryRecording: boolean },
): Promise<ManualFlowResult> {
  if (input.retryRecording) {
    const transactionId = (await deps.readPendingTransaction(input.orderId))?.trim() ?? "";
    if (!transactionId) return { kind: "recording_unavailable" };
    return finalizeSameId(deps, input.orderId, transactionId);
  }

  const claimCall = await deps.claim(input.orderId);
  const claim = parseClaim(claimCall);
  if (!claim.ok) return { kind: "not_sent", code: claim.code };

  const sender = toRechargeHandset(await deps.payerPhone(input.orderId));
  const receiver = toRechargeHandset(claim.claim.destination);
  if (sender == null || receiver == null) {
    return {
      kind: "claimed_ready",
      claimId: claim.claim.claimId,
      destination: claim.claim.destination,
      bundleId: claim.claim.bundleId,
      rechargeCostCents: claim.claim.rechargeCostCents,
    };
  }

  const beginCall = await deps.beginSend(input.orderId, claim.claim.claimId);
  if (beginCall.networkError) {
    return { kind: "not_sent", code: "begin_send_unconfirmed" };
  }
  const begin = parseBeginSend(beginCall);
  if (!begin.authorized) {
    const record = asRecord(beginCall.body);
    const sendStarted =
      beginCall.status === 200 &&
      record?.sendAuthorized === true &&
      record?.reservationOutcome === "manual_sending";
    if (sendStarted) {
      await markUncertain(deps, input.orderId);
      return { kind: "uncertain" };
    }
    return { kind: "not_sent", code: codeOf(beginCall.body) ?? "send_not_authorized" };
  }

  const purchaseReceiver = toRechargeHandset(begin.send.destination);
  if (purchaseReceiver == null || !begin.send.bundleId) {
    await markUncertain(deps, input.orderId);
    return { kind: "uncertain" };
  }

  let transactionId = "";
  try {
    const recharge = await deps.createRecharge({
      sender,
      receiver: purchaseReceiver,
      bundleId: begin.send.bundleId,
    });
    transactionId = recharge.transactionIds.map((id) => id.trim()).find((id) => id.length > 0) ?? "";
  } catch {
    transactionId = "";
  }

  if (!transactionId) {
    await markUncertain(deps, input.orderId);
    return { kind: "uncertain" };
  }

  try {
    await deps.rememberTransaction(input.orderId, transactionId);
  } catch {
    try {
      await deps.rememberTransaction(input.orderId, transactionId);
    } catch {
      // The response still carries the transaction id. Finalize is attempted once the id is known.
    }
  }
  return finalizeSameId(deps, input.orderId, transactionId);
}

async function markUncertain(deps: ManualFlowDeps, orderId: string) {
  try {
    await deps.uncertain(orderId);
  } catch {
    // The operator still sees reconciliation required. Another recharge is not sent.
  }
}

async function finalizeSameId(
  deps: ManualFlowDeps,
  orderId: string,
  transactionId: string,
): Promise<ManualFlowResult> {
  let recorded = await deps.finalize(orderId, transactionId);
  if (recorded !== "recorded") {
    recorded = await deps.finalize(orderId, transactionId);
  }
  if (recorded === "recorded") return { kind: "completed", transactionId };
  return { kind: "recording_pending", transactionId };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringField(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function codeOf(body: unknown) {
  const record = asRecord(body);
  return typeof record?.code === "string" ? record.code : null;
}
