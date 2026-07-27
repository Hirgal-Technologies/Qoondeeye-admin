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

export type NewUserRow = {
  id: string;
  email: string;
  fullName: string | null;
  userType: string | null;
  createdAt: string;
};

/**
 * `total` counts every profile created in the range; `users` is the newest
 * page of that set, capped by the endpoint's `limit`.
 */
export type NewUsersList = {
  total: number;
  users: NewUserRow[];
};

export type ActiveUserRow = {
  id: string;
  email: string;
  fullName: string | null;
  createdAt: string | null;
  lastActiveAt: string;
  entries: number;
  volume: number;
};

export type ActiveUsersList = {
  totalActive: number;
  totalEntries: number;
  users: ActiveUserRow[];
};
