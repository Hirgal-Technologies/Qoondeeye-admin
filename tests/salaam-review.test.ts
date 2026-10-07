import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import {
  formatSalaamDifference,
  salaamBundleDifferenceLines,
  salaamCanResolveWithoutFulfillment,
  salaamPriceDifferenceCents,
  salaamReviewReasonText,
  salaamShowsFulfillmentActions,
  salaamShowsResolveWithoutFulfillment,
  salaamUnmatchedReviewLines,
} from "../features/merchant-gateway/salaam-review-view.ts";
import { salaamReviewActorLines } from "../features/admin-users/identity.ts";

test("an unmatched Salaam payment appears as a paid review case", () => {
  const lines = salaamUnmatchedReviewLines({
    amountCents: 44,
    payerMsisdn: "252611111111",
    originalFaahfaahin: "612673277",
    bankTicket: "12345",
    providerReference: "REF-44",
    receivedAt: "2026-10-07T00:00:00.000Z",
    status: "needs_review",
  });
  assert.deepEqual(lines, [
    "PAID - Salaam Bank",
    "Amount paid: $0.44",
    "Payer: 252611111111",
    "Faahfaahin: 612673277",
    "Tix: 12345",
    "Ref: REF-44",
    "Received: 2026-10-07T00:00:00.000Z",
    "Reason: Amount does not match any Offline bundle",
    "Status: needs_review",
    "The user has already paid.",
  ]);
  assert.equal(salaamReviewReasonText("unmatched_amount"), "Amount does not match any Offline bundle");
  assert.equal(salaamReviewReasonText("missing_faahfaahin"), "Faahfaahin is missing");
});

test("intended bundle selection shows the price difference and does not hide it", () => {
  assert.equal(salaamPriceDifferenceCents(44, 45), -1);
  assert.equal(salaamPriceDifferenceCents(46, 45), 1);
  assert.equal(formatSalaamDifference(-1), "-$0.01");
  assert.equal(formatSalaamDifference(1), "+$0.01");
  assert.deepEqual(
    salaamBundleDifferenceLines({
      receivedCents: 44,
      providerName: "Hormuud",
      bundleName: "40 Minutes",
      requiredCents: 45,
    }),
    [
      "Received: $0.44",
      "Selected bundle: Hormuud 40 Minutes",
      "Required price: $0.45",
      "Difference: -$0.01",
    ],
  );
  assert.equal(
    salaamBundleDifferenceLines({
      receivedCents: 46,
      providerName: "Hormuud",
      bundleName: "40 Minutes",
      requiredCents: 45,
    })[3],
    "Difference: +$0.01",
  );
});

test("a claimed invalid Faahfaahin review shows resolve without fulfillment", () => {
  assert.equal(
    salaamShowsResolveWithoutFulfillment({ status: "claimed", reason: "invalid_destination" }),
    true,
  );
});

test("a claimed missing Faahfaahin review shows resolve without fulfillment", () => {
  assert.equal(
    salaamShowsResolveWithoutFulfillment({ status: "claimed", reason: "missing_faahfaahin" }),
    true,
  );
});

test("a claimed unmatched-amount review shows resolve without fulfillment", () => {
  assert.equal(
    salaamShowsResolveWithoutFulfillment({ status: "claimed", reason: "unmatched_amount" }),
    true,
  );
});

test("an unclaimed review cannot resolve without fulfillment", () => {
  for (const reason of ["invalid_destination", "missing_faahfaahin", "unmatched_amount"]) {
    assert.equal(salaamShowsResolveWithoutFulfillment({ status: "needs_review", reason }), false);
    assert.equal(
      salaamCanResolveWithoutFulfillment({
        status: "needs_review",
        reason,
        note: "controlled test",
        confirmed: true,
      }),
      false,
    );
  }
  assert.equal(
    salaamCanResolveWithoutFulfillment({
      status: "claimed",
      reason: "invalid_destination",
      note: "   ",
      confirmed: true,
    }),
    false,
  );
  assert.equal(
    salaamCanResolveWithoutFulfillment({
      status: "claimed",
      reason: "invalid_destination",
      note: "controlled test",
      confirmed: false,
    }),
    false,
  );
  assert.equal(
    salaamCanResolveWithoutFulfillment({
      status: "claimed",
      reason: "invalid_destination",
      note: "controlled test",
      confirmed: true,
    }),
    true,
  );
});

test("a resolved review hides fulfillment actions", () => {
  assert.equal(salaamShowsFulfillmentActions({ status: "resolved" }), false);
  assert.equal(salaamShowsResolveWithoutFulfillment({ status: "resolved", reason: "invalid_destination" }), false);
  assert.equal(salaamShowsFulfillmentActions({ status: "claimed" }), true);
  assert.deepEqual(
    salaamReviewActorLines({
      claimedBy: "admin-1",
      claimedByName: "Admin",
      resolvedBy: "admin-1",
      resolvedByName: "Admin",
      resolvedAt: "2026-10-07T14:27:14.000Z",
    }),
    ["Claimed by: Admin", "Resolved by: Admin", "Resolved at: 2026-10-07T14:27:14.000Z"],
  );
  const page = fs.readFileSync(
    new URL("../features/merchant-gateway/components/salaam-review-page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(page, /salaamShowsResolveWithoutFulfillment\(row\)/);
  assert.match(page, /salaamShowsFulfillmentActions\(row\)/);
  assert.match(page, /resolve_without_fulfillment/);
  assert.match(page, /Resolve without fulfillment/);
  assert.match(page, /Confirm destination & continue/);
  const route = fs.readFileSync(
    new URL("../app/api/merchant-gateway/salaam-reviews/action/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(route, /resolve_without_fulfillment/);
});
