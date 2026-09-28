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
  | "MATCHED";

export type MerchantGatewaySection =
  | "gateways"
  | "payments"
  | "alerts"
  | "reconciliation";

export type MerchantGatewayDevice = {
  id: string;
  name: string;
  status: GatewayHealthStatus;
  receiverMsisdns: string[];
  lastHeartbeatAt: string | null;
  batteryPercent: number | null;
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
};

export type MerchantGatewayCounts = {
  online: number;
  degraded: number;
  offline: number;
  revoked: number;
  unknown: number;
  pendingOrders: number;
  unmatchedPayments: number;
  ambiguousPayments: number;
  manualReviewPayments: number;
  failedFulfillment: number;
};

export type FulfillmentException = {
  id: string;
  bundleName: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  failureCode: string | null;
  updatedAt: string | null;
};

export type MerchantGatewaySummary = {
  devices: MerchantGatewayDevice[];
  counts: MerchantGatewayCounts;
  fulfillmentExceptions: FulfillmentException[];
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
};

export type GatewayHistoryItem = {
  id: string;
  at: string;
  label: string;
  detail: string;
  deviceName: string;
  tone: "critical" | "warning" | "success" | "neutral";
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
