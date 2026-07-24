export type DashboardRangeDays = 7 | 30 | 90;

export function buildDateRange(days: DashboardRangeDays, now = new Date()) {
  const from = new Date(now.getTime() - days * 86_400_000);
  return {
    from: from.toISOString(),
    to: now.toISOString(),
    granularity: days === 90 ? ("week" as const) : ("day" as const),
  };
}
