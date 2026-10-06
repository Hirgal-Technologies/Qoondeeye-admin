import assert from "node:assert/strict";
import test from "node:test";
import {
  MERCHANT_DEVICE_COLUMNS,
  MERCHANT_PAYMENT_COLUMNS,
  PENDING_ORDER_COLUMNS,
  RECONCILIATION_AUDIT_COLUMNS,
  SECRET_COLUMN_NAMES,
} from "../features/merchant-gateway/columns.ts";
import type { BundleOrderSnapshot, MerchantPaymentEvent } from "../features/merchant-gateway/contracts.ts";
import {
  alertDetail,
  buildReconcileRequest,
  canEnableConfirm,
  compareEventToOrder,
  formatMoney,
  formatOperatorNetwork,
  formatRelativeTime,
  paymentCandidateOrders,
  fulfillmentResultCopy,
  gatewayHeadline,
  inferAuthorizedPaymentMethods,
  inspectReconciliation,
  isLabGateway,
  mapAuditEntry,
  normalizeGatewayStatus,
  parsePaymentReviewFilter,
  parseReconcileBody,
  shouldRefreshReconciliation,
} from "../features/merchant-gateway/presentation.ts";

const EVENT_ID = "11111111-1111-4111-8111-111111111111";
const ORDER_ID = "22222222-2222-4222-8222-222222222222";
const NOW = new Date("2026-09-27T12:00:00.000Z");

test("merchant reads never select gateway or signing secrets", () => {
  const selects = [
    MERCHANT_DEVICE_COLUMNS,
    MERCHANT_PAYMENT_COLUMNS,
    PENDING_ORDER_COLUMNS,
    RECONCILIATION_AUDIT_COLUMNS,
  ];
  for (const name of SECRET_COLUMN_NAMES) {
    for (const select of selects) {
      assert.equal(select.split(",").includes(name), false, name);
    }
  }
});

test("gateway status labels stay explicit", () => {
  assert.equal(normalizeGatewayStatus("online"), "ONLINE");
  assert.equal(normalizeGatewayStatus("degraded"), "DEGRADED");
  assert.equal(normalizeGatewayStatus("offline"), "OFFLINE");
  assert.equal(normalizeGatewayStatus("revoked"), "REVOKED");
  assert.equal(normalizeGatewayStatus("something-else"), "UNKNOWN");
  assert.equal(
    gatewayHeadline({
      online: 1,
      degraded: 0,
      offline: 0,
      revoked: 0,
      unknown: 0,
      paidAwaitingFulfillment: 0,
      rechargeUncertain: 0,
      fulfillmentHeld: 0,
      unmatchedPayments: 0,
      ambiguousPayments: 0,
      activeAlerts: 0,
    }),
    "Online",
  );
});

test("gateway cards infer authorized SIMs and mute lab devices", () => {
  assert.deepEqual(inferAuthorizedPaymentMethods(["252621854843"]), ["edahab"]);
  assert.deepEqual(inferAuthorizedPaymentMethods(["252611854843", "252621854843"]), [
    "evc_plus",
    "edahab",
  ]);
  assert.equal(
    isLabGateway({ name: "Simulator gateway", appVersion: "simulator-1" }),
    true,
  );
  assert.equal(isLabGateway({ name: "edahab-a32", appVersion: "1.0.2" }), false);
  assert.equal(
    formatRelativeTime("2026-09-27T11:59:30.000Z", Date.parse("2026-09-27T12:00:00.000Z")),
    "Just now",
  );
});

test("production money labels stay quiet and unavailable values stay explicit", () => {
  assert.equal(formatOperatorNetwork(true, "wifi"), "Wi-Fi");
  assert.equal(formatOperatorNetwork(false, "wifi"), "Disconnected");
  assert.equal(formatMoney(null, "USD"), "—");
  assert.notEqual(formatMoney(null, "USD"), "$0.00");
});

test("ambiguous payments can name pending order candidates", () => {
  const matches = paymentCandidateOrders(event(), [order(), order({ id: "33333333-3333-4333-8333-333333333333", bundleName: "Other" })]);
  assert.equal(matches.length, 2);
  assert.equal(paymentCandidateOrders(event(), [order({ sellingPriceCents: 2500 })]).length, 0);
});

