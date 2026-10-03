/**
 * Polling policy for the merchant operations console.
 * Requests stay on authenticated /api routes. This module does not open a
 * Supabase channel and does not hold a service-role or TopTayo key.
 */

export const MERCHANT_LIVE_INTERVALS = {
  ordersMs: 5_000,
  paymentsMs: 5_000,
  reconciliationMs: 5_000,
  gatewayMs: 10_000,
  alertsMs: 10_000,
  moneyMs: 20_000,
} as const;

export const PRODUCTION_MONEY_TTL_MS = MERCHANT_LIVE_INTERVALS.moneyMs;

/** Collapse focus + visibility + online that arrive together. */
const IMMEDIATE_COALESCE_MS = 1_000;

export type LiveRefreshReason =
  | "interval"
  | "focus"
  | "visible"
  | "online"
  | "manual"
  | "action";

export function planLiveRefresh(input: {
  reason: LiveRefreshReason;
  hidden: boolean;
  inFlight: boolean;
  now: number;
  lastStartedAt: number | null;
  intervalMs: number;
}) {
  if (input.inFlight) return false;
  if (input.hidden && input.reason !== "manual" && input.reason !== "action") return false;

  const immediate = input.reason !== "interval";
  if (immediate) {
    if (
      input.reason !== "manual" &&
      input.reason !== "action" &&
      input.lastStartedAt != null &&
      input.now - input.lastStartedAt < IMMEDIATE_COALESCE_MS
    ) {
      return false;
    }
    return true;
  }

  if (input.lastStartedAt == null) return true;
  return input.now - input.lastStartedAt >= input.intervalMs;
}

export function shouldFetchProductionMoney(input: {
  now: number;
  cachedAt: number | null;
  ttlMs: number;
  force: boolean;
}) {
  if (input.force) return true;
  if (input.cachedAt == null) return true;
  return input.now - input.cachedAt >= input.ttlMs;
}

export function resolveSharedFetch(input: {
  bypassCache: boolean;
  inFlight: boolean;
  fresh: boolean;
}) {
  if (input.inFlight) return "join" as const;
  if (!input.bypassCache && input.fresh) return "reuse" as const;
  return "start" as const;
}

export function withSearch(url: string, search: Record<string, string> | null | undefined) {
  if (!search || Object.keys(search).length === 0) return url;
  const [path, query = ""] = url.split("?");
  const params = new URLSearchParams(query);
  for (const [key, value] of Object.entries(search)) params.set(key, value);
  const next = params.toString();
  return next ? `${path}?${next}` : path;
}

/**
 * A background refresh keeps the last successful payload on failure.
 * It never invents a zero balance.
 */
export function applyBackgroundRefresh<T>(input: {
  previous: T | null;
  next: T | null;
  ok: boolean;
}): { data: T | null; preserved: boolean } {
  if (input.ok) return { data: input.next, preserved: false };
  if (input.previous != null) return { data: input.previous, preserved: true };
  return { data: null, preserved: false };
}

export function replaceRowsById<T extends { id: string }>(rows: readonly T[], next: T) {
  const index = rows.findIndex((row) => row.id === next.id);
  if (index === -1) return [...rows, next];
  const copy = rows.slice();
  copy[index] = next;
  return copy;
}

export function formatAgeShort(updatedAt: number | string | null, now: number) {
  if (updatedAt == null) return "not yet";
  const then = typeof updatedAt === "number" ? updatedAt : Date.parse(updatedAt);
  if (!Number.isFinite(then)) return "not yet";
  const seconds = Math.max(0, Math.floor((now - then) / 1000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  return minutes === 1 ? "1 min ago" : `${minutes} min ago`;
}

type LiveEnvironment = {
  hidden: () => boolean;
  now: () => number;
  setInterval: (fn: () => void, ms: number) => unknown;
  clearInterval: (id: unknown) => void;
  addEventListener: (target: "window" | "document", type: string, fn: () => void) => void;
  removeEventListener: (target: "window" | "document", type: string, fn: () => void) => void;
};

/**
 * One interval and one set of window listeners. The returned function removes both.
 */
export function attachLiveRefresh(
  env: LiveEnvironment,
  intervalMs: number,
  onRefresh: (reason: LiveRefreshReason) => void,
) {
  let lastStartedAt: number | null = env.now();
  let inFlight = false;

  const request = (reason: LiveRefreshReason) => {
    const now = env.now();
    if (
      !planLiveRefresh({
        reason,
        hidden: env.hidden(),
        inFlight,
        now,
        lastStartedAt,
        intervalMs,
      })
    ) {
      return;
    }
    inFlight = true;
    lastStartedAt = now;
    try {
      onRefresh(reason);
    } finally {
      inFlight = false;
    }
  };

  const onFocus = () => request("focus");
  const onVisible = () => {
    if (!env.hidden()) request("visible");
  };
  const onOnline = () => request("online");
  const onInterval = () => request("interval");

  const timer = env.setInterval(onInterval, intervalMs);
  env.addEventListener("window", "focus", onFocus);
  env.addEventListener("document", "visibilitychange", onVisible);
  env.addEventListener("window", "online", onOnline);

  return () => {
    env.clearInterval(timer);
    env.removeEventListener("window", "focus", onFocus);
    env.removeEventListener("document", "visibilitychange", onVisible);
    env.removeEventListener("window", "online", onOnline);
  };
}
