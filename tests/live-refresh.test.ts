import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { unavailableProductionStatus } from "../features/operations/present-status.ts";
import { mergeSafeguardRefresh } from "../features/operations/money-refresh.ts";
import {
  MERCHANT_LIVE_INTERVALS,
  applyBackgroundRefresh,
  attachLiveRefresh,
  planLiveRefresh,
  replaceRowsById,
  resolveSharedFetch,
  shouldFetchProductionMoney,
} from "../lib/hooks/live-refresh.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(path: string) {
  return readFileSync(join(root, path), "utf8");
}

test("operational data revalidates on its interval and money waits longer", () => {
  assert.equal(MERCHANT_LIVE_INTERVALS.ordersMs, 5_000);
  assert.equal(MERCHANT_LIVE_INTERVALS.paymentsMs, 5_000);
  assert.equal(MERCHANT_LIVE_INTERVALS.reconciliationMs, 5_000);
  assert.equal(MERCHANT_LIVE_INTERVALS.alertsMs, 10_000);
  assert.equal(MERCHANT_LIVE_INTERVALS.moneyMs, 20_000);
  assert.equal(
    planLiveRefresh({
      reason: "interval",
      hidden: false,
      inFlight: false,
      now: 10_000,
      lastStartedAt: 5_000,
      intervalMs: MERCHANT_LIVE_INTERVALS.ordersMs,
    }),
    true,
  );
  assert.equal(
    planLiveRefresh({
      reason: "interval",
      hidden: false,
      inFlight: false,
      now: 9_000,
      lastStartedAt: 5_000,
      intervalMs: MERCHANT_LIVE_INTERVALS.ordersMs,
    }),
    false,
  );
  assert.equal(
    shouldFetchProductionMoney({
      now: 19_000,
      cachedAt: 0,
      ttlMs: MERCHANT_LIVE_INTERVALS.moneyMs,
      force: false,
    }),
    false,
  );
  assert.equal(
    shouldFetchProductionMoney({
      now: 20_000,
      cachedAt: 0,
      ttlMs: MERCHANT_LIVE_INTERVALS.moneyMs,
      force: false,
    }),
    true,
  );

  const page = read("features/merchant-gateway/components/merchant-gateway-page.tsx");
  assert.match(page, /pollIntervalMs:\s*MERCHANT_LIVE_INTERVALS\.ordersMs/);
  assert.match(page, /pollIntervalMs:\s*MERCHANT_LIVE_INTERVALS\.paymentsMs/);
  assert.match(page, /pollIntervalMs:\s*MERCHANT_LIVE_INTERVALS\.reconciliationMs/);
  assert.match(page, /pollIntervalMs:\s*MERCHANT_LIVE_INTERVALS\.alertsMs/);
  assert.equal(page.includes("moneyMs"), false);
  const safeguards = read("features/operations/server/safeguards.ts");
  assert.match(safeguards, /shouldFetchProductionMoney/);
  assert.match(safeguards, /PRODUCTION_MONEY_TTL_MS/);
});

test("background refresh keeps the last payload", () => {
  const kept = applyBackgroundRefresh({
    previous: { id: "order-1", fulfillment: "PROCESSING" },
    next: null,
    ok: false,
  });
  assert.equal(kept.preserved, true);
  assert.equal(kept.data?.fulfillment, "PROCESSING");
  const hook = read("lib/hooks/useApiData.ts");
  assert.match(hook, /status === "success"/);
  assert.match(hook, /refreshing: true/);
});

test("focus, visibility, and reconnect refresh immediately", () => {
  const started = 1_000;
  assert.equal(
    planLiveRefresh({
      reason: "focus",
      hidden: false,
      inFlight: false,
      now: started + 1_500,
      lastStartedAt: started,
      intervalMs: 5_000,
    }),
    true,
  );
  assert.equal(
    planLiveRefresh({
      reason: "online",
      hidden: false,
      inFlight: false,
      now: started + 1_500,
      lastStartedAt: started,
      intervalMs: 5_000,
    }),
    true,
  );
  assert.equal(
    planLiveRefresh({
      reason: "visible",
      hidden: false,
      inFlight: false,
      now: started + 1_500,
      lastStartedAt: started,
      intervalMs: 5_000,
    }),
    true,
  );
  assert.equal(
    planLiveRefresh({
      reason: "interval",
      hidden: true,
      inFlight: false,
      now: started + 20_000,
      lastStartedAt: started,
      intervalMs: 5_000,
    }),
    false,
  );
});

