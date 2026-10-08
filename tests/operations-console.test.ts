import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  RESUME_CANONICAL_FULFILLMENT_SUPPORTED,
  alertMatchesFilter,
  displayOptionalCount,
  fulfillmentOperatorAction,
  isCanonicalResumeCase,
  isPaidAwaitingFulfillment,
  maskPhone,
  operatorMayPurchase,
  simDisplay,
  summarizeDeviceCounts,
} from "../features/merchant-gateway/operations.ts";
import { formatExposure, presentProductionStatus } from "../features/operations/present-status.ts";
import {
  isLabGateway,
  operationalDevices,
  partitionOperationalGateways,
} from "../features/merchant-gateway/presentation.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("production gateway list drops the simulator card", () => {
  const devices = [
    { id: "sim", name: "Simulator gateway", appVersion: "simulator-1", status: "OFFLINE" },
    { id: "a32", name: "Galaxy A32", appVersion: "1.0.4", status: "ONLINE" },
  ];
  assert.equal(isLabGateway(devices[0]), true);
  assert.equal(isLabGateway(devices[1]), false);
  assert.deepEqual(
    operationalDevices(devices).map((device) => device.name),
    ["Galaxy A32"],
  );
  const counts = summarizeDeviceCounts([
    { status: "OFFLINE", lab: true },
    { status: "ONLINE", lab: false },
  ]);
  assert.equal(counts.offline, 0);
  assert.equal(counts.online, 1);
  assert.equal(counts.excludedLabGateways, 1);
  const page = readFileSync(
    join(root, "features/merchant-gateway/components/merchant-gateway-page.tsx"),
    "utf8",
  );
  assert.equal(page.includes("Lab / simulator"), false);
  assert.equal(page.includes("Simulator gateway"), false);
  assert.equal(page.includes("Revoke gateway"), true);
  assert.equal(page.includes("Revoked and historical gateways"), true);
  assert.match(page, /<details /);
  assert.equal(page.includes("<details open"), false);
  assert.equal(page.includes("Testing history"), true);
  assert.equal(page.includes("useEffect"), false);
});

test("operational counts are derived from supplied records", () => {
  const empty = summarizeDeviceCounts([]);
  assert.equal(empty.online, 0);
  assert.equal(empty.offline, 0);
  assert.equal(isPaidAwaitingFulfillment("PENDING", "NOT_STARTED"), false);
  assert.equal(isPaidAwaitingFulfillment("PAYMENT_CONFIRMED", "PROCESSING"), true);
  assert.equal(isPaidAwaitingFulfillment("PAYMENT_CONFIRMED", "COMPLETED"), false);
});

test("an eDahab-only gateway does not show EVC Plus as missing", () => {
  const evc = simDisplay("evc_plus", ["edahab"], false);
  const edahab = simDisplay("edahab", ["edahab"], true);
  assert.equal(evc.value, "Not configured");
  assert.equal(evc.tone, "neutral");
  assert.notEqual(evc.value, "Missing");
  assert.notEqual(evc.value, "Connected");
  assert.equal(edahab.value, "Authorized and verified");
  assert.equal(edahab.tone, "success");
  const presentOnly = simDisplay("evc_plus", ["edahab"], true);
  assert.equal(presentOnly.value, "SIM present, not authorized");
  assert.notEqual(presentOnly.value, "Connected");
  const missingAuthorized = simDisplay("edahab", ["edahab"], false);
  assert.equal(missingAuthorized.value, "Authorized, not verified");
});

test("the hardcoded $25 balance warning is gone and the live balance remains", () => {
  const page = readFileSync(
    join(root, "features/reseller/components/reseller-page.tsx"),
    "utf8",
  );
  assert.equal(page.includes("LOW_BALANCE_THRESHOLD"), false);
  assert.equal(page.includes("below the $"), false);
  assert.equal(page.includes("TopTayo balance"), true);
  assert.equal(page.includes("business.balance"), true);
});

