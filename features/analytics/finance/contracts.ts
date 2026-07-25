export type BudgetAdherence = {
  pctBudgetsOverLimit: number;
  pctBudgetsUnderLimit: number;
  avgUtilization: number;
};

export type SubscriptionsLoansSummary = {
  activeSubscriptions: number;
  totalSubscriptionValueMonthly: number;
  activeLoans: number;
  totalLoanRemaining: number;
};

export type TransactionPoint = {
  date: string;
  volume: number;
  count: number;
};

export type AccountTypePoint = {
  accountType: string;
  count: number;
};
