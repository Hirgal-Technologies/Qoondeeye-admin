export type TransactionUserOption = {
  id: string;
  fullName: string | null;
  email: string;
};

export type TransactionRow = {
  id: string;
  userId: string;
  user: TransactionUserOption | null;
  accountId: string | null;
  amount: number;
  description: string | null;
  date: string;
  category: string | null;
  isRecurring: boolean;
  recurrenceInterval: string | null;
  type: string;
  createdAt: string;
  evcKind: string | null;
};

export type TransactionsResult = {
  rows: TransactionRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  users: TransactionUserOption[];
  types: string[];
};

export type TransactionListParams = {
  from: string;
  to: string;
  page: number;
  pageSize: number;
  search?: string;
  userId?: string;
  type?: string;
};

export type TransactionUserProfile = {
  id: string;
  fullName: string | null;
  email: string;
  phone: string | null;
  userType: string | null;
  language: string | null;
  darkMode: boolean;
  imageUrl: string | null;
  createdAt: string;
};

export type TransactionUserAuth = {
  createdAt: string;
  lastSignInAt: string | null;
  emailConfirmedAt: string | null;
  providers: string[];
  isBanned: boolean;
  bannedUntil: string | null;
};

export type TransactionUserAccount = {
  id: string;
  name: string;
  accountType: string;
  amount: number;
  currency: string;
  description: string | null;
  isDefault: boolean;
  balanceInitializedFromSms: boolean;
  balanceManuallyEdited: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TransactionUserSummary = {
  totalTransactions: number;
  totalIncome: number;
  totalExpenses: number;
  netFlow: number;
  lastTransactionDate: string | null;
};

export type TransactionUserDetails = {
  profile: TransactionUserProfile;
  auth: TransactionUserAuth | null;
  accounts: TransactionUserAccount[];
  summary: TransactionUserSummary;
  recentTransactions: TransactionRow[];
};
