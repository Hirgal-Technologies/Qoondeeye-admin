import type { AdminRole } from "@/features/auth/contracts";
import type {
  BundleOrderSnapshot,
  GatewayHealthStatus,
  GatewayHistoryItem,
  MerchantGatewayCounts,
  MerchantGatewaySection,
  MerchantPaymentEvent,
  PaymentReviewFilter,
  ReconciliationAuditEntry,
  ReconciliationRequest,
} from "@/features/merchant-gateway/contracts";
// Relative (not `@/`) so the Node test runner can load this module directly.
import { formatDateTime } from "../../lib/formatters.ts";

export const PAYMENT_REVIEW_FILTERS: PaymentReviewFilter[] = [
  "UNMATCHED",
  "AMBIGUOUS",
  "MANUAL_REVIEW",
  "NEEDS_REVIEW",
  "UNMATCHED_AMOUNT",
  "CONFIGURATION_ERROR",
  "MATCHED",
  "RESOLVED",
];

export const MERCHANT_SECTIONS: MerchantGatewaySection[] = [
  "gateways",
  "payments",
  "alerts",
  "reconciliation",
];

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const GATEWAY_STATUSES = new Set<GatewayHealthStatus>([
  "ONLINE",
  "DEGRADED",
  "OFFLINE",
  "REVOKED",
  "UNKNOWN",
]);

export function normalizeGatewayStatus(
  value: string | null | undefined,
): GatewayHealthStatus {
  const normalized = (value ?? "").trim().toUpperCase();
  if (
    normalized === "ONLINE" ||
    normalized === "DEGRADED" ||
    normalized === "OFFLINE" ||
    normalized === "REVOKED"
  ) {
    return normalized;
  }
  if (GATEWAY_STATUSES.has(normalized as GatewayHealthStatus)) {
    return normalized as GatewayHealthStatus;
  }
  return "UNKNOWN";
}

export function parsePaymentReviewFilter(
  value: string | null | undefined,
): PaymentReviewFilter | null {
  const normalized = (value ?? "").trim().toUpperCase();
  return PAYMENT_REVIEW_FILTERS.includes(normalized as PaymentReviewFilter)
    ? (normalized as PaymentReviewFilter)
    : null;
}

export function parseMerchantSection(
  value: string | null | undefined,
): MerchantGatewaySection {
  return MERCHANT_SECTIONS.includes(value as MerchantGatewaySection)
    ? (value as MerchantGatewaySection)
    : "gateways";
}

export function gatewayHeadline(counts: MerchantGatewayCounts) {
  const total =
    counts.online + counts.degraded + counts.offline + counts.revoked + counts.unknown;
  if (total === 0) return "None";
  if (counts.offline > 0) {
    return counts.offline === total ? "Offline" : `${counts.offline} offline`;
  }
  if (counts.degraded > 0) {
    return counts.degraded === total ? "Degraded" : `${counts.degraded} degraded`;
  }
  if (counts.revoked > 0) {
    return counts.revoked === total ? "Revoked" : `${counts.revoked} revoked`;
  }
  if (counts.unknown > 0) return "Unknown";
  return "Online";
}

export function gatewayHeadlineIsCritical(counts: MerchantGatewayCounts) {
  return counts.offline > 0 || counts.revoked > 0;
}

export function gatewayHeadlineTone(
  counts: MerchantGatewayCounts,
): "critical" | "warning" | "success" | "default" {
  if (counts.offline > 0 || counts.revoked > 0) return "critical";
  if (counts.degraded > 0 || counts.unknown > 0) return "warning";
  if (counts.online > 0) return "success";
  return "default";
}