test("paid orders and manual fulfillment follow backend reservation state", () => {
  const safe = fulfillmentOperatorAction({
    paymentStatus: "PAYMENT_CONFIRMED",
    fulfillmentStatus: "PROCESSING",
    failureCode: "production_disabled",
    topTayoTransactionIds: [],
    reservation: { known: true, outcome: "reserved" },
  });
  assert.equal(safe, "fulfill_manually");

  assert.equal(
    fulfillmentOperatorAction({
      paymentStatus: "PAYMENT_CONFIRMED",
      fulfillmentStatus: "PROCESSING",
      failureCode: null,
      topTayoTransactionIds: [],
      reservation: { known: true, outcome: "sending" },
    }),
    "reconcile",
  );
  assert.equal(
    fulfillmentOperatorAction({
      paymentStatus: "PAYMENT_CONFIRMED",
      fulfillmentStatus: "PROCESSING",
      failureCode: "recharge_uncertain",
      topTayoTransactionIds: [],
      reservation: { known: true, outcome: "reserved" },
    }),
    "reconcile",
  );
  assert.equal(
    fulfillmentOperatorAction({
      paymentStatus: "PAYMENT_CONFIRMED",
      fulfillmentStatus: "PROCESSING",
      failureCode: null,
      topTayoTransactionIds: ["tt-1"],
      reservation: { known: true, outcome: "reserved" },
    }),
    "check_toptayo",
  );
  assert.equal(
    fulfillmentOperatorAction({
      paymentStatus: "PAYMENT_CONFIRMED",
      fulfillmentStatus: "PROCESSING",
      failureCode: null,
      topTayoTransactionIds: [],
      reservation: { known: true, outcome: "manual_claimed" },
    }),
    "continue_manual",
  );
  assert.equal(
    fulfillmentOperatorAction({
      paymentStatus: "PAYMENT_CONFIRMED",
      fulfillmentStatus: "PROCESSING",
      failureCode: null,
      topTayoTransactionIds: [],
      reservation: { known: true, outcome: "manual_sending" },
    }),
    "reconcile",
  );
  assert.equal(
    fulfillmentOperatorAction({
      paymentStatus: "PAYMENT_CONFIRMED",
      fulfillmentStatus: "PROCESSING",
      failureCode: null,
      topTayoTransactionIds: [],
      pendingRecordTransactionId: "tt-kept",
      reservation: { known: true, outcome: "manual_sending" },
    }),
    "retry_recording",
  );
  assert.equal(
    fulfillmentOperatorAction({
      paymentStatus: "PAYMENT_CONFIRMED",
      fulfillmentStatus: "COMPLETED",
      failureCode: null,
      topTayoTransactionIds: ["tt-1"],
      reservation: { known: true, outcome: "completed" },
    }),
    "none",
  );
  for (const outcome of ["manual_sending", "sending", "processing", "uncertain"]) {
    const action = fulfillmentOperatorAction({
      paymentStatus: "PAYMENT_CONFIRMED",
      fulfillmentStatus: "PROCESSING",
      failureCode: outcome === "uncertain" ? "recharge_uncertain" : null,
      topTayoTransactionIds: [],
      reservation: { known: true, outcome },
    });
    assert.equal(operatorMayPurchase(action), false);
  }
  assert.equal(operatorMayPurchase("fulfill_manually"), true);
  assert.equal(operatorMayPurchase("check_toptayo"), false);
  assert.equal(operatorMayPurchase("retry_recording"), false);
  assert.equal(
    fulfillmentOperatorAction({
      paymentStatus: "PAYMENT_CONFIRMED",
      fulfillmentStatus: "PROCESSING",
      failureCode: null,
      topTayoTransactionIds: [],
      reservation: { known: false },
    }),
    "refresh_only",
  );
  assert.equal(
    alertMatchesFilter(
      { category: "fulfillment", lifecycle: "active" },
      "fulfillment",
    ),
    true,
  );
});

