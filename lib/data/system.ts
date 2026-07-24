import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DateRangeParams } from "@/lib/data/types";

// Everything in this file is a Phase 3 dependency on mobile-app telemetry
// that may not exist yet (see plan Milestone 3.1). Assumed tables:
//   public.sync_events (id, occurred_at, success bool, queue_depth int)
//   public.ocr_events  (id, occurred_at, success bool)
//   public.error_logs  (id, occurred_at, error_type text, message text)
// If these don't exist yet, these queries will fail loudly — that's the
// signal to either add the telemetry to the mobile app or adjust table names.

function dayKey(iso: string) {
  return new Date(iso).toISOString().slice(0, 10);
}

export async function getSyncHealth(
  params: DateRangeParams
): Promise<{ date: string; successRate: number; avgQueueDepth: number; failures: number }[]> {
  const db = createAdminClient();
  const { data } = await db
    .from("sync_events")
    .select("occurred_at, success, queue_depth")
    .gte("occurred_at", params.from)
    .lte("occurred_at", params.to);

  const buckets = new Map<string, { total: number; success: number; queueSum: number }>();
  for (const row of data ?? []) {
    const key = dayKey(row.occurred_at);
    const bucket = buckets.get(key) ?? { total: 0, success: 0, queueSum: 0 };
    bucket.total += 1;
    if (row.success) bucket.success += 1;
    bucket.queueSum += Number(row.queue_depth ?? 0);
    buckets.set(key, bucket);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, b]) => ({
      date,
      successRate: b.total === 0 ? 0 : b.success / b.total,
      avgQueueDepth: b.total === 0 ? 0 : b.queueSum / b.total,
      failures: b.total - b.success,
    }));
}

export async function getOcrSuccessRate(
  params: DateRangeParams
): Promise<{ date: string; successRate: number; attempts: number }[]> {
  const db = createAdminClient();
  const { data } = await db
    .from("ocr_events")
    .select("occurred_at, success")
    .gte("occurred_at", params.from)
    .lte("occurred_at", params.to);

  const buckets = new Map<string, { total: number; success: number }>();
  for (const row of data ?? []) {
    const key = dayKey(row.occurred_at);
    const bucket = buckets.get(key) ?? { total: 0, success: 0 };
    bucket.total += 1;
    if (row.success) bucket.success += 1;
    buckets.set(key, bucket);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, b]) => ({
      date,
      successRate: b.total === 0 ? 0 : b.success / b.total,
      attempts: b.total,
    }));
}

export async function getRecentErrors(
  params: DateRangeParams & { limit?: number }
): Promise<{ timestamp: string; errorType: string; message: string; count: number }[]> {
  const db = createAdminClient();
  const { data } = await db
    .from("error_logs")
    .select("occurred_at, error_type, message")
    .gte("occurred_at", params.from)
    .lte("occurred_at", params.to)
    .order("occurred_at", { ascending: false })
    .limit(params.limit ?? 100);

  const grouped = new Map<string, { timestamp: string; errorType: string; message: string; count: number }>();
  for (const row of data ?? []) {
    const key = `${row.error_type}:${row.message}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      grouped.set(key, {
        timestamp: row.occurred_at,
        errorType: row.error_type,
        message: row.message,
        count: 1,
      });
    }
  }
  return [...grouped.values()];
}
