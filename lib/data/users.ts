import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DateRangeParams, Granularity } from "@/lib/data/types";

function truncKey(iso: string, granularity: Granularity) {
  const d = new Date(iso);
  if (granularity === "day") return d.toISOString().slice(0, 10);
  if (granularity === "month") return d.toISOString().slice(0, 7) + "-01";
  // week: ISO week start (Monday)
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

export async function getSignupTrend(
  params: DateRangeParams & { granularity: Granularity }
): Promise<{ date: string; count: number }[]> {
  const db = createAdminClient();
  const { data } = await db
    .from("profiles")
    .select("created_at")
    .gte("created_at", params.from)
    .lte("created_at", params.to);

  const buckets = new Map<string, number>();
  for (const row of data ?? []) {
    const key = truncKey(row.created_at, params.granularity);
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));
}

/**
 * `profiles` has no auth-method column — provider comes from Supabase Auth
 * itself (identities/app_metadata), so this uses the admin auth API instead
 * of a table query. Paginates through all users (1000/page).
 */
export async function getAuthMethodBreakdown(): Promise<
  { method: string; count: number }[]
> {
  const db = createAdminClient();
  const buckets = new Map<string, number>();

  let page = 1;
  const perPage = 1000;
  while (true) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage });
    if (error || !data) break;

    for (const user of data.users) {
      const method =
        user.app_metadata?.provider ??
        user.identities?.[0]?.provider ??
        "email";
      buckets.set(method, (buckets.get(method) ?? 0) + 1);
    }

    if (data.users.length < perPage) break;
    page += 1;
  }

  return [...buckets.entries()].map(([method, count]) => ({ method, count }));
}

export type CohortRetentionRow = { cohort: string; [week: `week${number}`]: number | string };

/**
 * Cohort (signup week) x week-since-signup retention matrix, weeks 0-4.
 * "Activity" = a row in `expenses` (the unified ledger table).
 * TODO(perf): same caveat as getRetentionCurve — move to a rollup once data grows.
 */
export async function getCohortRetention(params: DateRangeParams): Promise<CohortRetentionRow[]> {
  const db = createAdminClient();
  const { data: users } = await db
    .from("profiles")
    .select("id, created_at")
    .gte("created_at", params.from)
    .lte("created_at", params.to);

  if (!users || users.length === 0) return [];

  const { data: activity } = await db
    .from("expenses")
    .select("user_id, date")
    .in(
      "user_id",
      users.map((u) => u.id)
    );

  const activityByUser = new Map<string, string[]>();
  for (const row of activity ?? []) {
    const list = activityByUser.get(row.user_id) ?? [];
    list.push(row.date);
    activityByUser.set(row.user_id, list);
  }

  const cohorts = new Map<string, string[]>(); // cohortWeekStart -> userIds
  for (const user of users) {
    const key = truncKey(user.created_at, "week");
    const list = cohorts.get(key) ?? [];
    list.push(user.id);
    cohorts.set(key, list);
  }

  const WEEKS = 5;
  const rows: CohortRetentionRow[] = [];
  for (const [cohort, userIds] of [...cohorts.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const cohortStart = new Date(cohort).getTime();
    const row: CohortRetentionRow = { cohort };
    for (let w = 0; w < WEEKS; w++) {
      const windowStart = cohortStart + w * 7 * 86_400_000;
      const windowEnd = windowStart + 7 * 86_400_000;
      if (windowEnd > Date.now()) {
        row[`week${w}`] = null as unknown as number;
        continue;
      }
      let retained = 0;
      for (const userId of userIds) {
        const events = activityByUser.get(userId) ?? [];
        if (events.some((d) => {
          const t = new Date(d).getTime();
          return t >= windowStart && t < windowEnd;
        })) {
          retained += 1;
        }
      }
      row[`week${w}`] = userIds.length === 0 ? 0 : retained / userIds.length;
    }
    rows.push(row);
  }
  return rows;
}

export async function getChurn(
  inactiveDays = 30
): Promise<{ churnedCount: number; churnedPct: number }> {
  const db = createAdminClient();
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - inactiveDays);
  const cutoffDate = cutoff.toISOString().slice(0, 10);

  const [{ count: totalUsers }, { data: recentActivity }] = await Promise.all([
    db.from("profiles").select("id", { count: "exact", head: true }),
    db.from("expenses").select("user_id").gte("date", cutoffDate),
  ]);

  const activeUserIds = new Set((recentActivity ?? []).map((r) => r.user_id));
  const total = totalUsers ?? 0;
  const churnedCount = Math.max(total - activeUserIds.size, 0);

  return {
    churnedCount,
    churnedPct: total === 0 ? 0 : churnedCount / total,
  };
}
