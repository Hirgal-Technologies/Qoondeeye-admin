export type SignupPoint = {
  date: string;
  count: number;
};

export type AuthMethodPoint = {
  method: string;
  count: number;
};

export type ChurnSummary = {
  churnedCount: number;
  churnedPct: number;
};

export type CohortRetentionRow = {
  cohort: string;
  [week: `week${number}`]: number | string;
};
