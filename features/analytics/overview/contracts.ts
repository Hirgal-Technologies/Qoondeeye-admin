export type OverviewSummary = {
  totalUsers: number;
  newUsers7d: number;
  newUsers30d: number;
  dau: number;
  mau: number;
  totalTransactionVolume30d: number;
  totalTransactionCount30d: number;
};

export type RetentionPoint = {
  day: number;
  retentionPct: number;
};

export type ActiveUsersPoint = {
  date: string;
  dau: number;
  mau: number;
};
