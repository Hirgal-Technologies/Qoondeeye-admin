"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyBackgroundRefresh,
  attachLiveRefresh,
  resolveSharedFetch,
  withSearch,
  type LiveRefreshReason,
} from "@/lib/hooks/live-refresh";

type ApiState<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "error"; data: null; error: string }
  | { status: "success"; data: T; error: null };

export type ApiRetryOptions = {
  /** Extra query params for this request only. Polling keeps the original URL. */
  search?: Record<string, string>;
};

type ApiResult<T> = ApiState<T> & {
  retry: (options?: ApiRetryOptions) => void;
  refreshing: boolean;
  updatedAt: number | null;
  liveUnavailable: boolean;
};

type FetchOutcome = { data: unknown; error: string | null };

// Several widgets on one page request identical URLs (e.g. a stat tile and a
// chart both reading /api/users/signups). A short-lived shared cache turns
// those into a single network request and makes back/forward navigation
// render instantly from memory.
const CACHE_TTL_MS = 30_000;
const MAX_CACHE_ENTRIES = 64;

type CacheEntry = {
  promise: Promise<FetchOutcome>;
  result: FetchOutcome | null;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry>();

function safeErrorMessage(value: unknown) {
  if (value === "unauthorized") return "Your session has expired. Sign in again.";
  if (value === "forbidden") return "You do not have permission to view this data.";
  return "We couldn’t load this data. Try again.";
}

async function fetchOutcome(url: string): Promise<FetchOutcome> {
  const response = await fetch(url);
  const body = await response
    .json()
    .catch(() => ({ data: null, error: "invalid response" }));
  if (!response.ok || body.error) {
    return { data: null, error: body.error ?? "request failed" };
  }
  return { data: body.data, error: null };
}

function pruneCache() {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(key);
  }
  while (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

function getSharedRequest(url: string, bypassCache: boolean): Promise<FetchOutcome> {
  const existing = cache.get(url);
  const decision = resolveSharedFetch({
    bypassCache,
    inFlight: Boolean(existing && existing.result === null && existing.expiresAt > Date.now()),
    fresh: Boolean(existing && existing.result && existing.expiresAt > Date.now()),
  });
  if (decision === "join" && existing) return existing.promise;
  if (decision === "reuse" && existing) return existing.promise;

  pruneCache();
  const entry: CacheEntry = {
    result: null,
    expiresAt: Date.now() + CACHE_TTL_MS,
    promise: fetchOutcome(url).then(
      (outcome) => {
        if (outcome.error !== null) cache.delete(url);
        else entry.result = outcome;
        return outcome;
      },
      (error: unknown) => {
        cache.delete(url);
        throw error;
      },
    ),
  };
  cache.set(url, entry);
  return entry.promise;
}

function readFreshCache<T>(url: string): ApiState<T> | null {
  const entry = cache.get(url);
  if (entry && entry.result && entry.result.error === null && entry.expiresAt > Date.now()) {
    return { status: "success", data: entry.result.data as T, error: null };
  }
  return null;
}

type HookState<T> = {
  url: string;
  attempt: number;
  state: ApiState<T>;
  refreshing: boolean;
  updatedAt: number | null;
  consecutiveFailures: number;
};

function initialState<T>(url: string, attempt: number): HookState<T> {
  return {
    url,
    attempt,
    state: readFreshCache<T>(url) ?? { status: "loading", data: null, error: null },
    refreshing: false,
    updatedAt: null,
    consecutiveFailures: 0,
  };
}

export type UseApiDataOptions = {
  /** Background refresh interval. Omitted means load once, same as before. */
  pollIntervalMs?: number;
};

/** Fetches a `{ data, error }` endpoint and exposes a retryable, safe UI state. */
export function useApiData<T>(url: string, options?: UseApiDataOptions): ApiResult<T> {
  const pollIntervalMs = options?.pollIntervalMs;
  const [attempt, setAttempt] = useState(0);
  const bypassCacheRef = useRef(false);
  const extraSearchRef = useRef<Record<string, string> | null>(null);
  const inFlightRef = useRef(false);
  const requestGeneration = useRef(0);
  const [current, setCurrent] = useState<HookState<T>>(() => initialState<T>(url, attempt));

  if (current.url !== url) {
    setCurrent(initialState<T>(url, attempt));
  } else if (current.attempt !== attempt) {
    if (current.state.status === "success") {
      setCurrent({ ...current, attempt, refreshing: true });
    } else {
      setCurrent({
        ...initialState<T>(url, attempt),
        updatedAt: current.updatedAt,
        consecutiveFailures: current.consecutiveFailures,
      });
    }
  }

  const retry = useCallback((retryOptions?: ApiRetryOptions) => {
    extraSearchRef.current = retryOptions?.search ?? null;
    bypassCacheRef.current = true;
    setAttempt((value) => value + 1);
  }, []);

  const retryRef = useRef(retry);
  retryRef.current = retry;

  useEffect(() => {
    const bypassCache = bypassCacheRef.current;
    const search = extraSearchRef.current;
    bypassCacheRef.current = false;
    extraSearchRef.current = null;
    const requestUrl = withSearch(url, search);
    if (!bypassCache && readFreshCache<T>(requestUrl)) {
      setCurrent((previous) =>
        previous.updatedAt == null
          ? { ...previous, refreshing: false, updatedAt: Date.now() }
          : { ...previous, refreshing: false },
      );
      return;
    }

    const generation = ++requestGeneration.current;
    let cancelled = false;
    inFlightRef.current = true;

    getSharedRequest(requestUrl, bypassCache)
      .then((outcome) => {
        setCurrent((previous) => {
          const previousData = previous.url === url && previous.state.status === "success" ? previous.state.data : null;
          const applied = applyBackgroundRefresh({
            previous: previousData,
            next: outcome.error === null ? (outcome.data as T) : null,
            ok: outcome.error === null,
          });
          if (cancelled) return previous;
          if (outcome.error !== null && !applied.preserved) {
            return {
              url,
              attempt,
              state: { status: "error", data: null, error: safeErrorMessage(outcome.error) },
              refreshing: false,
              updatedAt: previous.updatedAt,
              consecutiveFailures: previous.consecutiveFailures + 1,
            };
          }
          if (applied.preserved && applied.data != null) {
            return {
              url,
              attempt,
              state: { status: "success", data: applied.data, error: null },
              refreshing: false,
              updatedAt: previous.updatedAt,
              consecutiveFailures: previous.consecutiveFailures + 1,
            };
          }
          return {
            url,
            attempt,
            state: { status: "success", data: applied.data as T, error: null },
            refreshing: false,
            updatedAt: Date.now(),
            consecutiveFailures: 0,
          };
        });
      })
      .catch((error: unknown) => {
        const message = safeErrorMessage(error);
        setCurrent((previous) => {
          if (previous.state.status === "success") {
            return {
              ...previous,
              attempt,
              refreshing: false,
              consecutiveFailures: previous.consecutiveFailures + 1,
            };
          }
          return {
            url,
            attempt,
            state: { status: "error", data: null, error: message },
            refreshing: false,
            updatedAt: previous.updatedAt,
            consecutiveFailures: previous.consecutiveFailures + 1,
          };
        });
      })
      .finally(() => {
        if (requestGeneration.current === generation) inFlightRef.current = false;
      });

    return () => {
      cancelled = true;
    };
  }, [attempt, url]);

  useEffect(() => {
    if (!pollIntervalMs || typeof window === "undefined") return;
    return attachLiveRefresh(
      {
        hidden: () => document.hidden,
        now: () => Date.now(),
        setInterval: (fn, ms) => window.setInterval(fn, ms),
        clearInterval: (id) => window.clearInterval(id as number),
        addEventListener: (target, type, fn) => {
          const node = target === "document" ? document : window;
          node.addEventListener(type, fn);
        },
        removeEventListener: (target, type, fn) => {
          const node = target === "document" ? document : window;
          node.removeEventListener(type, fn);
        },
      },
      pollIntervalMs,
      (reason: LiveRefreshReason) => {
        if (reason === "interval" || reason === "focus" || reason === "visible" || reason === "online") {
          if (inFlightRef.current) return;
          retryRef.current();
        }
      },
    );
  }, [pollIntervalMs]);

  return {
    ...current.state,
    retry,
    refreshing: current.refreshing,
    updatedAt: current.updatedAt,
    liveUnavailable: current.consecutiveFailures >= 2 && current.state.status === "success",
  };
}
