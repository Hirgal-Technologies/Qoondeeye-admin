import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DateRangeParams } from "@/lib/data/types";

export type OverviewSummary = {
  totalUsers: number;
  newUsers7d: number;
  newUsers30d: number;
  dau: number;
  mau: number;
  totalTransactionVolume30d: number;
  totalTransactionCount30d: number;
};

function daysAgoIso(days: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}
function daysAgoDate(days: number) {
  return daysAgoIso(days).slice(0, 10);
}

export async function getOverviewSummary(): Promise<OverviewSummary> {
  const db = createAdminClient();
  const since7d = daysAgoIso(7);
  const since30d = daysAgoIso(30);
  const since1dDate = daysAgoDate(1);
  const since30dDate = daysAgoDate(30);

  const [totalUsers, newUsers7d, newUsers30d, txVolume30d, dauRows, mauRows] =
    await Promise.all([
      db.from("profiles").select("id", { count: "exact", head: true }),
      db
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since7d),
      db
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since30d),
      db.from("expenses").select("amount").gte("date", since30dDate),
      // DAU/MAU proxy: distinct users who logged an expense/income entry in
      // the window. There's no dedicated sessions/events table yet, so
      // "active" is approximated via ledger activity.
      db.from("expenses").select("user_id").gte("date", since1dDate),
      db.from("expenses").select("user_id").gte("date", since30dDate),
    ]);

  const totalTransactionVolume30d = (txVolume30d.data ?? []).reduce(
    (sum, row) => sum + Number(row.amount ?? 0),
    0
  );

  return {
    totalUsers: totalUsers.count ?? 0,
    newUsers7d: newUsers7d.count ?? 0,
    newUsers30d: newUsers30d.count ?? 0,
    dau: new Set((dauRows.data ?? []).map((r) => r.user_id)).size,
    mau: new Set((mauRows.data ?? []).map((r) => r.user_id)).size,
    totalTransactionVolume30d,
    totalTransactionCount30d: txVolume30d.data?.length ?? 0,
  };
}

export type RetentionPoint = { day: number; retentionPct: number };

export type ActiveUsersPoint = {
  date: string;
  dau: number;
  mau: number;
};

/**
 * Daily distinct ledger-active users and trailing 30-day distinct users.
 * Ledger activity remains the current activity proxy until dedicated session
 * telemetry is available.
 */
export async function getActiveUsersTrend(
  params: DateRangeParams
): Promise<ActiveUsersPoint[]> {
  const db = createAdminClient();
  const from = new Date(params.from);
  const queryFrom = new Date(from.getTime() - 29 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const to = params.to.slice(0, 10);

  const { data } = await db
    .from("expenses")
    .select("user_id, date")
    .gte("date", queryFrom)
    .lte("date", to);

  const usersByDay = new Map<string, Set<string>>();
  for (const row of data ?? []) {
    const day = String(row.date).slice(0, 10);
    const users = usersByDay.get(day) ?? new Set<string>();
    users.add(row.user_id);
    usersByDay.set(day, users);
  }

  const points: ActiveUsersPoint[] = [];
  for (
    let cursor = new Date(params.from.slice(0, 10));
    cursor <= new Date(to);
    cursor = new Date(cursor.getTime() + 86_400_000)
  ) {
    const date = cursor.toISOString().slice(0, 10);
    const monthlyUsers = new Set<string>();
    for (let offset = 0; offset < 30; offset += 1) {
      const day = new Date(cursor.getTime() - offset * 86_400_000)
        .toISOString()
        .slice(0, 10);
      for (const userId of usersByDay.get(day) ?? []) {
        monthlyUsers.add(userId);
      }
    }
    points.push({
      date,
      dau: usersByDay.get(date)?.size ?? 0,
      mau: monthlyUsers.size,
    });
  }

  return points;
}

/**
 * D1/D7/D30 retention across recent signup cohorts.
 * Retained = the user logged at least one ledger entry on/after signup+N days.
 * TODO(perf): scans profiles+expenses directly; back with a rollup table once
 * volume grows (see plan Phase 1.2).
 */
export async function getRetentionCurve(cohortWindowDays = 30): Promise<RetentionPoint[]> {
  const db = createAdminClient();
  const cohortSince = daysAgoIso(cohortWindowDays + 30);

  const { data: cohort } = await db
    .from("profiles")
    .select("id, created_at")
    .gte("created_at", cohortSince);

  if (!cohort || cohort.length === 0) {
    return [1, 7, 30].map((day) => ({ day, retentionPct: 0 }));
  }

  const userIds = cohort.map((u) => u.id);
  const { data: activity } = await db
    .from("expenses")
    .select("user_id, date")
    .in("user_id", userIds);

  const lastActivityByUser = new Map<string, string>();
  for (const row of activity ?? []) {
    const prev = lastActivityByUser.get(row.user_id);
    if (!prev || row.date > prev) lastActivityByUser.set(row.user_id, row.date);
  }

  return [1, 7, 30].map((day) => {
    let eligible = 0;
    let retained = 0;
    for (const user of cohort) {
      const signupMs = new Date(user.created_at).getTime();
      const cutoff = signupMs + day * 86_400_000;
      if (cutoff > Date.now()) continue; // not enough time has passed yet
      eligible += 1;
      const lastActivity = lastActivityByUser.get(user.id);
      if (lastActivity && new Date(lastActivity).getTime() >= cutoff) retained += 1;
    }
    return { day, retentionPct: eligible === 0 ? 0 : retained / eligible };
  });
}
