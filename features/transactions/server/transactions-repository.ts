import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllPages } from "@/lib/supabase/paginate";
import type {
  TransactionListParams,
  TransactionRow,
  TransactionUserAccount,
  TransactionUserDetails,
  TransactionsResult,
  TransactionUserOption,
} from "@/features/transactions/contracts";
import { sanitizeTransactionSearch } from "@/features/transactions/validation";

type ProfileRecord = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type TransactionRecord = {
  id: string;
  user_id: string;
  account_id: string | null;
  amount: number | string | null;
  description: string | null;
  date: string;
  category: string | null;
  is_recurring: boolean | null;
  recurrence_interval: string | null;
  type: string | null;
  created_at: string;
  evc_kind: string | null;
};

type UserProfileRecord = ProfileRecord & {
  phone: string | null;
  user_type: string | null;
  language: string | null;
  dark_mode: boolean | null;
  image_url: string | null;
  created_at: string;
};

type AccountRecord = {
  id: string;
  name: string | null;
  account_type: string | null;
  amount: number | string | null;
  currency: string | null;
  description: string | null;
  is_default: boolean | null;
  balance_initialized_from_sms: boolean | null;
  balance_manually_edited: boolean | null;
  created_at: string;
  updated_at: string;
};

// Values of `transactions.type` written by the app (filter options).
const TRANSACTION_TYPES = [
  "expense",
  "income",
  "balance_adjustment",
  "opening_balance",
];

const TRANSACTION_COLUMNS =
  "id, user_id, account_id, amount, description, date, category, is_recurring, recurrence_interval, type, created_at, evc_kind";

function toUserOption(profile: ProfileRecord): TransactionUserOption {
  return {
    id: String(profile.id),
    fullName: profile.full_name ? String(profile.full_name) : null,
    email: profile.email ? String(profile.email) : "Unavailable",
  };
}

function toTransactionRow(
  row: TransactionRecord,
  user: TransactionUserOption | null,
): TransactionRow {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    user,
    accountId: row.account_id ? String(row.account_id) : null,
    amount: Number(row.amount ?? 0),
    description: row.description ? String(row.description) : null,
    date: String(row.date),
    category: row.category ? String(row.category) : null,
    isRecurring: Boolean(row.is_recurring),
    recurrenceInterval: row.recurrence_interval
      ? String(row.recurrence_interval)
      : null,
    type: row.type ? String(row.type) : "unknown",
    createdAt: String(row.created_at),
    evcKind: row.evc_kind ? String(row.evc_kind) : null,
  };
}

export async function getTransactions(
  params: TransactionListParams,
): Promise<TransactionsResult> {
  const db = createAdminClient();
  // The user list is needed before the transaction query only when a search
  // term must be matched against names; otherwise both reads run together.
  const usersPromise = fetchAllPages<ProfileRecord>((from, to) =>
    db
      .from("profiles")
      .select("id, full_name, email")
      .order("full_name", { ascending: true, nullsFirst: false })
      .order("email", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to),
  ).then((profiles) => profiles.map(toUserOption));

  let query = db
    .from("transactions")
    .select(TRANSACTION_COLUMNS, { count: "exact" })
    .is("deleted_at", null)
    .gte("date", params.from.slice(0, 10))
    .lte("date", params.to.slice(0, 10));

  if (params.userId) query = query.eq("user_id", params.userId);
  if (params.type) query = query.eq("type", params.type);

  const search = sanitizeTransactionSearch(params.search ?? "");
  if (search) {
    const normalized = search.toLocaleLowerCase();
    const matchingUserIds = (await usersPromise)
      .filter((user) =>
        [user.fullName, user.email, user.id]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase()
          .includes(normalized),
      )
      .map((user) => user.id);

    const filters = [
      `description.ilike.%${search}%`,
      `category.ilike.%${search}%`,
      `evc_kind.ilike.%${search}%`,
    ];
    if (matchingUserIds.length > 0) {
      filters.push(`user_id.in.(${matchingUserIds.join(",")})`);
    }
    if (/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(search)) {
      filters.push(`id.eq.${search}`);
    }
    query = query.or(filters.join(","));
  }

  const fromIndex = (params.page - 1) * params.pageSize;
  const [users, { data, count, error }] = await Promise.all([
    usersPromise,
    query
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(fromIndex, fromIndex + params.pageSize - 1),
  ]);

  if (error) throw error;
  const userById = new Map(users.map((user) => [user.id, user]));

  const rows = ((data ?? []) as TransactionRecord[]).map((row) =>
    toTransactionRow(row, userById.get(String(row.user_id)) ?? null),
  );

  const total = count ?? rows.length;
  return {
    rows,
    total,
    page: params.page,
    pageSize: params.pageSize,
    totalPages: Math.max(Math.ceil(total / params.pageSize), 1),
    users,
    types: TRANSACTION_TYPES,
  };
}

const DETAIL_TRANSACTION_LIMIT = 50;

