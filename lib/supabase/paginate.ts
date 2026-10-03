import "server-only";
import type { PostgrestError } from "@supabase/supabase-js";

const PAGE_SIZE = 1_000;

type PageResult<T> = {
  data: T[] | null;
  error: PostgrestError | null;
};

/**
 * PostgREST caps a single response at ~1000 rows (the project's max-rows), so
 * an unpaged `select` silently truncates large tables. Reads every page of a
 * query; `fetchPage` must apply a stable `order` so pages don't overlap.
 */
export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PageResult<T>>
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

/** Splits a list for `.in()` filters so the request URL stays bounded. */
export function chunk<T>(items: T[], size = 100): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}
