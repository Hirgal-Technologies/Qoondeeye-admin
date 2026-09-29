import "server-only";
import {
  MERCHANT_DEVICE_COLUMNS,
  MERCHANT_PAYMENT_COLUMNS,
  PENDING_ORDER_COLUMNS,
  RECONCILIATION_AUDIT_COLUMNS,
} from "@/features/merchant-gateway/columns";
import type {
  BundleOrderSnapshot,
  FulfillmentException,
  GatewayHistory,
  GatewayHistoryItem,
  MerchantGatewayDevice,
  MerchantGatewaySummary,
  MerchantPaymentEvent,
  PaymentReviewFilter,
  ReconciliationContext,
} from "@/features/merchant-gateway/contracts";
import {
  alertDetail,
  alertLabel,
  alertTone,
  isLabGateway,
  mapAuditEntry,
  normalizeGatewayStatus,
  transitionTone,
} from "@/features/merchant-gateway/presentation";
import { createAdminClient } from "@/lib/supabase/admin";

const FAILED_FULFILLMENT_FILTER =
  "fulfillment_status.in.(FAILED,UNCERTAIN,UNKNOWN,ERROR),and(failed_at.not.is.null,fulfillment_status.neq.COMPLETED)";

export async function getMerchantGatewaySummary(): Promise<MerchantGatewaySummary> {
  const db = createAdminClient();
  const [devicesResult, pendingResult, unmatchedResult, ambiguousResult, manualResult, failedResult, exceptionsResult] =
    await Promise.all([
      db.from("merchant_gateway_devices").select(MERCHANT_DEVICE_COLUMNS).order("name"),
      db
        .from("bundle_purchase_orders")
        .select("id", { count: "exact", head: true })
        .eq("payment_status", "PENDING"),
      countMatchStatus("UNMATCHED"),
      countMatchStatus("AMBIGUOUS"),
      countMatchStatus("MANUAL_REVIEW"),
      db
        .from("bundle_purchase_orders")
        .select("id", { count: "exact", head: true })
        .or(FAILED_FULFILLMENT_FILTER),
      db
        .from("bundle_purchase_orders")
        .select("id, bundle_name, payment_status, fulfillment_status, failure_code, updated_at")
        .or(FAILED_FULFILLMENT_FILTER)
        .order("updated_at", { ascending: false })
        .limit(20),
    ]);

  throwIfError(devicesResult.error);
  throwIfError(pendingResult.error);
  throwIfError(failedResult.error);
  throwIfError(exceptionsResult.error);

  const devices = rows<DeviceRow>(devicesResult.data).map(mapDevice);
  const production = devices.filter((device) => !isLabGateway(device));
  return {
    devices,
    counts: {
      online: production.filter((device) => device.status === "ONLINE").length,
      degraded: production.filter((device) => device.status === "DEGRADED").length,
      offline: production.filter((device) => device.status === "OFFLINE").length,
      revoked: production.filter((device) => device.status === "REVOKED").length,
      unknown: production.filter((device) => device.status === "UNKNOWN").length,
      pendingOrders: pendingResult.count ?? 0,
      unmatchedPayments: unmatchedResult,
      ambiguousPayments: ambiguousResult,
      manualReviewPayments: manualResult,
      failedFulfillment: failedResult.count ?? 0,
    },
    fulfillmentExceptions: rows<ExceptionRow>(exceptionsResult.data).map(mapException),
  };
}

export async function listMerchantPayments(
  status: PaymentReviewFilter,
): Promise<MerchantPaymentEvent[]> {
  const db = createAdminClient();
  const names = await loadDeviceNames();
  let query = db
    .from("bundle_merchant_payment_events")
    .select(MERCHANT_PAYMENT_COLUMNS)
    .limit(100);

  if (status === "MATCHED") {
    query = query.eq("match_status", "MATCHED").order("matched_at", { ascending: false });
  } else {
    query = query.eq("match_status", status).order("received_at", { ascending: false });
  }

  const { data, error } = await query;
  throwIfError(error);
  return rows<PaymentRow>(data).map((row) => mapPayment(row, names));
}

export async function getGatewayHistory(): Promise<GatewayHistory> {
  const db = createAdminClient();
  const names = await loadDeviceNames();
  const [alertsResult, transitionsResult] = await Promise.all([
    db
      .from("merchant_gateway_alerts")
      .select("id, device_id, kind, payload, created_at")
      .order("created_at", { ascending: false })
      .limit(100),
    db
      .from("merchant_gateway_health_transitions")
      .select("id, device_id, from_status, to_status, reason, created_at")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  throwIfError(alertsResult.error);
  throwIfError(transitionsResult.error);

  const alerts = ((alertsResult.data ?? []) as AlertRow[]).map((row) =>
    mapAlert(row, names),
  );
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
  const names = await loadDeviceNames();
  const [eventsResult, ordersResult, auditResult] = await Promise.all([
    db
      .from("bundle_merchant_payment_events")
      .select(MERCHANT_PAYMENT_COLUMNS)
      .in("match_status", ["UNMATCHED", "AMBIGUOUS", "MANUAL_REVIEW"])
      .order("received_at", { ascending: false })
      .limit(100),
    db
      .from("bundle_purchase_orders")
      .select(PENDING_ORDER_COLUMNS)
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

  return {
    available: true,
    unresolvedEvents: rows<PaymentRow>(eventsResult.data).map((row) => mapPayment(row, names)),
    eligibleOrders: rows<OrderRow>(ordersResult.data).map(mapOrder),
    audit: rows<Parameters<typeof mapAuditEntry>[0]>(auditResult.data).map(mapAuditEntry),
  };
}

async function countMatchStatus(status: string) {
  const db = createAdminClient();
  const { count, error } = await db
    .from("bundle_merchant_payment_events")
    .select("id", { count: "exact", head: true })
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
  };
}

type ExceptionRow = {
  id: string;
  bundle_name: string | null;
  payment_status: string | null;
  fulfillment_status: string | null;
  failure_code: string | null;
  updated_at: string | null;
};

function mapException(row: ExceptionRow): FulfillmentException {
  return {
    id: String(row.id),
    bundleName: row.bundle_name?.trim() || "Bundle order",
    paymentStatus: row.payment_status ?? "UNKNOWN",
    fulfillmentStatus: row.fulfillment_status ?? "UNKNOWN",
    failureCode: row.failure_code,
    updatedAt: row.updated_at,
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

function throwIfError(error: { message: string } | null) {
  if (error) throw error;
}