export async function getTransactionUserDetails(
  userId: string,
  options: { includeFinancialDetails?: boolean } = {},
): Promise<TransactionUserDetails | null> {
  const db = createAdminClient();
  // Financial reads only depend on the user id, so they start alongside the
  // profile/Auth lookups instead of waiting for them (one round trip, not two).
  const includeFinancialDetails = options.includeFinancialDetails !== false;
  const [profileResult, authResult, financial] = await Promise.all([
    db
      .from("profiles")
      .select(
        "id, full_name, email, phone, user_type, language, dark_mode, image_url, created_at",
      )
      .eq("id", userId)
      .maybeSingle(),
    db.auth.admin.getUserById(userId),
    includeFinancialDetails ? readFinancialDetails(userId) : null,
  ]);

  if (profileResult.error) throw profileResult.error;
  // A user with no Auth account is a valid state; an Auth outage is not.
  if (authResult.error && authResult.error.status !== 404) throw authResult.error;

  const profile = profileResult.data as UserProfileRecord | null;
  const authUser = authResult.data.user;
  if (!profile && !authUser) return null;

  const metadata = authUser?.user_metadata ?? {};
  const fullName =
    profile?.full_name ??
    stringValue(metadata.full_name) ??
    stringValue(metadata.name);
  const email = profile?.email ?? authUser?.email ?? "Unavailable";
  const user: TransactionUserOption = { id: userId, fullName, email };

  let accounts: TransactionUserAccount[] = [];
  let recentTransactions: TransactionRow[] = [];
  let ledger: Pick<
    TransactionRecord,
    "id" | "amount" | "date" | "type"
  >[] = [];

  if (financial) {
    const { accountsResult, recentResult, ledgerResult } = financial;
    if (accountsResult.error) throw accountsResult.error;
    if (recentResult.error) throw recentResult.error;

    accounts = ((accountsResult.data ?? []) as AccountRecord[]).map(
      (account) => ({
        id: String(account.id),
        name: account.name ? String(account.name) : "Unnamed account",
        accountType: account.account_type
          ? String(account.account_type)
          : "unknown",
        amount: Number(account.amount ?? 0),
        currency: account.currency ? String(account.currency) : "USD",
        description: account.description ? String(account.description) : null,
        isDefault: Boolean(account.is_default),
        balanceInitializedFromSms: Boolean(
          account.balance_initialized_from_sms,
        ),
        balanceManuallyEdited: Boolean(account.balance_manually_edited),
        createdAt: String(account.created_at),
        updatedAt: String(account.updated_at),
      }),
    );
    ledger = ledgerResult;
    recentTransactions = (
      (recentResult.data ?? []) as TransactionRecord[]
    ).map((row) => toTransactionRow(row, user));
  }

  let totalIncome = 0;
  let totalExpenses = 0;
  let lastTransactionDate: string | null = null;
  for (const transaction of ledger) {
    const amount = Number(transaction.amount ?? 0);
    if (transaction.type?.toLowerCase() === "income") totalIncome += amount;
    if (transaction.type?.toLowerCase() === "expense") totalExpenses += amount;
    const date = String(transaction.date);
    if (!lastTransactionDate || date > lastTransactionDate) {
      lastTransactionDate = date;
    }
  }

  const bannedUntil = authUser?.banned_until ?? null;

  return {
    profile: {
      id: userId,
      fullName,
      email,
      phone:
        (profile?.phone ? String(profile.phone) : null) ??
        authUser?.phone ??
        stringValue(metadata.phone),
      userType: profile?.user_type ? String(profile.user_type) : null,
      language:
        (profile?.language ? String(profile.language) : null) ??
        stringValue(metadata.language),
      darkMode: Boolean(profile?.dark_mode),
      imageUrl:
        (profile?.image_url ? String(profile.image_url) : null) ??
        stringValue(metadata.avatar_url),
      createdAt:
        (profile?.created_at ? String(profile.created_at) : null) ??
        authUser?.created_at ??
        null,
    },
    auth: authUser
      ? {
          createdAt: authUser.created_at,
          lastSignInAt: authUser.last_sign_in_at ?? null,
          emailConfirmedAt: authUser.email_confirmed_at ?? null,
          providers: [
            ...new Set(
              (authUser.identities ?? [])
                .map((identity) => identity.provider)
                .filter(Boolean),
            ),
          ],
          isBanned:
            bannedUntil !== null &&
            new Date(bannedUntil).getTime() > Date.now(),
          bannedUntil,
        }
      : null,
    accounts,
    summary: {
      totalTransactions: ledger.length,
      totalIncome,
      totalExpenses,
      netFlow: totalIncome - totalExpenses,
      lastTransactionDate,
    },
    recentTransactions,
  };
}

async function readFinancialDetails(userId: string) {
  const db = createAdminClient();
  const [accountsResult, recentResult, ledgerResult] = await Promise.all([
    db
      .from("accounts")
      .select(
        "id, name, account_type, amount, currency, description, is_default, balance_initialized_from_sms, balance_manually_edited, created_at, updated_at",
      )
      .eq("user_id", userId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true }),
    db
      .from("transactions")
      .select(TRANSACTION_COLUMNS)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(DETAIL_TRANSACTION_LIMIT),
    readUserLedger(userId),
  ]);
  return { accountsResult, recentResult, ledgerResult };
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readUserLedger(userId: string) {
  const db = createAdminClient();
  return fetchAllPages<Pick<TransactionRecord, "id" | "amount" | "date" | "type">>(
    (from, to) =>
      db
        .from("transactions")
        .select("id, amount, date, type")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("id")
        .range(from, to),
  );
}
