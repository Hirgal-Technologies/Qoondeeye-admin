import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DateRangeParams } from "@/features/analytics/shared/contracts";
import type {
  ActiveUsersPoint,
  OverviewSummary,
  RetentionPoint,
} from "@/features/analytics/overview/contracts";

type OverviewSummaryRow = OverviewSummary;

type ActiveUsersTrendRow = {
  date: string;
  dau: number;
  mau: number;
};

type RetentionCurveRow = {
  day: number;
  retention_pct: number;
};

/**
 * Prefer the daily_activity rollup when it covers the requested window
 * (after `refresh_daily_activity`). Fall back to a live SQL aggregate so
 * the dashboard stays correct before the first nightly refresh.
 */
async function rollupCoversRange(from: string, to: string): Promise<boolean> {
  const db = createAdminClient();
  const { count, error } = await db
    .from("daily_activity")
    .select("date", { count: "exact", head: true })
    .gte("date", from)
    .lte("date", to);

  if (error || count === null) return false;

  const fromMs = Date.parse(`${from}T00:00:00.000Z`);
  const toMs = Date.parse(`${to}T00:00:00.000Z`);
  if (Number.isNaN(fromMs) || Number.isNaN(toMs) || toMs < fromMs) return false;

  const expectedDays = Math.floor((toMs - fromMs) / 86_400_000) + 1;
  return count >= expectedDays;
}

export async function getOverviewSummary(): Promise<OverviewSummary> {
  const db = createAdminClient();
  const { data, error } = await db.rpc("admin_overview_summary");
  if (error) throw error;

  const row = data as OverviewSummaryRow;
  return {
    totalUsers: Number(row.totalUsers ?? 0),
    newUsers7d: Number(row.newUsers7d ?? 0),
    newUsers30d: Number(row.newUsers30d ?? 0),
    dau: Number(row.dau ?? 0),
    mau: Number(row.mau ?? 0),
    totalTransactionVolume30d: Number(row.totalTransactionVolume30d ?? 0),
    totalTransactionCount30d: Number(row.totalTransactionCount30d ?? 0),
  };
}

/**
 * Daily distinct ledger-active users and trailing 30-day distinct users.
 * Ledger activity remains the current activity proxy until dedicated session
 * telemetry is available. Aggregation runs in Postgres (live or rollup).
 */
export async function getActiveUsersTrend(
  params: DateRangeParams
): Promise<ActiveUsersPoint[]> {
  const db = createAdminClient();
  const from = params.from.slice(0, 10);
  const to = params.to.slice(0, 10);
  const useRollup = await rollupCoversRange(from, to);
  const rpcName = useRollup
    ? "admin_active_users_trend_from_rollup"
    : "admin_active_users_trend";

  const { data, error } = await db.rpc(rpcName, {
    p_from: from,
    p_to: to,
  });
  if (error) throw error;

  return ((data as ActiveUsersTrendRow[] | null) ?? []).map((row) => ({
    date: String(row.date).slice(0, 10),
    dau: Number(row.dau ?? 0),
    mau: Number(row.mau ?? 0),
  }));
}

/**
 * D1/D7/D30 retention across recent signup cohorts.
 * Retained = the user logged at least one ledger entry on/after signup+N days.
 */
export async function getRetentionCurve(
  cohortWindowDays = 30
): Promise<RetentionPoint[]> {
  const db = createAdminClient();
  const { data, error } = await db.rpc("admin_retention_curve", {
    p_cohort_window_days: cohortWindowDays,
  });
  if (error) throw error;

  const rows = (data as RetentionCurveRow[] | null) ?? [];
  const byDay = new Map(rows.map((row) => [Number(row.day), Number(row.retention_pct ?? 0)]));

  return [1, 7, 30].map((day) => ({
    day,
    retentionPct: byDay.get(day) ?? 0,
  }));
}
