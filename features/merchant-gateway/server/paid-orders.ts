import "server-only";
import type { PaidFulfillmentOrder } from "@/features/merchant-gateway/contracts";
import { CLOSED_FULFILLMENT_STATUSES, HOLD_FAILURE_CODES } from "@/features/merchant-gateway/operations";
import { createAdminClient } from "@/lib/supabase/admin";

const PAID_ORDER_COLUMNS = [
  "id",
  "bundle_name",
  "provider_name",
  "payment_status",
  "fulfillment_status",
  "selling_price_cents",
  "top_tayo_cost_cents",
  "currency",
  "payer_phone",
  "receiver_phone",
  "payment_method",
  "failure_code",
  "top_tayo_transaction_ids",
  "payment_confirmed_at",
  "fulfillment_started_at",
  "updated_at",
  "created_at",
].join(",");

export { PAID_ORDER_COLUMNS };

type OrderRow = {
  id: string;
  bundle_name: string | null;
  provider_name: string | null;
  payment_status: string | null;
  fulfillment_status: string | null;
  selling_price_cents: number | null;
  top_tayo_cost_cents: number | null;
  currency: string | null;
  payer_phone: string | null;
  receiver_phone: string | null;
  payment_method: string | null;
  failure_code: string | null;
  top_tayo_transaction_ids: unknown;
  payment_confirmed_at: string | null;
  fulfillment_started_at: string | null;
  updated_at: string | null;
  created_at: string | null;
};

export async function loadPaidFulfillmentBoard(): Promise<{
  paidOrders: PaidFulfillmentOrder[];
  recentCompleted: PaidFulfillmentOrder[];
  reservationStateAvailable: boolean;
  counts: {
    paidAwaitingFulfillment: number;
    rechargeUncertain: number;
    fulfillmentHeld: number;
  };
}> {
  const db = createAdminClient();
  const [openResult, completedResult, awaitingCount, uncertainCount, heldCount] = await Promise.all([
    db
      .from("bundle_purchase_orders")
      .select(PAID_ORDER_COLUMNS)
      .is("operational_archived_at", null)
      .eq("payment_status", "PAYMENT_CONFIRMED")
      .not("fulfillment_status", "in", `(${CLOSED_FULFILLMENT_STATUSES.join(",")})`)
      .order("payment_confirmed_at", { ascending: true })
      .limit(50),
    db
      .from("bundle_purchase_orders")
      .select(PAID_ORDER_COLUMNS)
      .is("operational_archived_at", null)
      .eq("payment_status", "PAYMENT_CONFIRMED")
      .eq("fulfillment_status", "COMPLETED")
      .order("completed_at", { ascending: false })
      .limit(12),
    db
      .from("bundle_purchase_orders")
      .select("id", { count: "exact", head: true })
      .is("operational_archived_at", null)
      .eq("payment_status", "PAYMENT_CONFIRMED")
      .not("fulfillment_status", "in", `(${CLOSED_FULFILLMENT_STATUSES.join(",")})`),
    db
      .from("bundle_purchase_orders")
      .select("id", { count: "exact", head: true })
      .is("operational_archived_at", null)
      .eq("payment_status", "PAYMENT_CONFIRMED")
      .not("fulfillment_status", "in", `(${CLOSED_FULFILLMENT_STATUSES.join(",")})`)
      .eq("failure_code", "recharge_uncertain"),
    db
      .from("bundle_purchase_orders")
      .select("id", { count: "exact", head: true })
      .is("operational_archived_at", null)
      .eq("payment_status", "PAYMENT_CONFIRMED")
      .not("fulfillment_status", "in", `(${CLOSED_FULFILLMENT_STATUSES.join(",")})`)
      .in("failure_code", [...HOLD_FAILURE_CODES]),
  ]);

  throwIfError(openResult.error);
  throwIfError(completedResult.error);
  throwIfError(awaitingCount.error);
  throwIfError(uncertainCount.error);
  throwIfError(heldCount.error);

  const openRows = rows<OrderRow>(openResult.data);
  const completedRows = rows<OrderRow>(completedResult.data);
  const ids = [...openRows, ...completedRows].map((row) => String(row.id));
  const [reservations, merchantTxns, pendingRecords] = await Promise.all([
    loadReservations(ids),
    loadMerchantTxns(ids),
    loadPendingRecords(ids),
  ]);

  return {
    paidOrders: openRows.map((row) => mapPaidOrder(row, reservations, merchantTxns, pendingRecords)),
    recentCompleted: completedRows.map((row) =>
      mapPaidOrder(row, reservations, merchantTxns, pendingRecords),
    ),
    reservationStateAvailable: reservations.available,
    counts: {
      paidAwaitingFulfillment: awaitingCount.count ?? 0,
      rechargeUncertain: uncertainCount.count ?? 0,
      fulfillmentHeld: heldCount.count ?? 0,
    },
  };
}

