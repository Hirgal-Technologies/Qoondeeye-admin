import type { GatewayPaymentMethodHint } from "@/features/merchant-gateway/presentation";

/**
 * Operator decisions for paid bundle orders.
 * Safety is read from backend fields only. This module does not call TopTayo.
 */

export const HOLD_FAILURE_CODES = [
  "production_disabled",
  "daily_recharge_limit_reached",
  "toptayo_balance_low",
  "toptayo_balance_unavailable",
  "production_safeguard_misconfigured",
] as const;

export const UNSAFE_RESERVATION_OUTCOMES = [
  "sending",
  "processing",
  "uncertain",
  "manual_sending",
  "recharge_uncertain",
] as const;

export type ReservationKnowledge =
  | { known: true; outcome: string | null }
  | { known: false };

export type FulfillmentSafetyInput = {
  paymentStatus: string;
  fulfillmentStatus: string;
  failureCode: string | null;
  topTayoTransactionIds: readonly string[];
  pendingRecordTransactionId?: string | null;
  reservation: ReservationKnowledge;
};

/**
 * Purchase buttons are only `fulfill_manually` and `continue_manual`.
 * Every other action is read-only against TopTayo.
 */
export type OperatorAction =
  | "fulfill_manually"
  | "continue_manual"
  | "retry_recording"
  | "reconcile"
  | "check_toptayo"
  | "refresh_only"
  | "none";

export type PaidOrderBucket =
  | "recharge_uncertain"
  | "toptayo_processing"
  | "fulfillment_held"
  | "completed"
  | "other";

export type SimTone = "success" | "critical" | "neutral";

export type SimDisplay = {
  label: string;
  value: string;
  tone: SimTone;
};

const NOT_REPORTED = "Not reported";

export function presentTransactionIds(ids: readonly string[]) {
  return ids.map((id) => id.trim()).filter((id) => id.length > 0);
}

export function fulfillmentOperatorAction(input: FulfillmentSafetyInput): OperatorAction {
  const payment = input.paymentStatus.trim().toUpperCase();
  const fulfillment = input.fulfillmentStatus.trim().toUpperCase();
  const failure = (input.failureCode ?? "").trim().toLowerCase();
  const transactionIds = presentTransactionIds(input.topTayoTransactionIds);
  const pendingRecord = (input.pendingRecordTransactionId ?? "").trim();

  if (fulfillment === "COMPLETED") return "none";
  if (pendingRecord && transactionIds.length === 0) return "retry_recording";
  if (!input.reservation.known) return "refresh_only";

  const outcome = (input.reservation.outcome ?? "").trim().toLowerCase();
  if (transactionIds.length > 0) return "check_toptayo";
  if (
    failure === "recharge_uncertain" ||
    UNSAFE_RESERVATION_OUTCOMES.includes(outcome as (typeof UNSAFE_RESERVATION_OUTCOMES)[number])
  ) {
    return "reconcile";
  }

  const paidOpen =
    payment === "PAYMENT_CONFIRMED" &&
    fulfillment !== "COMPLETED" &&
    transactionIds.length === 0 &&
    failure !== "recharge_uncertain";

  if (paidOpen && outcome === "manual_claimed") return "continue_manual";
  if (paidOpen && outcome === "reserved") return "fulfill_manually";
  return "refresh_only";
}

export function operatorMayPurchase(action: OperatorAction) {
  return action === "fulfill_manually" || action === "continue_manual";
}

export function isPaidAwaitingFulfillment(paymentStatus: string, fulfillmentStatus: string) {
  return (
    paymentStatus.trim().toUpperCase() === "PAYMENT_CONFIRMED" &&
    fulfillmentStatus.trim().toUpperCase() !== "COMPLETED"
  );
}

export function paidOrderBucket(input: {
  paymentStatus: string;
  fulfillmentStatus: string;
  failureCode: string | null;
  reservationOutcome: string | null;
}): PaidOrderBucket {
  const fulfillment = input.fulfillmentStatus.trim().toUpperCase();
  if (fulfillment === "COMPLETED") return "completed";
  const failure = (input.failureCode ?? "").trim().toLowerCase();
  const reservation = (input.reservationOutcome ?? "").trim().toLowerCase();
  if (
    failure === "recharge_uncertain" ||
    reservation === "uncertain" ||
    reservation === "recharge_uncertain"
  ) {
    return "recharge_uncertain";
  }
  if (
    reservation === "sending" ||
    reservation === "processing" ||
    reservation === "manual_sending"
  ) {
    return "toptayo_processing";
  }
  if (isPaidAwaitingFulfillment(input.paymentStatus, input.fulfillmentStatus)) {
    return "fulfillment_held";
  }
  return "other";
}

export function simDisplay(
  method: GatewayPaymentMethodHint,
  authorized: readonly GatewayPaymentMethodHint[],
  detected: boolean | null,
): SimDisplay {
  const label = method === "evc_plus" ? "EVC Plus" : "eDahab";
  if (!authorized.includes(method)) {
    return { label, value: "Not configured", tone: "neutral" };
  }
  if (detected === true) return { label, value: "Connected", tone: "success" };
  if (detected === false) return { label, value: "Missing", tone: "critical" };
  return { label, value: "Unknown", tone: "neutral" };
}

export function maskPhone(value: string | null | undefined) {
  const digits = (value ?? "").replace(/\D/g, "");
  if (!digits) return "—";
  if (digits.length < 4) return "•••";
  return `••••••${digits.slice(-4)}`;
}

export function displayOptionalCount(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return NOT_REPORTED;
  return String(Math.trunc(value));
}

export function displayUnavailable(label: string) {
  const text = label.trim();
  return text.length > 0 ? text : "Unavailable";
}

export type CountSource = {
  status: string;
  lab: boolean;
};

export function summarizeDeviceCounts(devices: readonly CountSource[]) {
  const production = devices.filter((device) => !device.lab);
  const status = (value: string) =>
    production.filter((device) => device.status.trim().toUpperCase() === value).length;
  return {
    online: status("ONLINE"),
    degraded: status("DEGRADED"),
    offline: status("OFFLINE"),
    revoked: status("REVOKED"),
    unknown: production.filter((device) => {
      const normalized = device.status.trim().toUpperCase();
      return !["ONLINE", "DEGRADED", "OFFLINE", "REVOKED"].includes(normalized);
    }).length,
    excludedLabGateways: devices.length - production.length,
  };
}

export type AlertFilter = "active" | "resolved" | "gateway" | "payment" | "fulfillment";

export function alertMatchesFilter(
  item: { category: "gateway" | "payment" | "fulfillment"; lifecycle: "active" | "resolved" },
  filter: AlertFilter,
) {
  if (filter === "active" || filter === "resolved") return item.lifecycle === filter;
  return item.category === filter;
}
