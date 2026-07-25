export type DashboardRangeDays = 7 | 30 | 90;

// Snap "now" to a 5-minute boundary so generated URLs stay identical between
// widgets and remounts within that window — a moving millisecond timestamp
// defeats every request cache between the browser and the database.
const RANGE_BUCKET_MS = 5 * 60_000;

export function buildDateRange(days: DashboardRangeDays, now = new Date()) {
  const stableNow = new Date(
    Math.floor(now.getTime() / RANGE_BUCKET_MS) * RANGE_BUCKET_MS
  );
  const from = new Date(stableNow.getTime() - days * 86_400_000);
  return {
    from: from.toISOString(),
    to: stableNow.toISOString(),
    granularity: days === 90 ? ("week" as const) : ("day" as const),
  };
}

export function buildCustomDateRange(fromDate: string, toDate: string) {
  const from = new Date(`${fromDate}T00:00:00.000Z`);
  const to = new Date(`${toDate}T23:59:59.999Z`);
  const spanDays = Math.ceil((to.getTime() - from.getTime()) / 86_400_000);

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    granularity:
      spanDays > 180
        ? ("month" as const)
        : spanDays > 45
          ? ("week" as const)
          : ("day" as const),
  };
}
