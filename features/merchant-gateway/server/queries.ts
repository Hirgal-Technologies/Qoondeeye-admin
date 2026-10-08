import "server-only";
import {
  MERCHANT_DEVICE_COLUMNS,
  MERCHANT_PAYMENT_COLUMNS,
  PENDING_ORDER_COLUMNS,
  RECONCILIATION_AUDIT_COLUMNS,
} from "@/features/merchant-gateway/columns";
import type {
  BundleOrderSnapshot,
  GatewayHistory,
  GatewayHistoryItem,
  ManualFulfillmentHistoryEntry,
  MerchantGatewayDevice,
  MerchantGatewaySummary,
  MerchantPaymentEvent,
  PaymentReviewFilter,
  ReconciliationContext,
  TestingHistory,
  TestingHistoryRecord,
} from "@/features/merchant-gateway/contracts";
import { batteryAlertLevel, batteryWarningCleared } from "@/features/merchant-gateway/battery-alert";
import { summarizeDeviceCounts } from "@/features/merchant-gateway/operations";
import {
  alertCategory,
  alertDetail,
  alertLabel,
  alertLifecycle,
  alertTone,
  isLabGateway,
  mapAuditEntry,
  normalizeGatewayStatus,
  partitionOperationalGateways,
  paymentCandidateOrders,
  transitionTone,
} from "@/features/merchant-gateway/presentation";
import { loadPaidFulfillmentBoard } from "@/features/merchant-gateway/server/paid-orders";
import { getProductionSafeguardView } from "@/features/operations/server/safeguards";
import { createAdminClient } from "@/lib/supabase/admin";

export async function getMerchantGatewaySummary(options?: {
  forceMoney?: boolean;
}): Promise<MerchantGatewaySummary> {
  const db = createAdminClient();
  const [
    devicesResult,
    unmatchedResult,
    ambiguousResult,
    paidBoard,
    safeguards,
    fulfillmentAlerts,
    manualHistory,
    reasons,
  ] =
    await Promise.all([
      db.from("merchant_gateway_devices").select(MERCHANT_DEVICE_COLUMNS).order("name"),
      countMatchStatus("UNMATCHED"),
      countMatchStatus("AMBIGUOUS"),
      loadPaidFulfillmentBoard(),
      getProductionSafeguardView({ force: options?.forceMoney === true }),
      loadFulfillmentAlerts(),
      loadManualHistory(),
      loadStatusReasons(),
    ]);

  let deviceRows = devicesResult;
  if (
    devicesResult.error &&
    devicesResult.error.message.includes("battery_alert_level")
  ) {
    const columns = MERCHANT_DEVICE_COLUMNS.split(",")
      .map((column) => column.trim())
      .filter((column) => column !== "battery_alert_level")
      .join(",");
    deviceRows = await db.from("merchant_gateway_devices").select(columns).order("name");
  }
  throwIfError(deviceRows.error);

  const allDevices = rows<DeviceRow>(deviceRows.data).map(mapDevice);
  const withReasons = allDevices.map((device) => ({
    ...device,
    statusReason: reasons.get(device.id) ?? null,
  }));
  const roster = partitionOperationalGateways(withReasons);
  const devices = roster.active;
  const historicalDevices = roster.historical;
  const deviceCounts = summarizeDeviceCounts(
    devices.map((device) => ({
      status: device.status,
      lab: false,
    })),
  );

  return {
    generatedAt: new Date().toISOString(),
    devices,
    historicalDevices,
    excludedLabGateways: withReasons.filter((device) => isLabGateway(device)).length,
    counts: {
      online: deviceCounts.online,
      degraded: deviceCounts.degraded,
      offline: deviceCounts.offline,
      revoked: deviceCounts.revoked,
      unknown: deviceCounts.unknown,
      paidAwaitingFulfillment: paidBoard.counts.paidAwaitingFulfillment,
      rechargeUncertain: paidBoard.counts.rechargeUncertain,
      fulfillmentHeld: paidBoard.counts.fulfillmentHeld,
      unmatchedPayments: unmatchedResult,
      ambiguousPayments: ambiguousResult,
      activeAlerts: countActiveAlerts(devices, fulfillmentAlerts.rows),
    },
    paidOrders: paidBoard.paidOrders,
    recentCompleted: paidBoard.recentCompleted,
    reservationStateAvailable: paidBoard.reservationStateAvailable,
    fulfillmentAlertsAvailable: fulfillmentAlerts.available,
    manualHistory: manualHistory.entries,
    manualHistoryAvailable: manualHistory.available,
    safeguards,
  };
}

