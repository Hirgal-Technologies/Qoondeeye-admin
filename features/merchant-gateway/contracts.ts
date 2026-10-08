import type { ProductionSafeguardView } from "@/features/operations/contracts";

export type GatewayHealthStatus =
  | "ONLINE"
  | "DEGRADED"
  | "OFFLINE"
  | "REVOKED"
  | "UNKNOWN";

export type PaymentReviewFilter =
  | "UNMATCHED"
  | "AMBIGUOUS"
  | "MANUAL_REVIEW"
  | "NEEDS_REVIEW"
  | "UNMATCHED_AMOUNT"
  | "CONFIGURATION_ERROR"
  | "MATCHED"
  | "RESOLVED";

export type MerchantGatewaySection =
  | "gateways"
  | "payments"
  | "alerts"
  | "reconciliation"
  | "history";

export type TestingHistoryRecord = {
  id: string;
  kind: "order" | "payment" | "gateway_alert" | "fulfillment_alert";
  label: string;
  detail: string;
  archivedAt: string;
  /** Original status text. Administrative archive does not rewrite this into success. */
  financialStatus: string | null;
};

export type TestingHistory = {
  orders: TestingHistoryRecord[];
  payments: TestingHistoryRecord[];
  alerts: TestingHistoryRecord[];
};

export type MerchantGatewayDevice = {
  id: string;
  name: string;
  status: GatewayHealthStatus;
  receiverMsisdns: string[];
  lastHeartbeatAt: string | null;
  batteryPercent: number | null;
  /** Active battery warning. Null after recovery or when no warning is open. */
  batteryAlertLevel: "low" | "critical" | null;
  isCharging: boolean | null;
  networkConnected: boolean | null;
  networkType: string | null;
  evcSimDetected: boolean | null;
  edahabSimDetected: boolean | null;
  lastSmsReceivedAt: string | null;
  lastMerchantEventAt: string | null;
  lastBackendAckAt: string | null;
  appVersion: string | null;
  uploadFailures: number;
  revokedAt: string | null;
  /** Latest health-transition reason when the backend stored one. */
  statusReason: string | null;
  /** Null when the gateway does not report a pending-upload count. */
  pendingUploadCount: number | null;
  /** Null when the gateway does not report a last successful upload. */
  lastSuccessfulUploadAt: string | null;
};

export type MerchantGatewayCounts = {
  online: number;
  degraded: number;
  offline: number;
  revoked: number;
  unknown: number;
  paidAwaitingFulfillment: number;
  rechargeUncertain: number;
  fulfillmentHeld: number;
  unmatchedPayments: number;
  ambiguousPayments: number;
  activeAlerts: number;
};

export type PaidFulfillmentOrder = {
  id: string;
  payerPhone: string | null;
  destinationPhone: string | null;
  paymentMethod: string | null;
  amountPaidCents: number | null;
  currency: string;
  bundleName: string;
  providerName: string | null;
  topTayoCostCents: number | null;
  merchantProviderTxnId: string | null;
  merchantTxnLookup: "known" | "unavailable";
  paymentStatus: string;
  fulfillmentStatus: string;
  reservationOutcome: string | null;
  reservationKnown: boolean;
  failureCode: string | null;
  topTayoTransactionIds: string[];
  /** TopTayo id accepted by the admin server when Qoondeeye recording is still pending. */
  pendingRecordTransactionId: string | null;
  paidAt: string | null;
  lastFulfillmentAttemptAt: string | null;
  updatedAt: string | null;
};

export type ManualFulfillmentHistoryEntry = {
  id: string;
  orderId: string;
  adminEmail: string;
  action: string;
  reservationOutcome: string | null;
  fulfillmentStatus: string | null;
  topTayoTransactionId: string | null;
  createdAt: string;
};

export type MerchantGatewaySummary = {
  generatedAt: string;
  devices: MerchantGatewayDevice[];
  historicalDevices: MerchantGatewayDevice[];
  excludedLabGateways: number;
  counts: MerchantGatewayCounts;
  paidOrders: PaidFulfillmentOrder[];
  recentCompleted: PaidFulfillmentOrder[];
  reservationStateAvailable: boolean;
  fulfillmentAlertsAvailable: boolean;
  manualHistory: ManualFulfillmentHistoryEntry[];
  manualHistoryAvailable: boolean;
  safeguards: ProductionSafeguardView;
};

export type BundleOrderSnapshot = {
  id: string;
  bundleName: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  sellingPriceCents: number | null;
  currency: string;
  payerPhone: string | null;
  paymentMethod: string | null;
  merchantReceiverMsisdn: string | null;
  rechargePhone: string | null;
  failureCode: string | null;
  createdAt: string | null;
  expiresAt: string | null;
};

export type MerchantPaymentEvent = {
  id: string;
  paymentMethod: string | null;
  provider: string | null;
  payerMsisdn: string | null;
  amountCents: number;
  currency: string;
  merchantReceiverMsisdn: string | null;
  receivedAt: string | null;
  providerTimestamp: string | null;
  uploadedAt: string | null;
  providerTxnId: string | null;
  status: string;
  matchedAt: string | null;
  deviceName: string | null;
  order: BundleOrderSnapshot | null;
  /** Pending orders that share amount, currency, method, and receiver. Null when not computed. */
  candidateCount: number | null;
  candidateOrders: Array<{ id: string; bundleName: string }>;
  faahfaahin: string | null;
  bankTicket: string | null;
  providerReference: string | null;
};

export type GatewayHistoryItem = {
  id: string;
  at: string;
  label: string;
  detail: string;
  deviceName: string;
  tone: "critical" | "warning" | "success" | "neutral";
  category: "gateway" | "payment" | "fulfillment";
  lifecycle: "active" | "resolved";
};

export type GatewayHistory = {
  alerts: GatewayHistoryItem[];
  transitions: GatewayHistoryItem[];
};

export type ReconciliationAuditEntry = {
  id: string;
  eventId: string;
  orderId: string;
  adminEmail: string;
  resolutionType: string;
  reason: string | null;
  createdAt: string;
};

export type ReconciliationContext = {
  available: true;
  unresolvedEvents: MerchantPaymentEvent[];
  eligibleOrders: BundleOrderSnapshot[];
  audit: ReconciliationAuditEntry[];
};

export type ReconciliationRequest = {
  eventId: string;
  orderId: string;
  reason?: string;
  allowPayerMismatch: boolean;
  allowExpiredOrder: boolean;
};

export type ReconciliationResult = {
  ok: true;
  idempotent: boolean;
  eventId: string;
  orderId: string;
  matchStatus: string;
  resolutionType: string;
  auditId: string;
  fulfillment: string;
  orderFulfillmentStatus: string | null;
  orderPaymentStatus: string | null;
};