test("timers and listeners are removed on cleanup", () => {
  let now = 10_000;
  let hidden = false;
  const reasons: string[] = [];
  const intervals: Array<() => void> = [];
  const listeners: Record<string, () => void> = {};
  let cleared = 0;
  let removed = 0;
  const cleanup = attachLiveRefresh(
    {
      hidden: () => hidden,
      now: () => now,
      setInterval: (fn) => {
        intervals.push(fn);
        return intervals.length;
      },
      clearInterval: () => {
        cleared += 1;
      },
      addEventListener: (target, type, fn) => {
        listeners[`${target}:${type}`] = fn;
      },
      removeEventListener: () => {
        removed += 1;
      },
    },
    5_000,
    (reason) => {
      reasons.push(reason);
    },
  );
  assert.equal(intervals.length, 1);

  now = 16_000;
  intervals[0]?.();
  assert.deepEqual(reasons, ["interval"]);

  hidden = true;
  now = 30_000;
  intervals[0]?.();
  assert.deepEqual(reasons, ["interval"]);

  hidden = false;
  now = 31_500;
  listeners["window:focus"]?.();
  now = 33_000;
  listeners["window:online"]?.();
  listeners["document:visibilitychange"]?.();
  assert.deepEqual(reasons, ["interval", "focus", "online"]);

  cleanup();
  assert.equal(cleared, 1);
  assert.equal(removed, 3);
  assert.equal(intervals.length, 1);
});

test("overlapping refreshes join the request already in flight", () => {
  assert.equal(
    planLiveRefresh({
      reason: "interval",
      hidden: false,
      inFlight: true,
      now: 20_000,
      lastStartedAt: 0,
      intervalMs: 5_000,
    }),
    false,
  );
  assert.equal(resolveSharedFetch({ bypassCache: true, inFlight: true, fresh: false }), "join");
  assert.equal(resolveSharedFetch({ bypassCache: true, inFlight: false, fresh: true }), "start");
  const hook = read("lib/hooks/useApiData.ts");
  assert.match(hook, /inFlightRef/);
  assert.match(hook, /resolveSharedFetch/);
});

test("an admin action forces a production-money refresh and manual refresh remains", () => {
  assert.equal(
    planLiveRefresh({
      reason: "action",
      hidden: true,
      inFlight: false,
      now: 2_000,
      lastStartedAt: 1_500,
      intervalMs: 5_000,
    }),
    true,
  );
  const page = read("features/merchant-gateway/components/merchant-gateway-page.tsx");
  assert.match(page, /function refreshOperations\(\)/);
  assert.match(page, /freshMoney: "1"/);
  assert.match(page, /onRefresh=\{refreshOperations\}/);
  assert.match(page, />\s*Refresh\s*</);
  const route = read("app/api/merchant-gateway/summary/route.ts");
  assert.match(route, /freshMoney/);
});

test("a failed balance refresh keeps the known amount", () => {
  const previous = {
    ...unavailableProductionStatus("2026-10-03T20:00:00.000Z"),
    toptayoBalanceCents: { state: "known" as const, value: 18_450 },
    balanceAsOf: "2026-10-03T20:00:00.000Z",
  };
  const failed = unavailableProductionStatus("2026-10-03T20:00:20.000Z");
  const merged = mergeSafeguardRefresh(previous, failed, false);
  assert.equal(merged.stale, true);
  assert.deepEqual(merged.toptayoBalanceCents, { state: "known", value: 18_450 });
  assert.notEqual(
    merged.toptayoBalanceCents.state === "known" ? merged.toptayoBalanceCents.value : null,
    0,
  );
  const panel = read("features/operations/components/safeguards-panel.tsx");
  assert.match(panel, /Last updated:/);
  assert.match(panel, /Showing previous snapshot/);
});

test("a new order state replaces the existing row", () => {
  const rows = [
    { id: "a", fulfillment: "PROCESSING" },
    { id: "b", fulfillment: "NOT_STARTED" },
  ];
  const next = replaceRowsById(rows, { id: "a", fulfillment: "COMPLETED" });
  assert.equal(next.length, 2);
  assert.equal(next[0]?.fulfillment, "COMPLETED");
  assert.equal(next.filter((row) => row.id === "a").length, 1);
  const panel = read("features/merchant-gateway/components/paid-orders-panel.tsx");
  assert.match(panel, /key=\{order\.id\}/);
});

test("privileged credentials stay off the client refresh path", () => {
  const files = [
    "lib/hooks/live-refresh.ts",
    "lib/hooks/useApiData.ts",
    "features/merchant-gateway/components/merchant-gateway-page.tsx",
    "features/merchant-gateway/components/live-status.tsx",
    "features/operations/components/safeguards-panel.tsx",
  ];
  for (const file of files) {
    const source = read(file);
    assert.equal(source.includes("SUPABASE_SERVICE_ROLE_KEY"), false, file);
    assert.equal(source.includes("TOPTAYO_API_KEY"), false, file);
    assert.equal(source.includes("createClient"), false, file);
  }
  const live = read("features/merchant-gateway/components/live-status.tsx");
  assert.match(live, /Live updates temporarily unavailable/);
  assert.match(live, /Updated /);
});
