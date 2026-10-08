import assert from "node:assert/strict";
import test from "node:test";
import { filterPendingOrders, orderIsUrgent } from "../features/merchant-gateway/operations.ts";
import {
  cleanupPreviewKey,
  parsePreproductionCleanupRequest,
} from "../features/merchant-gateway/preproduction-cleanup.ts";

const NOW = Date.parse("2026-10-08T18:00:00.000Z");

function order(overrides: Partial<{
  id: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  failureCode: string | null;
  reservationOutcome: string | null;
  topTayoTransactionIds: string[];
  paymentMethod: string | null;
  paidAt: string | null;
  updatedAt: string | null;
}> = {}) {
  return {
    id: "order",
    paymentStatus: "PAYMENT_CONFIRMED",
    fulfillmentStatus: "NOT_STARTED",
    failureCode: null as string | null,
    reservationOutcome: "reserved" as string | null,
    topTayoTransactionIds: [] as string[],
    paymentMethod: "evc_plus" as string | null,
    paidAt: "2026-10-08T10:00:00.000Z" as string | null,
    updatedAt: "2026-10-08T10:00:00.000Z" as string | null,
    ...overrides,
  };
}

test("pending orders filter by status, method, age, and urgency", () => {
  const rows = [
    order({ id: "fresh-evc" }),
    order({
      id: "old-edahab",
      paymentMethod: "edahab",
      paidAt: "2026-10-01T10:00:00.000Z",
      failureCode: "toptayo_balance_low",
    }),
    order({
      id: "uncertain",
      failureCode: "recharge_uncertain",
      paidAt: "2026-10-08T17:00:00.000Z",
    }),
    order({ id: "done", fulfillmentStatus: "COMPLETED" }),
  ];
  assert.deepEqual(
    filterPendingOrders(rows, { bucket: "all", method: "all", minAge: "any", urgentOnly: false }, NOW).map(
      (row) => row.id,
    ),
    ["fresh-evc", "old-edahab", "uncertain"],
  );
  assert.deepEqual(
    filterPendingOrders(rows, { bucket: "all", method: "edahab", minAge: "any", urgentOnly: false }, NOW).map(
      (row) => row.id,
    ),
    ["old-edahab"],
  );
  assert.deepEqual(
    filterPendingOrders(rows, { bucket: "all", method: "all", minAge: "7d", urgentOnly: false }, NOW).map(
      (row) => row.id,
    ),
    ["old-edahab"],
  );
  assert.equal(orderIsUrgent(rows[2], NOW), true);
  assert.equal(orderIsUrgent(rows[0], NOW), false);
  const urgent = filterPendingOrders(
    rows,
    { bucket: "recharge_uncertain", method: "all", minAge: "any", urgentOnly: true },
    NOW,
  );
  assert.deepEqual(
    urgent.map((row) => row.id),
    ["uncertain"],
  );
});

test("cleanup requests require a past cutoff, a device, and a reason", () => {
  const rejected = parsePreproductionCleanupRequest({ apply: true }, NOW);
  assert.equal(rejected.ok, false);
  const accepted = parsePreproductionCleanupRequest(
    {
      cutoffAt: "2026-10-01T00:00:00.000Z",
      protectedDeviceId: "galaxy-a32",
      reason: "Testers confirmed the historical bundles were delivered.",
      apply: false,
    },
    NOW,
  );
  assert.equal(accepted.ok, true);
  if (!accepted.ok) return;
  assert.equal(accepted.value.apply, false);
  assert.equal(accepted.value.protectedDeviceId, "galaxy-a32");
  const changed = cleanupPreviewKey({ ...accepted.value, reason: "different reason text here" });
  assert.notEqual(cleanupPreviewKey(accepted.value), changed);
});