test("missing gateway measurements stay unavailable instead of zero or offline", () => {
  assert.equal(displayOptionalCount(null), "Not reported");
  assert.equal(displayOptionalCount(undefined), "Not reported");
  assert.notEqual(displayOptionalCount(null), "0");
  assert.equal(displayOptionalCount(0), "0");
  assert.equal(maskPhone("252621854843"), "••••••4843");
  const safeguards = readFileSync(
    join(root, "features/operations/server/safeguards.ts"),
    "utf8",
  );
  const presented = readFileSync(join(root, "features/operations/present-status.ts"), "utf8");
  assert.match(presented, /Balance unavailable/);
  assert.match(presented, /Today's exposure unavailable/);
  assert.match(safeguards, /bundles-admin-production-status|productionStatus/);
  assert.doesNotMatch(safeguards, /value:\s*0/);
  assert.doesNotMatch(presented, /value:\s*0/);

  const known = presentProductionStatus({
    productionEnabled: true,
    dailyRechargeLimitCents: 300,
    todayExposureCents: 100,
    remainingDailyCapacityCents: 200,
    reserveFloorCents: 200,
    canaryEnabled: true,
    topTayoBalanceCents: 969,
    balanceKnown: true,
    balanceAsOf: "2026-09-30T12:00:00.000Z",
    topTayoEnvironment: "production",
  });
  assert.equal(known.automatedSales.state === "known" && known.automatedSales.value, "enabled");
  assert.equal(known.toptayoBalanceCents.state === "known" && known.toptayoBalanceCents.value, 969);
  assert.equal(known.reserveFloorCents.state === "known" && known.reserveFloorCents.value, 200);
  assert.equal(formatExposure(known), "$1.00 / $3.00");
  assert.equal(known.remainingCapacityCents.state === "known" && known.remainingCapacityCents.value, 200);
  assert.equal(known.canary.state === "known" && known.canary.value, "enabled");
  assert.equal(known.environment.state === "known" && known.environment.value, "production");

  const unknownBalance = presentProductionStatus({
    balanceKnown: false,
    topTayoBalanceCents: 0,
    dailyRechargeLimitCents: null,
    reserveFloorCents: null,
    todayExposureCents: null,
    remainingDailyCapacityCents: null,
    canaryEnabled: false,
    productionEnabled: false,
  });
  assert.equal(unknownBalance.toptayoBalanceCents.state, "unavailable");
  if (unknownBalance.toptayoBalanceCents.state === "unavailable") {
    assert.equal(unknownBalance.toptayoBalanceCents.label, "Balance unavailable");
  }
  assert.equal(unknownBalance.dailyLimitCents.state, "unavailable");
  if (unknownBalance.dailyLimitCents.state === "unavailable") {
    assert.equal(unknownBalance.dailyLimitCents.label, "Not configured");
  }
});

test("manual recovery is separate from catalog purchase, and secrets stay server-only", () => {
  const manual = readFileSync(
    join(root, "features/merchant-gateway/server/manual-fulfillment.ts"),
    "utf8",
  );
  const panel = readFileSync(
    join(root, "features/merchant-gateway/components/paid-orders-panel.tsx"),
    "utf8",
  );
  const catalog = readFileSync(join(root, "features/reseller/server/recharge.ts"), "utf8");
  const catalogPage = readFileSync(
    join(root, "features/reseller/components/reseller-page.tsx"),
    "utf8",
  );
  const qoondeeye = readFileSync(join(root, "features/qoondeeye/admin-functions.ts"), "utf8");
  const revoke = readFileSync(join(root, "app/api/merchant-gateway/revoke/route.ts"), "utf8");

  assert.equal(manual.includes("toptayoPost"), false);
  assert.equal(manual.includes("/api/v1/recharge"), false);
  assert.equal(manual.includes("createRecharge"), true);
  assert.equal(manual.includes("destination"), false);
  assert.match(manual, /beginSend/);
  assert.match(manual, /retryRecording/);
  assert.equal(panel.includes("createRecharge"), false);
  assert.equal(panel.includes("/api/v1/recharge"), false);
  assert.match(panel, /\/api\/merchant-gateway\/manual-fulfillment/);
  assert.equal(panel.includes("/api/resellers/recharge"), false);
  assert.match(panel, /Fulfill manually/);
  assert.match(panel, /Continue manual fulfillment/);
  assert.match(panel, /Retry recording transaction/);
  assert.equal(panel.includes("Purchase again"), false);
  assert.equal(panel.includes("Fulfill again"), false);
  assert.equal(panel.includes("Retry recharge"), false);
  assert.match(catalog, /createRecharge/);
  assert.match(catalogPage, /\/api\/resellers\/recharge/);
  assert.match(qoondeeye, /bundles-admin-gateway-revoke/);
  assert.match(qoondeeye, /delete payload\.adminUserId/);
  assert.match(revoke, /revokeGateway/);
  assert.equal(revoke.includes(".delete("), false);

  const client = readFileSync(join(root, "lib/toptayo/client.ts"), "utf8");
  assert.match(client, /import "server-only"/);
  assert.doesNotMatch(client, /NEXT_PUBLIC/);

  const offenders: string[] = [];
  for (const file of sourceFiles(root)) {
    if (file.includes(`${join("tests")}`)) continue;
    const source = readFileSync(file, "utf8");
    if (!source.includes("TOPTAYO_API_KEY") && !source.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      continue;
    }
    const clientFile = source.includes('"use client"') || source.includes("'use client'");
    const serverOnly = source.includes('import "server-only"') || source.includes("import 'server-only'");
    if (clientFile || !serverOnly) offenders.push(file);
  }
  assert.deepEqual(offenders, []);
});

test("revoked and stale gateways do not change the active health summary", () => {
  const devices = [
    { id: "live", name: "A32 preview gateway", appVersion: "1.0.2", status: "ONLINE" },
    { id: "old", name: "Galaxy A32", appVersion: "1.0.2", status: "OFFLINE" },
    { id: "debug", name: "Galaxy A32 debug", appVersion: "1.0.2", status: "OFFLINE" },
    { id: "revoked", name: "edahab-a32", appVersion: "1.0.2", status: "REVOKED" },
    { id: "sim", name: "Simulator gateway", appVersion: "simulator-1", status: "OFFLINE" },
  ];
  const roster = partitionOperationalGateways(devices);
  assert.deepEqual(
    roster.active.map((device) => device.id),
    ["live"],
  );
  assert.deepEqual(
    roster.historical.map((device) => device.id).sort(),
    ["debug", "old", "revoked", "sim"],
  );
  const counts = summarizeDeviceCounts(
    roster.active.map((device) => ({ status: device.status, lab: false })),
  );
  assert.equal(counts.online, 1);
  assert.equal(counts.offline, 0);
  assert.equal(counts.revoked, 0);
  const outage = partitionOperationalGateways([
    { id: "only", name: "A32 preview gateway", appVersion: "1.0.2", status: "OFFLINE", lastHeartbeatAt: "2026-10-03T19:00:00.000Z" },
    { id: "older", name: "Galaxy A32", appVersion: "1.0.2", status: "OFFLINE", lastHeartbeatAt: "2026-10-01T17:00:00.000Z" },
  ]);
  assert.deepEqual(outage.active.map((device) => device.id), ["only"]);
  assert.deepEqual(outage.historical.map((device) => device.id), ["older"]);
});

test("closed paid orders do not count as awaiting fulfillment", () => {
  for (const fulfillment of ["COMPLETED", "CANCELLED", "REFUNDED", "RESOLVED"]) {
    assert.equal(isPaidAwaitingFulfillment("PAYMENT_CONFIRMED", fulfillment), false);
  }
  assert.equal(isPaidAwaitingFulfillment("PAYMENT_CONFIRMED", "PROCESSING"), true);
  assert.equal(isPaidAwaitingFulfillment("PAYMENT_CONFIRMED", "NOT_STARTED"), true);
  assert.equal(isPaidAwaitingFulfillment("PAYMENT_CONFIRMED", "FAILED"), true);
});

test("resume fulfillment is offered only when the backend supports the canonical path", () => {
  const resumeCase = {
    paymentStatus: "PAYMENT_CONFIRMED",
    fulfillmentStatus: "NOT_STARTED",
    failureCode: null,
    topTayoTransactionIds: [],
    reservation: { known: true as const, outcome: null },
  };
  assert.equal(isCanonicalResumeCase(resumeCase), true);
  assert.equal(RESUME_CANONICAL_FULFILLMENT_SUPPORTED, false);
  assert.equal(fulfillmentOperatorAction(resumeCase), "refresh_only");
  assert.equal(
    fulfillmentOperatorAction(resumeCase, { resumeSupported: true }),
    "resume_fulfillment",
  );
  assert.equal(operatorMayPurchase("resume_fulfillment"), false);
  assert.equal(
    fulfillmentOperatorAction({
      ...resumeCase,
      reservation: { known: true, outcome: "reserved" },
    }),
    "fulfill_manually",
  );
  assert.equal(
    fulfillmentOperatorAction({
      paymentStatus: "PAYMENT_CONFIRMED",
      fulfillmentStatus: "PROCESSING",
      failureCode: null,
      topTayoTransactionIds: ["tt-live"],
      reservation: { known: true, outcome: "processing" },
    }),
    "check_toptayo",
  );
  const panel = readFileSync(
    join(root, "features/merchant-gateway/components/paid-orders-panel.tsx"),
    "utf8",
  );
  assert.equal(panel.includes("min-w-[1280px]"), false);
  assert.match(panel, /sticky right-0/);
  assert.match(panel, /Backend required: resume canonical fulfillment/);
  assert.equal(panel.includes("Purchase again"), false);
  assert.equal(panel.includes("Retry recharge"), false);
});

function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === ".git") continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      found.push(...sourceFiles(path));
      continue;
    }
    if (/\.(ts|tsx)$/.test(name)) found.push(path);
  }
  return found;
}
