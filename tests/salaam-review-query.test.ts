import assert from "node:assert/strict";
import test from "node:test";
import { withSalaamAdminNames } from "../features/admin-users/identity.ts";
import {
  mapSalaamReviewRecord,
  SALAAM_INTENDED_MAPPING_FK,
  SALAAM_OFFLINE_MAPPING_FK,
  SALAAM_REVIEW_LIST_SELECT,
} from "../features/merchant-gateway/salaam-review-query.ts";

const ADMIN_ID = "3e1c8c5a-1111-4111-8111-111111111111";

function reviewRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "review-1",
    status: "needs_review",
    reason: "invalid_destination",
    amount_cents: 45,
    payer_msisdn: "252611111111",
    original_faahfaahin: "123",
    corrected_destination: null,
    bank_ticket: "12345",
    provider_reference: "REF-1",
    received_at: "2026-10-07T00:00:00.000Z",
    claimed_by: ADMIN_ID,
    claimed_at: "2026-10-07T01:00:00.000Z",
    resolved_by: null,
    resolved_at: null,
    provider_name: "Hormuud",
    bundle_name: "40 Minutes",
    order_id: null,
    merchant_payment_event_id: "event-1",
    intended_mapping_id: null,
    intended_provider_name: null,
    intended_bundle_name: null,
    intended_price_cents: null,
    price_difference_cents: null,
    resolution_type: null,
    resolution_note: null,
    offline_mapping: {
      top_tayo_bundle_id: "TR6kSa-Ns2Kqohbt34ypw",
      destination_type: "mobile_msisdn",
      offline_category: "ku_hadal",
    },
    intended_mapping: null,
    ...overrides,
  };
}

test("an invalid Faahfaahin review reads its original offline mapping", () => {
  const mapped = mapSalaamReviewRecord(reviewRow());
  assert.equal(mapped.reason, "invalid_destination");
  assert.equal(mapped.bundleId, "TR6kSa-Ns2Kqohbt34ypw");
  assert.equal(mapped.destinationType, "mobile_msisdn");
  assert.equal(mapped.offlineMapping?.offlineCategory, "ku_hadal");
  assert.equal(mapped.intendedMapping, null);
});

test("an unmatched-amount review allows a null offline mapping", () => {
  const mapped = mapSalaamReviewRecord(
    reviewRow({
      reason: "unmatched_amount",
      amount_cents: 44,
      provider_name: null,
      bundle_name: null,
      offline_mapping: null,
    }),
  );
  assert.equal(mapped.reason, "unmatched_amount");
  assert.equal(mapped.offlineMapping, null);
  assert.equal(mapped.bundleId, "");
  assert.equal(mapped.destinationType, null);
  assert.equal(mapped.intendedMapping, null);
});

test("an intended mapping is present only after staff record the bundle", () => {
  const mapped = mapSalaamReviewRecord(
    reviewRow({
      reason: "unmatched_amount",
      amount_cents: 44,
      provider_name: null,
      bundle_name: null,
      offline_mapping: null,
      intended_mapping_id: "map-hormuud-40",
      intended_provider_name: "Hormuud",
      intended_bundle_name: "40 Minutes",
      intended_price_cents: 45,
      price_difference_cents: -1,
      intended_mapping: {
        id: "map-hormuud-40",
        top_tayo_bundle_id: "TR6kSa-Ns2Kqohbt34ypw",
        offline_payment_amount_cents: 45,
        destination_type: "mobile_msisdn",
        offline_category: "ku_hadal",
      },
    }),
  );
  assert.equal(mapped.offlineMapping, null);
  assert.equal(mapped.intendedMapping?.id, "map-hormuud-40");
  assert.equal(mapped.intendedMapping?.bundleId, "TR6kSa-Ns2Kqohbt34ypw");
  assert.equal(mapped.intendedMapping?.priceCents, 45);
  assert.equal(mapped.intendedProviderName, "Hormuud");
  assert.equal(mapped.priceDifferenceCents, -1);
});

test("both mapping relationships are named so the query is not ambiguous", () => {
  assert.match(SALAAM_REVIEW_LIST_SELECT, new RegExp(`offline_mapping:offline_bundle_payment_mappings!${SALAAM_OFFLINE_MAPPING_FK}`));
  assert.match(SALAAM_REVIEW_LIST_SELECT, new RegExp(`intended_mapping:offline_bundle_payment_mappings!${SALAAM_INTENDED_MAPPING_FK}`));
  assert.doesNotMatch(
    SALAAM_REVIEW_LIST_SELECT,
    /(^|,)offline_bundle_payment_mappings\(/,
  );
});

test("claimed-by display name resolution still keeps the stored admin id", () => {
  const mapped = mapSalaamReviewRecord(reviewRow());
  const named = withSalaamAdminNames(mapped, new Map([
    [ADMIN_ID, { id: ADMIN_ID, fullName: "Mahdi", email: "mahdi@example.com" }],
  ]));
  assert.equal(named.claimedBy, ADMIN_ID);
  assert.equal(named.claimedByName, "Mahdi");
  assert.equal(named.bundleId, "TR6kSa-Ns2Kqohbt34ypw");
});