test("payment review filters and amounts stay operator-facing", () => {
  assert.equal(parsePaymentReviewFilter("manual_review"), "MANUAL_REVIEW");
  assert.equal(parsePaymentReviewFilter("matched"), "MATCHED");
  assert.equal(parsePaymentReviewFilter("resolved"), "RESOLVED");
  assert.equal(parsePaymentReviewFilter("paid"), null);
  assert.equal(formatMoney(1800, "USD"), "$18.00");
});

test("alert details drop secret-looking payload fields", () => {
  assert.equal(
    alertDetail({ reason: "heartbeat_missing", hmac_secret: "hidden", token_hash: "hidden" }),
    "Reason: heartbeat missing",
  );
});

test("exact match can be confirmed with both override flags off", () => {
  const decision = inspectReconciliation(event(), order(), NOW);
  assert.equal(decision.exact, true);
  assert.equal(decision.payerOverrideAvailable, false);
  assert.equal(decision.expiredOverrideAvailable, false);
  const request = buildReconcileRequest({
    role: "admin",
    eventId: EVENT_ID,
    orderId: ORDER_ID,
    decision,
    allowPayerMismatch: false,
    allowExpiredOrder: false,
    reason: "",
  });
  assert.deepEqual(request, {
    eventId: EVENT_ID,
    orderId: ORDER_ID,
    allowPayerMismatch: false,
    allowExpiredOrder: false,
  });
});

test("payer override requires a reason and does not allow an expired-order flag", () => {
  const decision = inspectReconciliation(
    event({ payerMsisdn: "252610000099" }),
    order(),
    NOW,
  );
  assert.equal(decision.payerOverrideAvailable, true);
  assert.equal(decision.expiredOverrideAvailable, false);
  assert.equal(
    canEnableConfirm({
      role: "admin",
      decision,
      allowPayerMismatch: true,
      allowExpiredOrder: false,
      reason: "   ",
    }),
    false,
  );
  const request = buildReconcileRequest({
    role: "admin",
    eventId: EVENT_ID,
    orderId: ORDER_ID,
    decision,
    allowPayerMismatch: true,
    allowExpiredOrder: false,
    reason: "Paid from the customer's second line",
  });
  assert.equal(request?.allowPayerMismatch, true);
  assert.equal(request?.allowExpiredOrder, false);
  assert.equal(request?.reason, "Paid from the customer's second line");
});

test("expired-order override requires a reason and keeps the payer flag off", () => {
  const decision = inspectReconciliation(
    event(),
    order({ expiresAt: "2026-09-01T00:00:00.000Z" }),
    NOW,
  );
  assert.equal(decision.expiredOverrideAvailable, true);
  assert.equal(decision.exact, false);
  const request = buildReconcileRequest({
    role: "admin",
    eventId: EVENT_ID,
    orderId: ORDER_ID,
    decision,
    allowPayerMismatch: false,
    allowExpiredOrder: true,
    reason: "Customer paid just after the window",
  });
  assert.equal(request?.allowExpiredOrder, true);
  assert.equal(request?.allowPayerMismatch, false);
  assert.equal(
    buildReconcileRequest({
      role: "admin",
      eventId: EVENT_ID,
      orderId: ORDER_ID,
      decision,
      allowPayerMismatch: false,
      allowExpiredOrder: true,
      reason: "",
    }),
    null,
  );
});

test("amount, currency, method, and receiver mismatches cannot be overridden", () => {
  const cases = [
    order({ sellingPriceCents: 2500 }),
    order({ currency: "SOS" }),
    order({ paymentMethod: "edahab" }),
    order({ merchantReceiverMsisdn: "252611111111" }),
  ];
  for (const candidate of cases) {
    const decision = inspectReconciliation(event({ payerMsisdn: "252610000099" }), candidate, NOW);
    assert.equal(decision.hardBlocked, true);
    assert.equal(decision.payerOverrideAvailable, false);
    assert.equal(decision.expiredOverrideAvailable, false);
    assert.equal(
      canEnableConfirm({
        role: "admin",
        decision,
        allowPayerMismatch: true,
        allowExpiredOrder: true,
        reason: "Trying to force it",
      }),
      false,
    );
  }
});

