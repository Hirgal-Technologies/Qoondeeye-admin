import "server-only";

type CacheEntry = {
  body: string;
  expiresAt: number;
};

const MAX_ENTRIES = 256;

// Route handlers can be bundled separately, each with its own copy of this
// module. Keeping the store on globalThis makes it one per process, so a
// mutation in one route can invalidate entries another route cached.
const globalForCache = globalThis as typeof globalThis & {
  __adminQueryCache?: Map<string, CacheEntry>;
};
const store = (globalForCache.__adminQueryCache ??= new Map<string, CacheEntry>());

/**
 * Small in-process TTL cache for serialized read-only API responses.
 *
 * Analytics endpoints aggregate the same data for every authorized admin, so
 * one computation per TTL window can serve every concurrent viewer instead of
 * hitting the database once per widget per admin. Entries are tiny JSON
 * strings and the store is bounded, so worst-case memory is a few hundred KB.
 * Scope: per server process — a shared store (e.g. Redis) can replace this
 * without changing callers if the app is ever scaled across many instances.
 */
export function readCachedResponse(key: string): string | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    store.delete(key);
    return null;
  }
  return entry.body;
}

/**
 * Drops every cached response for an operation (all query-string variants).
 * Mutations call this so the next read reflects the write instead of waiting
 * out the TTL.
 */
export function invalidateCachedResponses(operation: string) {
  for (const key of store.keys()) {
    if (key === operation || key.startsWith(`${operation}?`)) store.delete(key);
  }
}

export function writeCachedResponse(key: string, body: string, ttlMs: number) {
  if (ttlMs <= 0) return;
  if (store.size >= MAX_ENTRIES) {
    const now = Date.now();
    for (const [existingKey, entry] of store) {
      if (entry.expiresAt <= now) store.delete(existingKey);
    }
    while (store.size >= MAX_ENTRIES) {
      const oldest = store.keys().next().value;
      if (oldest === undefined) break;
      store.delete(oldest);
    }
  }
  store.set(key, { body, expiresAt: Date.now() + ttlMs });
}