export async function loadPaidOrderById(orderId: string): Promise<PaidFulfillmentOrder | null> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("bundle_purchase_orders")
    .select(PAID_ORDER_COLUMNS)
    .eq("id", orderId)
    .maybeSingle();
  throwIfError(error);
  if (!data) return null;
  const row = data as unknown as OrderRow;
  const [reservations, merchantTxns, pendingRecords] = await Promise.all([
    loadReservations([orderId]),
    loadMerchantTxns([orderId]),
    loadPendingRecords([orderId]),
  ]);
  return mapPaidOrder(row, reservations, merchantTxns, pendingRecords);
}

async function loadReservations(orderIds: string[]) {
  if (orderIds.length === 0) return { available: true, outcomes: new Map<string, string | null>() };
  const db = createAdminClient();
  const { data, error } = await db
    .from("bundle_production_recharge_reservations")
    .select("order_id, outcome")
    .in("order_id", orderIds);
  if (error) return { available: false, outcomes: new Map<string, string | null>() };
  const outcomes = new Map<string, string | null>();
  for (const row of rows<{ order_id: string; outcome: string | null }>(data)) {
    outcomes.set(String(row.order_id), row.outcome);
  }
  return { available: true, outcomes };
}

async function loadMerchantTxns(orderIds: string[]) {
  if (orderIds.length === 0) {
    return { available: true, txns: new Map<string, string | null>() };
  }
  const db = createAdminClient();
  const { data, error } = await db
    .from("bundle_merchant_payment_events")
    .select("matched_order_id, provider_txn_id")
    .in("matched_order_id", orderIds)
    .eq("match_status", "MATCHED");
  if (error) return { available: false, txns: new Map<string, string | null>() };
  const txns = new Map<string, string | null>();
  for (const row of rows<{ matched_order_id: string | null; provider_txn_id: string | null }>(data)) {
    if (!row.matched_order_id || txns.has(String(row.matched_order_id))) continue;
    txns.set(String(row.matched_order_id), row.provider_txn_id);
  }
  return { available: true, txns };
}

async function loadPendingRecords(orderIds: string[]) {
  const pending = new Map<string, string>();
  if (orderIds.length === 0) return pending;
  const db = createAdminClient();
  const { data, error } = await db
    .from("audit_log")
    .select("metadata, created_at")
    .eq("action", "manual_fulfillment_toptayo_accepted")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return pending;
  const wanted = new Set(orderIds);
  for (const row of rows<{ metadata: unknown }>(data)) {
    const metadata =
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : null;
    const orderId = typeof metadata?.orderId === "string" ? metadata.orderId : "";
    const transactionId =
      typeof metadata?.transactionId === "string" ? metadata.transactionId.trim() : "";
    if (!wanted.has(orderId) || !transactionId || pending.has(orderId)) continue;
    pending.set(orderId, transactionId);
  }
  return pending;
}

function mapPaidOrder(
  row: OrderRow,
  reservations: { available: boolean; outcomes: Map<string, string | null> },
  merchantTxns: { available: boolean; txns: Map<string, string | null> },
  pendingRecords: Map<string, string>,
): PaidFulfillmentOrder {
  const id = String(row.id);
  return {
    id,
    payerPhone: row.payer_phone,
    destinationPhone: row.receiver_phone,
    paymentMethod: row.payment_method,
    amountPaidCents: numberOrNull(row.selling_price_cents),
    currency: row.currency ?? "USD",
    bundleName: row.bundle_name?.trim() || "Bundle order",
    providerName: row.provider_name,
    topTayoCostCents: numberOrNull(row.top_tayo_cost_cents),
    merchantProviderTxnId: merchantTxns.available ? (merchantTxns.txns.get(id) ?? null) : null,
    merchantTxnLookup: merchantTxns.available ? "known" : "unavailable",
    paymentStatus: row.payment_status ?? "UNKNOWN",
    fulfillmentStatus: row.fulfillment_status ?? "UNKNOWN",
    reservationOutcome: reservations.available ? (reservations.outcomes.get(id) ?? null) : null,
    reservationKnown: reservations.available,
    failureCode: row.failure_code,
    topTayoTransactionIds: stringList(row.top_tayo_transaction_ids),
    pendingRecordTransactionId: pendingRecords.get(id) ?? null,
    paidAt: row.payment_confirmed_at,
    lastFulfillmentAttemptAt: row.fulfillment_started_at,
    updatedAt: row.updated_at,
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

function rows<T>(data: unknown): T[] {
  return Array.isArray(data) ? (data as T[]) : [];
}

function throwIfError(error: { message: string } | null) {
  if (error) throw error;
}
