/**
 * Explicit column lists for merchant reads.
 * hmac_secret, enrollment token hashes, request nonces, and SMS body hashes
 * are intentionally absent.
 */
export const MERCHANT_DEVICE_COLUMNS = [
  "id",
  "name",
  "status",
  "receiver_msisdns",
  "last_heartbeat_at",
  "battery_percent",
  "is_charging",
  "network_connected",
  "network_type",
  "evc_sim_detected",
  "edahab_sim_detected",
  "last_sms_received_at",
  "last_event_at",
  "last_merchant_event_sent_at",
  "last_backend_ack_at",
  "app_version",
  "upload_failures",
  "revoked_at",
].join(",");

export const MERCHANT_PAYMENT_COLUMNS = [
  "id",
  "provider",
  "payment_method",
  "payer_msisdn",
  "amount_cents",
  "currency",
  "merchant_receiver_msisdn",
  "provider_txn_id",
  "provider_timestamp",
  "received_at",
  "device_id",
  "match_status",
  "matched_order_id",
  "matched_at",
  "created_at",
  "faahfaahin",
  "bank_ticket",
  "provider_reference",
  "matched_order:bundle_purchase_orders!matched_order_id(id,bundle_name,payment_status,fulfillment_status,selling_price_cents,currency,payer_phone,payment_method,merchant_receiver_msisdn,receiver_phone,failure_code,created_at,expires_at)",
].join(",");

export const PENDING_ORDER_COLUMNS = [
  "id",
  "bundle_name",
  "payment_status",
  "fulfillment_status",
  "selling_price_cents",
  "currency",
  "payer_phone",
  "payment_method",
  "merchant_receiver_msisdn",
  "receiver_phone",
  "failure_code",
  "created_at",
  "expires_at",
].join(",");

export const RECONCILIATION_AUDIT_COLUMNS =
  "id,event_id,order_id,reason,resolution_type,created_at,admin:admin_users!admin_user_id(email)";

export const SECRET_COLUMN_NAMES = [
  "hmac_secret",
  "token_hash",
  "nonce",
  "body_hash",
  "body_sha256",
] as const;
