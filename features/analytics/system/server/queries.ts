import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DateRangeParams } from "@/features/analytics/shared/contracts";

// System-health signals derived from the confirmed production schema (the
// mobile app ships no dedicated telemetry tables — verified against the live
// database, which has no sync_events / ocr_events / error_logs):
//   public.expenses      (date, created_at, receipt_url, ...) — unified ledger
//   public.notifications (created_at, type, priority, title, ...) — app alerts
//   public.audit_log     (created_at, action, actor_email, ...) — admin actions
//
// "Sync" health = how promptly ledger entries land relative to the expense
// date (created_at vs date). "OCR" health = share of entries carrying a
// receipt. The incident feed groups app notifications and admin audit events.

const PAGE_SIZE = 1000;

type Row = Record<string, unknown>;

async function fetchAllRows(
  table: string,
  columns: string,
  timestampColumn: string,
  params: DateRangeParams
): Promise<Row[]> {
  const db = createAdminClient();
  const rows: Row[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await db
      .from(table)
      .select(columns)
      .gte(timestampColumn, params.from)
      .lte(timestampColumn, params.to)
      .order(timestampColumn, { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    const page = (data ?? []) as unknown as Row[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

function dayKey(iso: string) {
  return new Date(iso).toISOString().slice(0, 10);
}

function lagDays(expenseDate: string, createdAt: string) {
  const entered = Date.parse(dayKey(createdAt));
  const dated = Date.parse(expenseDate.slice(0, 10));
  const lag = Math.round((entered - dated) / 86_400_000);
  // Future-dated entries (scheduled expenses) count as prompt, not backfill.
  return Math.max(0, lag);
}

export async function getSyncHealth(
  params: DateRangeParams
): Promise<{ date: string; successRate: number; avgQueueDepth: number; failures: number }[]> {
  const rows = await fetchAllRows("expenses", "date, created_at", "created_at", params);

  const buckets = new Map<string, { total: number; sameDay: number; lagSum: number }>();
  for (const row of rows) {
    const createdAt = String(row.created_at);
    const lag = lagDays(String(row.date), createdAt);
    const key = dayKey(createdAt);
    const bucket = buckets.get(key) ?? { total: 0, sameDay: 0, lagSum: 0 };
    bucket.total += 1;
    if (lag === 0) bucket.sameDay += 1;
    bucket.lagSum += lag;
    buckets.set(key, bucket);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, b]) => ({
      date,
      successRate: b.total === 0 ? 0 : b.sameDay / b.total,
      avgQueueDepth: b.total === 0 ? 0 : b.lagSum / b.total,
      failures: b.total - b.sameDay,
    }));
}

export async function getOcrSuccessRate(
  params: DateRangeParams
): Promise<{ date: string; successRate: number; attempts: number }[]> {
  const rows = await fetchAllRows("expenses", "created_at, receipt_url", "created_at", params);

  const buckets = new Map<string, { total: number; withReceipt: number }>();
  for (const row of rows) {
    const key = dayKey(String(row.created_at));
    const bucket = buckets.get(key) ?? { total: 0, withReceipt: 0 };
    bucket.total += 1;
    if (row.receipt_url) bucket.withReceipt += 1;
    buckets.set(key, bucket);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, b]) => ({
      date,
      successRate: b.total === 0 ? 0 : b.withReceipt / b.total,
      attempts: b.total,
    }));
}

export async function getAlertsTrend(
  params: DateRangeParams
): Promise<{ date: string; total: number; high: number }[]> {
  const rows = await fetchAllRows(
    "notifications",
    "created_at, priority",
    "created_at",
    params
  );

  const buckets = new Map<string, { total: number; high: number }>();
  for (const row of rows) {
    const key = dayKey(String(row.created_at));
    const bucket = buckets.get(key) ?? { total: 0, high: 0 };
    bucket.total += 1;
    if (row.priority === "high") bucket.high += 1;
    buckets.set(key, bucket);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, b]) => ({ date, ...b }));
}

// Only tables safe to surface in the admin UI; keep in sync with the schema.
const COUNTED_TABLES = [
  "profiles",
  "expenses",
  "transactions",
  "transfers",
  "accounts",
  "budgets",
  "subscriptions",
  "personal_loans",
  "goals",
  "notifications",
  "audit_log",
] as const;

export async function getTableCounts(): Promise<{ table: string; rows: number }[]> {
  const db = createAdminClient();
  return Promise.all(
    COUNTED_TABLES.map(async (table) => {
      const { count, error } = await db
        .from(table)
        .select("*", { count: "exact", head: true });
      if (error) throw error;
      return { table, rows: count ?? 0 };
    })
  );
}

export async function getSyncStatus(): Promise<{
  lastEntryAt: string | null;
  working: boolean;
}> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("expenses")
    .select("created_at")
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  const lastEntryAt = data?.[0]?.created_at ?? null;
  const working =
    lastEntryAt !== null &&
    Date.now() - Date.parse(lastEntryAt) < 24 * 60 * 60 * 1000;
  return { lastEntryAt, working };
}

export async function getRecentErrors(
  params: DateRangeParams & { limit?: number }
): Promise<
  { timestamp: string; errorType: string; message: string; priority: string; count: number }[]
> {
  const db = createAdminClient();
  const limit = params.limit ?? 100;

  const [notifications, auditEvents] = await Promise.all([
    db
      .from("notifications")
      .select("created_at, type, priority, title")
      .gte("created_at", params.from)
      .lte("created_at", params.to)
      .order("created_at", { ascending: false })
      .limit(limit),
    db
      .from("audit_log")
      .select("created_at, action")
      .gte("created_at", params.from)
      .lte("created_at", params.to)
      .order("created_at", { ascending: false })
      .limit(limit),
  ]);
  if (notifications.error) throw notifications.error;
  if (auditEvents.error) throw auditEvents.error;

  const grouped = new Map<
    string,
    { timestamp: string; errorType: string; message: string; priority: string; count: number }
  >();

  const add = (timestamp: string, errorType: string, message: string, priority: string) => {
    const key = `${errorType}:${message}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.count += 1;
      if (timestamp > existing.timestamp) existing.timestamp = timestamp;
    } else {
      grouped.set(key, { timestamp, errorType, message, priority, count: 1 });
    }
  };

  for (const row of notifications.data ?? []) {
    add(row.created_at, `${row.type} alert`, row.title, row.priority ?? "medium");
  }
  for (const row of auditEvents.data ?? []) {
    add(row.created_at, "admin action", row.action, "low");
  }

  return [...grouped.values()].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}
