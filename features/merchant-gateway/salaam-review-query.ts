/**
 * Salaam review reads two foreign keys into offline_bundle_payment_mappings.
 * PostgREST rejects an unqualified embed, so each relationship is named.
 */

export const SALAAM_OFFLINE_MAPPING_FK =
  "salaam_offline_review_cases_offline_mapping_id_fkey";

export const SALAAM_INTENDED_MAPPING_FK =
  "salaam_offline_review_cases_intended_mapping_id_fkey";

const OFFLINE_MAPPING_COLUMNS =
  "top_tayo_bundle_id,destination_type,offline_category";

const INTENDED_MAPPING_COLUMNS =
  "id,top_tayo_bundle_id,offline_payment_amount_cents,destination_type,offline_category";

export const SALAAM_REVIEW_LIST_SELECT = [
  "*",
  `offline_mapping:offline_bundle_payment_mappings!${SALAAM_OFFLINE_MAPPING_FK}(${OFFLINE_MAPPING_COLUMNS})`,
  `intended_mapping:offline_bundle_payment_mappings!${SALAAM_INTENDED_MAPPING_FK}(${INTENDED_MAPPING_COLUMNS})`,
].join(",");

export type SalaamMappingEmbed = {
  id: string | null;
  bundleId: string;
  destinationType: string | null;
  offlineCategory: string | null;
  priceCents: number | null;
};

export type SalaamReviewRecord = {
  id: string;
  status: "needs_review" | "claimed" | "resolved";
  reason: "missing_faahfaahin" | "invalid_destination" | "unmatched_amount";
  amountCents: number;
  payerMsisdn: string;
  originalFaahfaahin: string | null;
  correctedDestination: string | null;
  bankTicket: string | null;
  providerReference: string | null;
  receivedAt: string;
  claimedBy: string | null;
  claimedByName: string | null;
  claimedAt: string | null;
  resolvedBy: string | null;
  resolvedByName: string | null;
  resolvedAt: string | null;
  bundleId: string;
  providerName: string | null;
  bundleName: string | null;
  destinationType: string | null;
  orderId: string | null;
  eventId: string;
  offlineMapping: SalaamMappingEmbed | null;
  intendedMappingId: string | null;
  intendedProviderName: string | null;
  intendedBundleName: string | null;
  intendedPriceCents: number | null;
  priceDifferenceCents: number | null;
  intendedMapping: SalaamMappingEmbed | null;
  resolutionType: "no_fulfillment" | null;
  resolutionNote: string | null;
};

function text(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function embed(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function mappingEmbed(value: unknown): SalaamMappingEmbed | null {
  const row = embed(value);
  if (!row) return null;
  return {
    id: text(row.id),
    bundleId: text(row.top_tayo_bundle_id) ?? "",
    destinationType: text(row.destination_type),
    offlineCategory: text(row.offline_category),
    priceCents: Number.isInteger(row.offline_payment_amount_cents)
      ? Number(row.offline_payment_amount_cents)
      : null,
  };
}

export function mapSalaamReviewRecord(row: Record<string, unknown>): SalaamReviewRecord {
  const offlineMapping = mappingEmbed(row.offline_mapping);
  const intendedMapping = mappingEmbed(row.intended_mapping);
  return {
    id: String(row.id),
    status: row.status as SalaamReviewRecord["status"],
    reason: row.reason as SalaamReviewRecord["reason"],
    amountCents: Number(row.amount_cents),
    payerMsisdn: String(row.payer_msisdn),
    originalFaahfaahin: text(row.original_faahfaahin),
    correctedDestination: text(row.corrected_destination),
    bankTicket: text(row.bank_ticket),
    providerReference: text(row.provider_reference),
    receivedAt: String(row.received_at),
    claimedBy: text(row.claimed_by),
    claimedByName: null,
    claimedAt: text(row.claimed_at),
    resolvedBy: text(row.resolved_by),
    resolvedByName: null,
    resolvedAt: text(row.resolved_at),
    bundleId: offlineMapping?.bundleId ?? "",
    providerName: text(row.provider_name),
    bundleName: text(row.bundle_name),
    destinationType: offlineMapping?.destinationType ?? null,
    orderId: text(row.order_id),
    eventId: String(row.merchant_payment_event_id),
    offlineMapping,
    intendedMappingId: text(row.intended_mapping_id),
    intendedProviderName: text(row.intended_provider_name),
    intendedBundleName: text(row.intended_bundle_name),
    intendedPriceCents: Number.isInteger(row.intended_price_cents)
      ? Number(row.intended_price_cents)
      : null,
    priceDifferenceCents: Number.isInteger(row.price_difference_cents)
      ? Number(row.price_difference_cents)
      : null,
    intendedMapping,
    resolutionType: row.resolution_type === "no_fulfillment" ? "no_fulfillment" : null,
    resolutionNote: text(row.resolution_note),
  };
}