export async function listMerchantPayments(
  status: PaymentReviewFilter,
): Promise<MerchantPaymentEvent[]> {
  const db = createAdminClient();
  let query = db
    .from("bundle_merchant_payment_events")
    .select(MERCHANT_PAYMENT_COLUMNS)
    .is("operational_archived_at", null)
    .limit(100);

  if (status === "MATCHED") {
    query = query.eq("match_status", "MATCHED").order("matched_at", { ascending: false });
  } else if (status === "RESOLVED") {
    query = query.in("match_status", ["EXPIRED", "INVALID"]).order("received_at", { ascending: false });
  } else {
    query = query.eq("match_status", status).order("received_at", { ascending: false });
  }

  const [names, { data, error }] = await Promise.all([loadDeviceNames(), query]);
  throwIfError(error);
  const events = rows<PaymentRow>(data).map((row) => mapPayment(row, names));
  if (status !== "AMBIGUOUS" || events.length === 0) return events;
  const pending = await loadPendingOrders();
  return events.map((event) => {
    const candidates = paymentCandidateOrders(event, pending);
    return {
      ...event,
      candidateCount: candidates.length,
      candidateOrders: candidates.map((order) => ({ id: order.id, bundleName: order.bundleName })),
    };
  });
}

export async function getGatewayHistory(): Promise<GatewayHistory> {
  const db = createAdminClient();
  const [names, alertsResult, transitionsResult, fulfillment] = await Promise.all([
    loadDeviceNames(),
    db
      .from("merchant_gateway_alerts")
      .select("id, device_id, kind, payload, created_at")
      .is("operational_archived_at", null)
      .order("created_at", { ascending: false })
      .limit(100),
    db
      .from("merchant_gateway_health_transitions")
      .select("id, device_id, from_status, to_status, reason, created_at")
      .order("created_at", { ascending: false })
      .limit(100),
    loadFulfillmentAlerts(),
  ]);
  throwIfError(alertsResult.error);
  throwIfError(transitionsResult.error);

  const gatewayRows = (alertsResult.data ?? []) as AlertRow[];
  const batteryFacts = gatewayRows.map((row) => ({
    deviceId: row.device_id ? String(row.device_id) : "",
    kind: row.kind ?? "",
    at: row.created_at,
  }));
  const alerts = [
    ...gatewayRows.map((row) => {
      const item = mapAlert(row, names);
      const fact = {
        deviceId: row.device_id ? String(row.device_id) : "",
        kind: row.kind ?? "",
        at: row.created_at,
      };
      return batteryWarningCleared(fact, batteryFacts)
        ? { ...item, lifecycle: "resolved" as const }
        : item;
    }),
    ...fulfillment.rows.map(mapFulfillmentAlert),
  ].sort((left, right) => right.at.localeCompare(left.at));
  const transitions = ((transitionsResult.data ?? []) as TransitionRow[]).map((row) =>
    mapTransition(row, names),
  );
  return { alerts, transitions };
}

/**
 * Reads unresolved events, pending orders, and reconciliation audit rows.
 * Confirmation is forwarded to bundles-merchant-reconcile and is not applied here.
 */