export function formatMoney(cents: number | null | undefined, currency: string | null) {
  if (cents == null || !Number.isFinite(cents)) return "—";
  const amount = cents / 100;
  const code = (currency ?? "USD").trim().toUpperCase() || "USD";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${code}`;
  }
}

export function formatTimestamp(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return formatDateTime(date);
}

export function formatPaymentMethod(value: string | null | undefined) {
  const key = (value ?? "").trim().toLowerCase();
  if (!key) return "—";
  if (key === "evc" || key === "evc_plus") return "EVC Plus";
  if (key === "edahab") return "eDahab";
  return key.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

export function formatNetwork(connected: boolean | null, type: string | null) {
  const label = formatNetworkType(type);
  if (connected === false) return "Disconnected";
  if (connected === true) return label ? `${label} · connected` : "Connected";
  return label || "—";
}

export function formatCharging(value: boolean | null) {
  if (value === true) return "Charging";
  if (value === false) return "Not charging";
  return "—";
}

export function formatSim(value: boolean | null) {
  if (value === true) return "Detected";
  if (value === false) return "Missing";
  return "Unknown";
}

export type GatewayPaymentMethodHint = "evc_plus" | "edahab";

/**
 * Infer which payment rails a gateway watches from receiver MSISDN prefixes.
 * 25261… → EVC Plus, 25262… → eDahab. Display-only; health status still comes
 * from the backend.
 */
export function inferAuthorizedPaymentMethods(
  receiverMsisdns: readonly string[],
): GatewayPaymentMethodHint[] {
  const present = new Set<GatewayPaymentMethodHint>();
  for (const raw of receiverMsisdns) {
    const digits = raw.replace(/\D/g, "");
    const national =
      digits.startsWith("252") && digits.length >= 12 ? digits.slice(3) : digits;
    if (national.startsWith("61")) present.add("evc_plus");
    if (national.startsWith("62")) present.add("edahab");
  }
  const ordered: GatewayPaymentMethodHint[] = [];
  if (present.has("evc_plus")) ordered.push("evc_plus");
  if (present.has("edahab")) ordered.push("edahab");
  return ordered;
}

export function paymentMethodHintLabel(method: GatewayPaymentMethodHint) {
  return method === "evc_plus" ? "EVC Plus" : "eDahab";
}

export function simRowLabel(method: GatewayPaymentMethodHint) {
  return method === "evc_plus" ? "EVC Plus SIM" : "eDahab SIM";
}

/** Simulator / lab gateways should not drive the summary “offline” headline. */
export function isLabGateway(device: {
  name: string;
  appVersion: string | null;
  id?: string;
}): boolean {
  const hay = `${device.id ?? ""} ${device.name} ${device.appVersion ?? ""}`.toLowerCase();
  return (
    hay.includes("simulator") ||
    hay.includes("simulat") ||
    hay.includes("lab-gateway") ||
    hay.includes("dev-gateway")
  );
}

export function operationalDevices<T extends { name: string; appVersion: string | null; id?: string }>(
  devices: readonly T[],
): T[] {
  return devices.filter((device) => !isLabGateway(device));
}

type RosterDevice = {
  name: string;
  appVersion: string | null;
  id?: string;
  status: string;
  revokedAt?: string | null;
  lastHeartbeatAt?: string | null;
};

/**
 * Active gateways are non-lab, non-revoked devices the backend still treats as
 * operating. When another device is online or degraded, offline rows are stale
 * history — they stay revocable, and they do not count as the current outage.
 * If nothing is heartbeating, offline rows stay active so a real outage remains visible.
 */
export function partitionOperationalGateways<T extends RosterDevice>(devices: readonly T[]) {
  const historical: T[] = [];
  const live: T[] = [];
  for (const device of devices) {
    const status = device.status.trim().toUpperCase();
    if (isLabGateway(device) || status === "REVOKED" || device.revokedAt) {
      historical.push(device);
    } else {
      live.push(device);
    }
  }
  const heartbeating = live.some((device) => {
    const status = device.status.trim().toUpperCase();
    return status === "ONLINE" || status === "DEGRADED";
  });
  if (!heartbeating) {
    const latest = live.reduce<T | null>((best, device) => {
      const time = Date.parse(device.lastHeartbeatAt ?? "");
      if (!Number.isFinite(time)) return best;
      if (!best) return device;
      return time > Date.parse(best.lastHeartbeatAt ?? "") ? device : best;
    }, null);
    if (!latest) return { active: live, historical };
    return {
      active: [latest],
      historical: [...historical, ...live.filter((device) => device !== latest)],
    };
  }
  const active: T[] = [];
  for (const device of live) {
    const status = device.status.trim().toUpperCase();
    if (status === "ONLINE" || status === "DEGRADED") active.push(device);
    else historical.push(device);
  }
  return { active, historical };
}

/** Short network label for the production gateway card. */
export function formatOperatorNetwork(connected: boolean | null, type: string | null) {
  if (connected === false) return "Disconnected";
  const label = formatNetworkType(type);
  if (label) return label;
  if (connected === true) return "Connected";
  return "—";
}

export function formatRelativeTime(value: string | null | undefined, nowMs = Date.now()) {
  if (!value) return "Never";
  const then = Date.parse(value);
  if (!Number.isFinite(then)) return "—";
  const seconds = Math.floor(Math.max(0, nowMs - then) / 1000);
  if (seconds < 45) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

export function formatBattery(percent: number | null) {
  if (percent == null || !Number.isFinite(percent)) return "—";
  return `${Math.round(percent)}%`;
}

export function alertLabel(kind: string) {
  const labels: Record<string, string> = {
    gateway_offline: "Gateway offline",
    gateway_recovered: "Gateway recovered",
    gateway_degraded: "Gateway degraded",
    fulfillment_held: "Fulfillment held",
    fulfillment_recovered: "Fulfillment recovered",
    paid_stuck: "Paid order stuck",
    recharge_uncertain: "Recharge uncertain",
    sim_missing: "SIM missing",
    evc_sim_missing: "EVC Plus SIM missing",
    edahab_sim_missing: "eDahab SIM missing",
    reason: "Reason",
    status: "Status",
  };
  return (
    labels[kind] ??
    kind.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase())
  );
}

export function alertTone(kind: string): GatewayHistoryItem["tone"] {
  if (kind === "gateway_recovered" || kind === "fulfillment_recovered") return "success";
  if (
    kind === "gateway_degraded" ||
    kind === "fulfillment_held" ||
    kind === "paid_stuck"
  ) {
    return "warning";
  }
  if (kind === "gateway_offline" || kind === "recharge_uncertain" || kind.includes("sim")) {
    return "critical";
  }
  return "neutral";
}

export function alertCategory(kind: string): GatewayHistoryItem["category"] {
  if (kind.startsWith("gateway") || kind.includes("sim")) return "gateway";
  if (kind === "payment" || kind.startsWith("payment_")) return "payment";
  return "fulfillment";
}

export function alertLifecycle(kind: string): GatewayHistoryItem["lifecycle"] {
  if (kind === "gateway_recovered" || kind === "fulfillment_recovered") return "resolved";
  return "active";
}

export function transitionTone(toStatus: string): GatewayHistoryItem["tone"] {
  const status = normalizeGatewayStatus(toStatus);
  if (status === "ONLINE") return "success";
  if (status === "DEGRADED") return "warning";
  if (status === "OFFLINE" || status === "REVOKED") return "critical";
  return "neutral";
}

const SAFE_ALERT_FIELDS = new Set([
  "reason",
  "status",
  "sim",
  "network_type",
  "destinationMasked",
]);

export function alertDetail(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return "Gateway health alert";
  }
  const parts = Object.entries(payload as Record<string, unknown>)
    .filter(
      ([key, value]) =>
        SAFE_ALERT_FIELDS.has(key) &&
        (typeof value === "string" || typeof value === "number" || typeof value === "boolean"),
    )
    .map(([key, value]) => `${alertLabel(key)}: ${String(value).replace(/_/g, " ")}`);
  return parts.length > 0 ? parts.join(" · ") : "Gateway health alert";
}

export type PaymentComparison = {
  label: string;
  eventValue: string;
  orderValue: string;
  aligned: boolean;
};

export function compareEventToOrder(
  event: MerchantPaymentEvent,
  order: BundleOrderSnapshot,
): PaymentComparison[] {
  const eventRail = paymentMethodKey(event.paymentMethod ?? event.provider);
  const orderRail = paymentMethodKey(order.paymentMethod);
  const eventReceiver = phoneDigits(event.merchantReceiverMsisdn);
  const orderReceiver = phoneDigits(order.merchantReceiverMsisdn);
  const amountAligned =
    order.sellingPriceCents != null && event.amountCents === order.sellingPriceCents;
  const eventCurrency = currencyCode(event.currency);
  const orderCurrency = currencyCode(order.currency);

  return [
    {
      label: "Payment method",
      eventValue: formatPaymentMethod(event.paymentMethod ?? event.provider),
      orderValue: formatPaymentMethod(order.paymentMethod),
      aligned: Boolean(eventRail && orderRail && railsMatch(eventRail, orderRail)),
    },
    {
      label: "Amount",
      eventValue: formatMoney(event.amountCents, event.currency),
      orderValue: formatMoney(order.sellingPriceCents, order.currency || event.currency),
      aligned: amountAligned,
    },
    {
      label: "Currency",
      eventValue: eventCurrency || "—",
      orderValue: orderCurrency || "—",
      aligned: Boolean(eventCurrency && orderCurrency && eventCurrency === orderCurrency),
    },
    {
      label: "Merchant receiver",
      eventValue: event.merchantReceiverMsisdn || "—",
      orderValue: order.merchantReceiverMsisdn || "—",
      aligned: Boolean(eventReceiver && orderReceiver && eventReceiver === orderReceiver),
    },
    {
      label: "Payer",
      eventValue: event.payerMsisdn || "—",
      orderValue: order.payerPhone || "—",
      aligned: Boolean(
        phoneDigits(event.payerMsisdn) &&
          phoneDigits(event.payerMsisdn) === phoneDigits(order.payerPhone),
      ),
    },
  ];
}

export function salaamReconciliationLabel(input: {
  status: string;
  failureCode?: string | null;
  fulfillmentStatus?: string | null;
}): string {
  const status = input.status.toUpperCase();
  if (status === "NEEDS_REVIEW") return "Missing or invalid destination";
  if (status === "UNMATCHED_AMOUNT") return "Unknown amount";
  if (status === "CONFIGURATION_ERROR") return "Configuration error";
  if (status === "UNMATCHED") return "Receipt only";
  const failure = input.failureCode ?? "";
  if (failure === "recharge_uncertain") return "Recharge uncertain";
  if (
    failure === "production_disabled" ||
    failure === "daily_recharge_limit_reached" ||
    failure === "toptayo_balance_low" ||
    failure === "toptayo_balance_unavailable" ||
    failure === "production_safeguard_misconfigured"
  ) {
    return "Fulfillment held";
  }
  if (input.fulfillmentStatus === "COMPLETED") return "Completed";
  if (status === "MATCHED") return "Automatic match / fulfilling";
  return status.charAt(0) + status.slice(1).toLowerCase();
}

export function paymentFilterLabel(filter: PaymentReviewFilter) {
  if (filter === "MANUAL_REVIEW") return "Needs review";
  if (filter === "NEEDS_REVIEW") return "Missing destination";
  if (filter === "UNMATCHED_AMOUNT") return "Unknown amount";
  if (filter === "CONFIGURATION_ERROR") return "Configuration error";
  if (filter === "MATCHED") return "Recently matched";
  if (filter === "RESOLVED") return "Resolved";
  return filter.charAt(0) + filter.slice(1).toLowerCase();
}

/**
 * Orders that could explain an ambiguous payment. Hard fields only:
 * amount, currency, method, and merchant receiver. Payer differences stay visible
 * as separate candidates rather than being dropped.
 */
export function paymentCandidateOrders(
  event: Pick<
    MerchantPaymentEvent,
    "amountCents" | "currency" | "paymentMethod" | "provider" | "merchantReceiverMsisdn"
  >,
  orders: readonly BundleOrderSnapshot[],
) {
  const eventCurrency = (event.currency ?? "").trim().toUpperCase();
  const eventMethod = paymentMethodKey(event.paymentMethod ?? event.provider);
  const eventReceiver = phoneDigits(event.merchantReceiverMsisdn);
  return orders.filter((order) => {
    if (order.sellingPriceCents !== event.amountCents) return false;
    if ((order.currency ?? "").trim().toUpperCase() !== eventCurrency) return false;
    const orderMethod = paymentMethodKey(order.paymentMethod);
    if (!eventMethod || !orderMethod || eventMethod !== orderMethod) return false;
    const orderReceiver = phoneDigits(order.merchantReceiverMsisdn);
    if (!eventReceiver || !orderReceiver || eventReceiver !== orderReceiver) return false;
    return true;
  });
}

export type ReconciliationDecision = {
  exact: boolean;
  hardBlocked: boolean;
  payerOverrideAvailable: boolean;
  expiredOverrideAvailable: boolean;
  hardBlockers: Array<"amount" | "currency" | "payment_method" | "merchant_receiver" | "payer">;
};

export function isOrderExpired(expiresAt: string | null | undefined, now = new Date()) {
  if (!expiresAt) return false;
  const time = new Date(expiresAt).getTime();
  if (Number.isNaN(time)) return false;
  return time <= now.getTime();
}

export function inspectReconciliation(
  event: MerchantPaymentEvent,
  order: BundleOrderSnapshot,
  now = new Date(),
): ReconciliationDecision {
  const comparison = compareEventToOrder(event, order);
  const aligned = (label: string) =>
    comparison.find((row) => row.label === label)?.aligned === true;
  const payersPresent = Boolean(phoneDigits(event.payerMsisdn) && phoneDigits(order.payerPhone));
  const payerMismatch = payersPresent && !aligned("Payer");
  const hardBlockers: ReconciliationDecision["hardBlockers"] = [];
  if (!aligned("Amount")) hardBlockers.push("amount");
  if (!aligned("Currency")) hardBlockers.push("currency");
  if (!aligned("Payment method")) hardBlockers.push("payment_method");
  if (!aligned("Merchant receiver")) hardBlockers.push("merchant_receiver");
  if (!aligned("Payer") && !payerMismatch) hardBlockers.push("payer");
  const hardBlocked = hardBlockers.length > 0;
  const expired = isOrderExpired(order.expiresAt, now);
  return {
    exact: !hardBlocked && !payerMismatch && !expired,
    hardBlocked,
    payerOverrideAvailable: !hardBlocked && payerMismatch,
    expiredOverrideAvailable: !hardBlocked && expired,
    hardBlockers,
  };
}

export function canEnableConfirm(input: {
  role: AdminRole;
  decision: ReconciliationDecision;
  allowPayerMismatch: boolean;
  allowExpiredOrder: boolean;
  reason: string;
}) {
  if (input.role !== "admin") return false;
  if (input.decision.hardBlocked) return false;
  if (input.decision.exact) return true;
  const needsPayer = input.decision.payerOverrideAvailable;
  const needsExpired = input.decision.expiredOverrideAvailable;
  if (!needsPayer && !needsExpired) return false;
  if (needsPayer && !input.allowPayerMismatch) return false;
  if (needsExpired && !input.allowExpiredOrder) return false;
  if (!needsPayer && input.allowPayerMismatch) return false;
  if (!needsExpired && input.allowExpiredOrder) return false;
  return input.reason.trim().length > 0;
}

export function buildReconcileRequest(input: {
  role: AdminRole;
  eventId: string;
  orderId: string;
  decision: ReconciliationDecision;
  allowPayerMismatch: boolean;
  allowExpiredOrder: boolean;
  reason: string;
}): ReconciliationRequest | null {
  if (!canEnableConfirm(input)) return null;
  if (!UUID_PATTERN.test(input.eventId) || !UUID_PATTERN.test(input.orderId)) return null;
  const request: ReconciliationRequest = {
    eventId: input.eventId,
    orderId: input.orderId,
    allowPayerMismatch: input.decision.payerOverrideAvailable && input.allowPayerMismatch,
    allowExpiredOrder: input.decision.expiredOverrideAvailable && input.allowExpiredOrder,
  };
  const reason = input.reason.trim();
  if (reason) request.reason = reason.slice(0, 500);
  return request;
}

export function parseReconcileBody(
  body: unknown,
):
  | { ok: true; value: ReconciliationRequest }
  | { ok: false; code: "invalid_request" | "reason_required" } {
  if (!body || typeof body !== "object") return { ok: false, code: "invalid_request" };
  const record = body as Record<string, unknown>;
  const eventId = record.eventId;
  const orderId = record.orderId;
  if (typeof eventId !== "string" || !UUID_PATTERN.test(eventId)) {
    return { ok: false, code: "invalid_request" };
  }
  if (typeof orderId !== "string" || !UUID_PATTERN.test(orderId)) {
    return { ok: false, code: "invalid_request" };
  }
  if ("allowPayerMismatch" in record && typeof record.allowPayerMismatch !== "boolean") {
    return { ok: false, code: "invalid_request" };
  }
  if ("allowExpiredOrder" in record && typeof record.allowExpiredOrder !== "boolean") {
    return { ok: false, code: "invalid_request" };
  }
  const allowPayerMismatch = record.allowPayerMismatch === true;
  const allowExpiredOrder = record.allowExpiredOrder === true;
  const reason = typeof record.reason === "string" ? record.reason.trim().slice(0, 500) : "";
  if ((allowPayerMismatch || allowExpiredOrder) && !reason) {
    return { ok: false, code: "reason_required" };
  }
  const value: ReconciliationRequest = { eventId, orderId, allowPayerMismatch, allowExpiredOrder };
  if (reason) value.reason = reason;
  return { ok: true, value };
}

const RECONCILE_ERROR_MESSAGES: Record<string, string> = {
  forbidden: "You do not have permission to reconcile this payment.",
  unauthorized: "Your admin session expired. Sign in again.",
  unauthenticated: "Your admin session expired. Sign in again.",
  invalid_request: "The reconciliation request was incomplete.",
  reason_required: "A resolution reason is required for this override.",
  amount_mismatch: "The payment amount does not match the order. This cannot be overridden.",
  currency_mismatch: "The payment currency does not match the order. This cannot be overridden.",
  payer_mismatch:
    "The payer does not match the order. Allow the payer override and give a reason if this is intentional.",
  payment_method_mismatch:
    "The payment method does not match the order. This cannot be overridden.",
  method_mismatch: "The payment method does not match the order. This cannot be overridden.",
  receiver_mismatch:
    "The merchant receiver does not match the order. This cannot be overridden.",
  merchant_receiver_mismatch:
    "The merchant receiver does not match the order. This cannot be overridden.",
  already_paid: "This order was already paid. The lists have been refreshed.",
  event_already_matched: "This payment was already matched. The lists have been refreshed.",
  order_not_pending: "This order is no longer pending. The lists have been refreshed.",
  order_expired:
    "This order is past its payment window. Allow the expired-order override and give a reason if this is intentional.",
  event_not_found: "This payment is no longer available. The lists have been refreshed.",
  order_not_found: "This order is no longer available. The lists have been refreshed.",
  event_changed: "This payment changed since the page loaded. The lists have been refreshed.",
  order_changed: "This order changed since the page loaded. The lists have been refreshed.",
};

const STALE_RECONCILE_CODES = new Set([
  "already_paid",
  "event_already_matched",
  "order_not_pending",
  "event_not_found",
  "order_not_found",
  "event_changed",
  "order_changed",
  "stale",
]);

export function reconciliationErrorIsStale(code: string) {
  return STALE_RECONCILE_CODES.has(code) || code.endsWith("_changed") || code.startsWith("stale");
}

export function reconciliationErrorMessage(code: string, backendMessage?: string) {
  return (
    RECONCILE_ERROR_MESSAGES[code] ??
    (backendMessage && backendMessage.length > 0 && backendMessage.length <= 240
      ? backendMessage
      : `Reconciliation was rejected (${code}).`)
  );
}

export function shouldRefreshReconciliation(
  outcome: { kind: "success" } | { kind: "error"; code: string },
) {
  if (outcome.kind === "success") return true;
  return reconciliationErrorIsStale(outcome.code);
}

export function fulfillmentResultCopy(fulfillment: string) {
  if (fulfillment === "triggered") {
    return "Fulfillment was requested. The bundle has not necessarily been delivered yet.";
  }
  if (fulfillment === "already_processing") return "Fulfillment was already in progress.";
  if (fulfillment === "already_terminal") return "Fulfillment had already finished or failed.";
  if (fulfillment === "integrity_skip") {
    return "Fulfillment was not started because an integrity check skipped it.";
  }
  return fulfillment ? `Fulfillment result: ${fulfillment}.` : "No fulfillment result was returned.";
}

export function mapAuditEntry(row: {
  id?: unknown;
  event_id?: unknown;
  order_id?: unknown;
  reason?: unknown;
  resolution_type?: unknown;
  created_at?: unknown;
  admin?: { email?: string } | { email?: string }[] | null;
}): ReconciliationAuditEntry {
  const admin = Array.isArray(row.admin) ? row.admin[0] : row.admin;
  return {
    id: String(row.id ?? ""),
    eventId: String(row.event_id ?? ""),
    orderId: String(row.order_id ?? ""),
    adminEmail: admin?.email?.trim() || "Unknown admin",
    resolutionType: String(row.resolution_type ?? "—"),
    reason: typeof row.reason === "string" && row.reason.trim() ? row.reason.trim() : null,
    createdAt: String(row.created_at ?? ""),
  };
}

function currencyCode(value: string | null | undefined) {
  return (value ?? "").trim().toUpperCase();
}

function formatNetworkType(type: string | null) {
  const key = (type ?? "").trim().toLowerCase();
  if (!key) return "";
  if (key === "wifi" || key === "wi-fi") return "Wi-Fi";
  if (key === "cellular" || key === "mobile") return "Mobile";
  return key.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function phoneDigits(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "");
}

function paymentMethodKey(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function railsMatch(left: string, right: string) {
  const evc = new Set(["evc", "evc_plus"]);
  if (evc.has(left) && evc.has(right)) return true;
  return left === right;
}
