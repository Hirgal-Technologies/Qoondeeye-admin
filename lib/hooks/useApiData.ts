"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ApiState<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "error"; data: null; error: string }
  | { status: "success"; data: T; error: null };

type ApiResult<T> = ApiState<T> & { retry: () => void };

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
  if (!bypassCache && existing && existing.expiresAt > Date.now()) {
    return existing.promise;
  }

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
      }
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

type HookState<T> = { url: string; attempt: number; state: ApiState<T> };

function initialState<T>(url: string, attempt: number): HookState<T> {
  return {
    url,
    attempt,
    state: readFreshCache<T>(url) ?? { status: "loading", data: null, error: null },
  };
}

/** Fetches a `{ data, error }` endpoint and exposes a retryable, safe UI state. */
export function useApiData<T>(url: string): ApiResult<T> {
  const [attempt, setAttempt] = useState(0);
  const bypassCacheRef = useRef(false);
  const [current, setCurrent] = useState<HookState<T>>(() => initialState<T>(url, attempt));

  // Render-phase reset: when the URL (or a retry) changes, show the cached
  // value or the loading state immediately instead of a stale response.
  if (current.url !== url || current.attempt !== attempt) {
    setCurrent(initialState<T>(url, attempt));
  }

  const retry = useCallback(() => {
    bypassCacheRef.current = true;
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    const bypassCache = bypassCacheRef.current;
    bypassCacheRef.current = false;
    if (!bypassCache && readFreshCache<T>(url)) return;

    let cancelled = false;
    const settle = (state: ApiState<T>) => {
      if (!cancelled) setCurrent({ url, attempt, state });
    };

    getSharedRequest(url, bypassCache)
      .then((outcome) => {
        if (outcome.error !== null) {
          settle({ status: "error", data: null, error: safeErrorMessage(outcome.error) });
          return;
        }
        settle({ status: "success", data: outcome.data as T, error: null });
      })
      .catch((error: unknown) => {
        settle({ status: "error", data: null, error: safeErrorMessage(error) });
      });

    return () => {
      cancelled = true;
    };
  }, [attempt, url]);

  return { ...current.state, retry };
}