export async function getReconciliationContext(): Promise<ReconciliationContext> {
  const db = createAdminClient();
  const [names, eventsResult, ordersResult, auditResult] = await Promise.all([
    loadDeviceNames(),
    db
      .from("bundle_merchant_payment_events")
      .select(MERCHANT_PAYMENT_COLUMNS)
      .is("operational_archived_at", null)
      .in("match_status", ["UNMATCHED", "AMBIGUOUS", "MANUAL_REVIEW"])
      .order("received_at", { ascending: false })
      .limit(100),
    db
      .from("bundle_purchase_orders")
      .select(PENDING_ORDER_COLUMNS)
      .is("operational_archived_at", null)
      .eq("payment_status", "PENDING")
      .eq("fulfillment_status", "NOT_STARTED")
      .order("created_at", { ascending: false })
      .limit(100),
    db
      .from("merchant_payment_reconciliation_audit")
      .select(RECONCILIATION_AUDIT_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);
  throwIfError(eventsResult.error);
  throwIfError(ordersResult.error);
  throwIfError(auditResult.error);

  const eligibleOrders = rows<OrderRow>(ordersResult.data).map(mapOrder);
  const unresolvedEvents = rows<PaymentRow>(eventsResult.data).map((row) => {
    const event = mapPayment(row, names);
    if (event.status !== "AMBIGUOUS") return event;
    const candidates = paymentCandidateOrders(event, eligibleOrders);
    return {
      ...event,
      candidateCount: candidates.length,
      candidateOrders: candidates.map((order) => ({ id: order.id, bundleName: order.bundleName })),
    };
  });

  return {
    available: true,
    unresolvedEvents,
    eligibleOrders,
    audit: rows<Parameters<typeof mapAuditEntry>[0]>(auditResult.data).map(mapAuditEntry),
  };
}

async function loadPendingOrders() {
  const db = createAdminClient();
  const { data, error } = await db
    .from("bundle_purchase_orders")
    .select(PENDING_ORDER_COLUMNS)
    .is("operational_archived_at", null)
    .eq("payment_status", "PENDING")
    .eq("fulfillment_status", "NOT_STARTED")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return [];
  return rows<OrderRow>(data).map(mapOrder);
}

async function countMatchStatus(status: string) {
  const db = createAdminClient();
  const { count, error } = await db
    .from("bundle_merchant_payment_events")
    .select("id", { count: "exact", head: true })
    .is("operational_archived_at", null)
    .eq("match_status", status);
  throwIfError(error);
  return count ?? 0;
}

async function loadDeviceNames() {
  const db = createAdminClient();
  const { data, error } = await db.from("merchant_gateway_devices").select("id, name");
  throwIfError(error);
  return new Map(
    ((data ?? []) as Array<{ id: string; name: string | null }>).map((row) => [
      String(row.id),
      row.name?.trim() || "Gateway",
    ]),
  );
}

type DeviceRow = {
  id: string;
  name: string | null;
  status: string | null;
  receiver_msisdns: unknown;
  last_heartbeat_at: string | null;
  battery_percent: number | null;
  battery_alert_level: string | null;
  is_charging: boolean | null;
  network_connected: boolean | null;
  network_type: string | null;
  evc_sim_detected: boolean | null;
  edahab_sim_detected: boolean | null;
  last_sms_received_at: string | null;
  last_event_at: string | null;
  last_merchant_event_sent_at: string | null;
  last_backend_ack_at: string | null;
  app_version: string | null;
  upload_failures: number | null;
  revoked_at: string | null;
};

function mapDevice(row: DeviceRow): MerchantGatewayDevice {
  return {
    id: String(row.id),
    name: row.name?.trim() || "Merchant gateway",
    status: normalizeGatewayStatus(row.status),
    receiverMsisdns: stringList(row.receiver_msisdns),
    lastHeartbeatAt: row.last_heartbeat_at,
    batteryPercent: numberOrNull(row.battery_percent),
    batteryAlertLevel: batteryAlertLevel(row.battery_alert_level),
    isCharging: booleanOrNull(row.is_charging),
    networkConnected: booleanOrNull(row.network_connected),
    networkType: row.network_type,
    evcSimDetected: booleanOrNull(row.evc_sim_detected),
    edahabSimDetected: booleanOrNull(row.edahab_sim_detected),
    lastSmsReceivedAt: row.last_sms_received_at,
    lastMerchantEventAt: row.last_merchant_event_sent_at ?? row.last_event_at,
    lastBackendAckAt: row.last_backend_ack_at,
    appVersion: row.app_version,
    uploadFailures: row.upload_failures ?? 0,
    revokedAt: row.revoked_at,
    statusReason: null,
    pendingUploadCount: null,
    lastSuccessfulUploadAt: null,
  };
}

type OrderRow = {
  id: string;
  bundle_name: string | null;
  payment_status: string | null;
  fulfillment_status: string | null;
  selling_price_cents: number | null;
  currency: string | null;
  payer_phone: string | null;
  payment_method: string | null;
  merchant_receiver_msisdn: string | null;
  receiver_phone: string | null;
  failure_code: string | null;
  created_at: string | null;
  expires_at: string | null;
};

function mapOrder(row: OrderRow): BundleOrderSnapshot {
  return {
    id: String(row.id),
    bundleName: row.bundle_name?.trim() || "Bundle order",
    paymentStatus: row.payment_status ?? "UNKNOWN",
    fulfillmentStatus: row.fulfillment_status ?? "UNKNOWN",
    sellingPriceCents: numberOrNull(row.selling_price_cents),
    currency: row.currency ?? "USD",
    payerPhone: row.payer_phone,
    paymentMethod: row.payment_method,
    merchantReceiverMsisdn: row.merchant_receiver_msisdn,
    rechargePhone: row.receiver_phone,
    failureCode: row.failure_code,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

type PaymentRow = {
  id: string;
  provider: string | null;
  payment_method: string | null;
  payer_msisdn: string | null;
  amount_cents: number | null;
  currency: string | null;
  merchant_receiver_msisdn: string | null;
  provider_txn_id: string | null;
  provider_timestamp: string | null;
  received_at: string | null;
  device_id: string | null;
  match_status: string | null;
  matched_at: string | null;
  created_at: string | null;
  faahfaahin: string | null;
  bank_ticket: string | null;
  provider_reference: string | null;
  matched_order?: OrderRow | OrderRow[] | null;
};

function mapPayment(row: PaymentRow, names: Map<string, string>): MerchantPaymentEvent {
  const embedded = row.matched_order;
  const orderRow = Array.isArray(embedded) ? embedded[0] : embedded;
  return {
    id: String(row.id),
    paymentMethod: row.payment_method,
    provider: row.provider,
    payerMsisdn: row.payer_msisdn,
    amountCents: numberOrNull(row.amount_cents) ?? 0,
    currency: row.currency ?? "USD",
    merchantReceiverMsisdn: row.merchant_receiver_msisdn,
    receivedAt: row.received_at,
    providerTimestamp: row.provider_timestamp,
    uploadedAt: row.created_at,
    providerTxnId: row.provider_txn_id,
    status: (row.match_status ?? "UNKNOWN").toUpperCase(),
    matchedAt: row.matched_at,
    deviceName: row.device_id ? (names.get(String(row.device_id)) ?? "Gateway") : null,
    order: orderRow ? mapOrder(orderRow) : null,
    candidateCount: null,
    candidateOrders: [],
    faahfaahin: row.faahfaahin,
    bankTicket: row.bank_ticket,
    providerReference: row.provider_reference,
  };
}

type AlertRow = {
  id: string;
  device_id: string | null;
  kind: string | null;
  payload: unknown;
  created_at: string;
};

function mapAlert(row: AlertRow, names: Map<string, string>): GatewayHistoryItem {
  const kind = row.kind ?? "gateway_alert";
  return {
    id: String(row.id),
    at: row.created_at,
    label: alertLabel(kind),
    detail: alertDetail(row.payload),
    deviceName: row.device_id ? (names.get(String(row.device_id)) ?? "Gateway") : "Gateway",
    tone: alertTone(kind),
    category: alertCategory(kind),
    lifecycle: alertLifecycle(kind),
  };
}

type FulfillmentAlertRow = {
  id: string;
  order_id: string | null;
  kind: string | null;
  payload: unknown;
  created_at: string;
};

function mapFulfillmentAlert(row: FulfillmentAlertRow): GatewayHistoryItem {
  const kind = row.kind ?? "fulfillment_held";
  const orderId = row.order_id ? String(row.order_id) : "";
  return {
    id: String(row.id),
    at: row.created_at,
    label: alertLabel(kind),
    detail: alertDetail(row.payload),
    deviceName: orderId ? `Order ${orderId.slice(0, 8)}` : "Bundle order",
    tone: alertTone(kind),
    category: "fulfillment",
    lifecycle: alertLifecycle(kind),
  };
}

type TransitionRow = {
  id: string;
  device_id: string | null;
  from_status: string | null;
  to_status: string | null;
  reason: string | null;
  created_at: string;
};

function mapTransition(row: TransitionRow, names: Map<string, string>): GatewayHistoryItem {
  const toStatus = normalizeGatewayStatus(row.to_status);
  const fromStatus = normalizeGatewayStatus(row.from_status);
  const reason = row.reason?.replace(/_/g, " ");
  return {
    id: String(row.id),
    at: row.created_at,
    label: `${fromStatus} → ${toStatus}`,
    detail: reason ? `Reason: ${reason}` : "Gateway health transition",
    deviceName: row.device_id ? (names.get(String(row.device_id)) ?? "Gateway") : "Gateway",
    tone: transitionTone(row.to_status ?? ""),
    category: "gateway",
    lifecycle: transitionTone(row.to_status ?? "") === "success" ? "resolved" : "active",
  };
}

function stringList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim() !== "");
}

function numberOrNull(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

function booleanOrNull(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function rows<T>(data: unknown): T[] {
  return Array.isArray(data) ? (data as T[]) : [];
}

/**
 * Latest non-empty transition reason per device. Read alongside the device
 * list rather than after it: every transition belongs to a gateway device,
 * so filtering by the device ids first only added a round trip.
 */
async function loadStatusReasons() {
  const reasons = new Map<string, string>();
  const db = createAdminClient();
  const { data, error } = await db
    .from("merchant_gateway_health_transitions")
    .select("device_id, reason, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return reasons;
  for (const row of (data ?? []) as Array<{ device_id: string; reason: string | null }>) {
    const id = String(row.device_id);
    if (reasons.has(id) || !row.reason?.trim()) continue;
    reasons.set(id, row.reason.replace(/_/g, " "));
  }
  return reasons;
}

async function loadFulfillmentAlerts() {
  const db = createAdminClient();
  const { data, error } = await db
    .from("bundle_fulfillment_alerts")
    .select("id, order_id, kind, payload, created_at")
    .is("operational_archived_at", null)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return { available: false, rows: [] as FulfillmentAlertRow[] };
  return { available: true, rows: (data ?? []) as FulfillmentAlertRow[] };
}

async function loadManualHistory(): Promise<{
  available: boolean;
  entries: ManualFulfillmentHistoryEntry[];
}> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("bundle_manual_fulfillment_audit")
    .select(
      "id, order_id, admin_user_id, action, top_tayo_transaction_id, reservation_outcome, fulfillment_status, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) return { available: false, entries: [] };

  const auditRows = (data ?? []) as Array<{
    id: string;
    order_id: string;
    admin_user_id: string | null;
    action: string;
    top_tayo_transaction_id: string | null;
    reservation_outcome: string | null;
    fulfillment_status: string | null;
    created_at: string;
  }>;
  const adminIds = [
    ...new Set(auditRows.map((row) => row.admin_user_id).filter((id): id is string => Boolean(id))),
  ];
  const emails = new Map<string, string>();
  if (adminIds.length > 0) {
    const admins = await db.from("admin_users").select("id, email").in("id", adminIds);
    if (!admins.error) {
      for (const admin of (admins.data ?? []) as Array<{ id: string; email: string | null }>) {
        if (admin.email) emails.set(String(admin.id), admin.email);
      }
    }
  }

  return {
    available: true,
    entries: auditRows.map((row) => ({
      id: String(row.id),
      orderId: String(row.order_id),
      adminEmail: (row.admin_user_id && emails.get(String(row.admin_user_id))) || "Admin",
      action: row.action,
      reservationOutcome: row.reservation_outcome,
      fulfillmentStatus: row.fulfillment_status,
      topTayoTransactionId: row.top_tayo_transaction_id,
      createdAt: row.created_at,
    })),
  };
}

function countActiveAlerts(
  devices: MerchantGatewayDevice[],
  alerts: FulfillmentAlertRow[],
) {
  const gateway = devices.filter(
    (device) =>
      device.status === "OFFLINE" || device.status === "DEGRADED" || device.status === "REVOKED",
  ).length;
  const battery = devices.filter(
    (device) => device.status !== "REVOKED" && device.batteryAlertLevel != null,
  ).length;
  const recovered = new Set(
    alerts
      .filter((alert) => alert.kind === "fulfillment_recovered" && alert.order_id)
      .map((alert) => String(alert.order_id)),
  );
  const open = new Set(
    alerts
      .filter(
        (alert) =>
          alert.kind !== "fulfillment_recovered" &&
          alert.order_id &&
          !recovered.has(String(alert.order_id)),
      )
      .map((alert) => String(alert.order_id)),
  );
  return gateway + battery + open.size;
}

function throwIfError(error: { message: string } | null) {
  if (error) throw error;
}

/**
 * Archived pre-production records. Original payment and fulfillment statuses
 * are shown as stored. This view is not a fulfillment success list.
 */
export async function getTestingHistory(): Promise<TestingHistory> {
  const db = createAdminClient();
  const [ordersResult, paymentsResult, gatewayAlertsResult, fulfillmentAlertsResult] = await Promise.all([
    db
      .from("bundle_purchase_orders")
      .select("id, bundle_name, payment_status, fulfillment_status, operational_archived_at, operational_archive_kind")
      .not("operational_archived_at", "is", null)
      .order("operational_archived_at", { ascending: false })
      .limit(100),
    db
      .from("bundle_merchant_payment_events")
      .select("id, match_status, amount_cents, currency, operational_archived_at")
      .not("operational_archived_at", "is", null)
      .order("operational_archived_at", { ascending: false })
      .limit(100),
    db
      .from("merchant_gateway_alerts")
      .select("id, kind, operational_archived_at")
      .not("operational_archived_at", "is", null)
      .order("operational_archived_at", { ascending: false })
      .limit(100),
    db
      .from("bundle_fulfillment_alerts")
      .select("id, kind, order_id, operational_archived_at")
      .not("operational_archived_at", "is", null)
      .order("operational_archived_at", { ascending: false })
      .limit(100),
  ]);
  throwIfError(ordersResult.error);
  throwIfError(paymentsResult.error);
  throwIfError(gatewayAlertsResult.error);
  throwIfError(fulfillmentAlertsResult.error);

  const orders = rows<Record<string, unknown>>(ordersResult.data).map((row) =>
    historyRecord({
      id: String(row.id),
      kind: "order",
      label: textOr(row.bundle_name, "Bundle order"),
      detail: `Payment ${textOr(row.payment_status, "unknown")} · Fulfillment ${textOr(row.fulfillment_status, "unknown")}`,
      archivedAt: textOr(row.operational_archived_at, ""),
      financialStatus: textOr(row.fulfillment_status, null),
    }),
  );
  const payments = rows<Record<string, unknown>>(paymentsResult.data).map((row) =>
    historyRecord({
      id: String(row.id),
      kind: "payment",
      label: textOr(row.match_status, "Payment"),
      detail: "Archived from the live review queue. Match status was not changed.",
      archivedAt: textOr(row.operational_archived_at, ""),
      financialStatus: textOr(row.match_status, null),
    }),
  );
  const alerts = [
    ...rows<Record<string, unknown>>(gatewayAlertsResult.data).map((row) =>
      historyRecord({
        id: String(row.id),
        kind: "gateway_alert" as const,
        label: textOr(row.kind, "Gateway alert"),
        detail: "Archived gateway alert",
        archivedAt: textOr(row.operational_archived_at, ""),
        financialStatus: null,
      }),
    ),
    ...rows<Record<string, unknown>>(fulfillmentAlertsResult.data).map((row) =>
      historyRecord({
        id: String(row.id),
        kind: "fulfillment_alert" as const,
        label: textOr(row.kind, "Fulfillment alert"),
        detail: "Archived fulfillment alert. The order status was not changed.",
        archivedAt: textOr(row.operational_archived_at, ""),
        financialStatus: null,
      }),
    ),
  ];
  return { orders, payments, alerts };
}

function historyRecord(record: TestingHistoryRecord): TestingHistoryRecord {
  return record;
}

function textOr(value: unknown, fallback: string): string;
function textOr(value: unknown, fallback: null): string | null;
function textOr(value: unknown, fallback: string | null) {
  return typeof value === "string" && value.trim() ? value : fallback;
}
