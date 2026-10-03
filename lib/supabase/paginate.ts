import "server-only";
import type { PostgrestError } from "@supabase/supabase-js";

const PAGE_SIZE = 1_000;
// Upper bound on page requests in flight for one read, so a very large read
// doesn't open dozens of concurrent connections to Supabase.
const MAX_PARALLEL_PAGES = 4;

type PageResult<T> = {
  data: T[] | null;
  error: PostgrestError | null;
  count?: number | null;
};

/** A PostgREST query builder (thenable, and lets us add the count header). */
export type PageQuery<T> = PromiseLike<PageResult<T>> & {
  setHeader(name: string, value: string): PromiseLike<PageResult<T>>;
};

/**
 * PostgREST caps a single response at ~1000 rows (the project's max-rows), so
 * an unpaged `select` silently truncates large tables. Reads every page of a
 * query; `fetchPage` must apply a stable `order` so pages don't overlap.
 *
 * Latency to Supabase is dominated by round trips, so pages after the first
 * are fetched in parallel: the first page also returns an exact row count
 * (Postgres counts over the same filtered scan it runs for the page), and the
 * remaining pages are requested together. Reading continues while pages come
 * back full, so rows inserted after the count are still included.
 */
export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => PageQuery<T>
): Promise<T[]> {
  const first = await fetchPage(0, PAGE_SIZE - 1).setHeader("Prefer", "count=exact");
  if (first.error) throw first.error;
  const rows: T[] = [...(first.data ?? [])];
  if (rows.length < PAGE_SIZE) return rows;

  let nextPage = 1;
  const countedPages = Math.ceil((first.count ?? 0) / PAGE_SIZE);
  for (;;) {
    const remaining = Math.max(countedPages - nextPage, 1);
    const batch = Math.min(remaining, MAX_PARALLEL_PAGES);
    const pages = await Promise.all(
      Array.from({ length: batch }, (_, offset) => {
        const from = (nextPage + offset) * PAGE_SIZE;
        return fetchPage(from, from + PAGE_SIZE - 1);
      })
    );
    nextPage += batch;
    for (const { data, error } of pages) {
      if (error) throw error;
      const page = data ?? [];
      rows.push(...page);
      if (page.length < PAGE_SIZE) return rows;
    }
  }
}

/** Splits a list for `.in()` filters so the request URL stays bounded. */
export function chunk<T>(items: T[], size = 100): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}
