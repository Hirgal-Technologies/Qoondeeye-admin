import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  DateRangeParams,
  Granularity,
} from "@/features/analytics/shared/contracts";
import type {
  ActiveUserRow,
  ActiveUsersList,
  CohortRetentionRow,
  NewUsersList,
} from "@/features/analytics/users/contracts";

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

/**
 * Cohort (signup week) x week-since-signup retention matrix, weeks 0-4.
 * "Activity" = a row in `expenses` (the unified ledger table).
 * Prefer a dedicated SQL aggregate if this matrix becomes a hot path;
 * overview D1/D7/D30 already uses `admin_retention_curve`.
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

/**
 * Newest profiles created in the range, plus the exact total for the range.
 * The total comes from a `head` count so it stays accurate no matter how
 * small `limit` is.
 */
export async function getNewUsers(
  params: DateRangeParams & { limit: number }
): Promise<NewUsersList> {
  const db = createAdminClient();
  const { data, count } = await db
    .from("profiles")
    .select("id, email, full_name, user_type, created_at", { count: "exact" })
    .gte("created_at", params.from)
    .lte("created_at", params.to)
    .order("created_at", { ascending: false })
    .limit(params.limit);

  const users = (data ?? []).map((row) => ({
    id: String(row.id),
    email: row.email ? String(row.email) : "Unavailable",
    fullName: row.full_name ? String(row.full_name) : null,
    userType: row.user_type ? String(row.user_type) : null,
    createdAt: String(row.created_at),
  }));

  return { total: count ?? users.length, users };
}

/**
 * PostgREST caps a single `select` at ~1000 rows, so a range scan of the
 * ledger has to be paged explicitly or the roster silently truncates.
 * MAX_PAGES bounds the work for very large windows.
 */
const LEDGER_PAGE_SIZE = 1000;
const LEDGER_MAX_PAGES = 50;

type LedgerRow = { user_id: string; date: string; amount: number | string | null };

async function readLedgerRange(from: string, to: string): Promise<LedgerRow[]> {
  const db = createAdminClient();
  const rows: LedgerRow[] = [];

  for (let page = 0; page < LEDGER_MAX_PAGES; page++) {
    const start = page * LEDGER_PAGE_SIZE;
    const { data, error } = await db
      .from("expenses")
      .select("user_id, date, amount")
      .gte("date", from)
      .lte("date", to)
      .order("date", { ascending: true })
      .range(start, start + LEDGER_PAGE_SIZE - 1);

    if (error) throw error;
    const batch = (data ?? []) as LedgerRow[];
    rows.push(...batch);
    if (batch.length < LEDGER_PAGE_SIZE) break;
  }

  return rows;
}

/**
 * Users with ledger activity in the range, ranked by most recent activity.
 * Ledger activity is the same engagement proxy the overview DAU/MAU trend
 * uses — there is no session telemetry yet.
 */
export async function getActiveUsers(
  params: DateRangeParams & { limit: number }
): Promise<ActiveUsersList> {
  const from = params.from.slice(0, 10);
  const to = params.to.slice(0, 10);
  const ledger = await readLedgerRange(from, to);

  type Aggregate = { entries: number; volume: number; lastActiveAt: string };
  const byUser = new Map<string, Aggregate>();
  for (const row of ledger) {
    if (!row.user_id) continue;
    const date = String(row.date).slice(0, 10);
    const current = byUser.get(row.user_id) ?? {
      entries: 0,
      volume: 0,
      lastActiveAt: date,
    };
    current.entries += 1;
    current.volume += Number(row.amount ?? 0);
    if (date > current.lastActiveAt) current.lastActiveAt = date;
    byUser.set(row.user_id, current);
  }

  const ranked = [...byUser.entries()]
    .sort(
      ([, a], [, b]) =>
        b.lastActiveAt.localeCompare(a.lastActiveAt) || b.entries - a.entries
    )
    .slice(0, params.limit);

  const db = createAdminClient();
  const { data: profiles } = await db
    .from("profiles")
    .select("id, email, full_name, created_at")
    .in(
      "id",
      ranked.map(([id]) => id)
    );

  const profileById = new Map(
    (profiles ?? []).map((row) => [String(row.id), row])
  );

  const users: ActiveUserRow[] = ranked.map(([id, aggregate]) => {
    const profile = profileById.get(id);
    return {
      id,
      email: profile?.email ? String(profile.email) : "Unavailable",
      fullName: profile?.full_name ? String(profile.full_name) : null,
      createdAt: profile?.created_at ? String(profile.created_at) : null,
      lastActiveAt: aggregate.lastActiveAt,
      entries: aggregate.entries,
      volume: aggregate.volume,
    };
  });

  return {
    totalActive: byUser.size,
    totalEntries: ledger.length,
    users,
  };
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