test("support and viewer never receive an enabled confirmation request", () => {
  const decision = inspectReconciliation(event(), order(), NOW);
  for (const role of ["support", "viewer"] as const) {
    assert.equal(
      canEnableConfirm({
        role,
        decision,
        allowPayerMismatch: false,
        allowExpiredOrder: false,
        reason: "",
      }),
      false,
    );
    assert.equal(
      buildReconcileRequest({
        role,
        eventId: EVENT_ID,
        orderId: ORDER_ID,
        decision,
        allowPayerMismatch: false,
        allowExpiredOrder: false,
        reason: "Should not be sent",
      }),
      null,
    );
  }
});

test("success and stale backend codes refresh, while hard mismatches do not", () => {
  assert.equal(shouldRefreshReconciliation({ kind: "success" }), true);
  assert.equal(shouldRefreshReconciliation({ kind: "error", code: "event_already_matched" }), true);
  assert.equal(shouldRefreshReconciliation({ kind: "error", code: "already_paid" }), true);
  assert.equal(shouldRefreshReconciliation({ kind: "error", code: "order_changed" }), true);
  assert.equal(shouldRefreshReconciliation({ kind: "error", code: "amount_mismatch" }), false);
  assert.equal(shouldRefreshReconciliation({ kind: "error", code: "payer_mismatch" }), false);
  const copy = fulfillmentResultCopy("triggered");
  assert.match(copy, /requested/i);
  assert.match(copy, /not necessarily/i);
});

test("reconciliation audit rows stay limited to operator fields", () => {
  const entry = mapAuditEntry({
    id: "audit-1",
    event_id: EVENT_ID,
    order_id: ORDER_ID,
    reason: "Checked with the customer",
    resolution_type: "exact",
    created_at: "2026-09-27T12:05:00.000Z",
    admin: { email: "ops@qoondeeye.com" },
    hmac_secret: "hidden",
  } as Parameters<typeof mapAuditEntry>[0]);
  assert.deepEqual(Object.keys(entry).sort(), [
    "adminEmail",
    "createdAt",
    "eventId",
    "id",
    "orderId",
    "reason",
    "resolutionType",
  ]);
  assert.equal(entry.adminEmail, "ops@qoondeeye.com");
  const parsed = parseReconcileBody({
    eventId: EVENT_ID,
    orderId: ORDER_ID,
    adminUserId: "should-not-forward",
    adminEmail: "should-not-forward@example.com",
    allowPayerMismatch: false,
    allowExpiredOrder: false,
  });
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal("adminUserId" in parsed.value, false);
    assert.equal("adminEmail" in parsed.value, false);
  }
});

test("event and order comparison flags amount and receiver differences", () => {
  const rows = compareEventToOrder(event(), {
    ...order(),
    sellingPriceCents: 2500,
    merchantReceiverMsisdn: "252611111111",
  });
  assert.equal(rows.find((row) => row.label === "Amount")?.aligned, false);
  assert.equal(rows.find((row) => row.label === "Merchant receiver")?.aligned, false);
  assert.equal(rows.find((row) => row.label === "Payment method")?.aligned, true);
});

function event(overrides: Partial<MerchantPaymentEvent> = {}): MerchantPaymentEvent {
  return {
    id: EVENT_ID,
    paymentMethod: "evc_plus",
    provider: "EVC",
    payerMsisdn: "252610000001",
    amountCents: 1800,
    currency: "USD",
    merchantReceiverMsisdn: "252699999999",
    receivedAt: "2026-09-25T13:00:00.000Z",
    providerTimestamp: null,
    uploadedAt: "2026-09-25T13:00:05.000Z",
    providerTxnId: null,
    status: "UNMATCHED",
    matchedAt: null,
    deviceName: "Counter",
    order: null,
    candidateCount: null,
    candidateOrders: [],
    faahfaahin: null,
    bankTicket: null,
    providerReference: null,
    ...overrides,
  };
}

function order(overrides: Partial<BundleOrderSnapshot> = {}): BundleOrderSnapshot {
  return {
    id: ORDER_ID,
    bundleName: "Daily bundle",
    paymentStatus: "PENDING",
    fulfillmentStatus: "NOT_STARTED",
    sellingPriceCents: 1800,
    currency: "USD",
    payerPhone: "252610000001",
    paymentMethod: "evc_plus",
    merchantReceiverMsisdn: "252699999999",
    rechargePhone: "252610000001",
    failureCode: null,
    createdAt: "2026-09-25T12:55:00.000Z",
    expiresAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}
