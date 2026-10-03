/**
 * Fixed-window attempt limiter kept in process memory.
 *
 * Scope matches lib/api/query-cache.ts: per server process. That is enough
 * for the single-container deployment; a shared store (e.g. Redis) can back
 * the same interface if the app is ever scaled horizontally.
 */
export type RateLimiter = {
  /** Returns seconds until the key may retry, or 0 if it is not limited. */
  retryAfter(key: string, now?: number): number;
  /** Counts one attempt against the key. */
  hit(key: string, now?: number): void;
  /** Clears the key (e.g. after a successful sign-in). */
  reset(key: string): void;
};

type Window = { count: number; resetAt: number };

const MAX_TRACKED_KEYS = 10_000;

export function createRateLimiter(options: {
  limit: number;
  windowMs: number;
}): RateLimiter {
  const windows = new Map<string, Window>();

  function prune(now: number) {
    for (const [key, window] of windows) {
      if (window.resetAt <= now) windows.delete(key);
    }
    while (windows.size >= MAX_TRACKED_KEYS) {
      const oldest = windows.keys().next().value;
      if (oldest === undefined) break;
      windows.delete(oldest);
    }
  }

  return {
    retryAfter(key, now = Date.now()) {
      const window = windows.get(key);
      if (!window || window.resetAt <= now) return 0;
      return window.count >= options.limit
        ? Math.ceil((window.resetAt - now) / 1000)
        : 0;
    },
    hit(key, now = Date.now()) {
      const window = windows.get(key);
      if (!window || window.resetAt <= now) {
        if (windows.size >= MAX_TRACKED_KEYS) prune(now);
        windows.set(key, { count: 1, resetAt: now + options.windowMs });
        return;
      }
      window.count += 1;
    },
    reset(key) {
      windows.delete(key);
    },
  };
}

/**
 * Client address as seen by the nearest proxy (Traefik appends the peer it
 * accepted the connection from as the last X-Forwarded-For entry).
 */
export function clientAddress(headers: Headers) {
  const forwarded = headers.get("x-forwarded-for");
  const last = forwarded?.split(",").at(-1)?.trim();
  return last || headers.get("x-real-ip")?.trim() || "unknown";
}
