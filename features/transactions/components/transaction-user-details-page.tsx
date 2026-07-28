import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpDown,
  BadgeDollarSign,
  CalendarClock,
  CircleUserRound,
  Landmark,
  ReceiptText,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { PageHeading } from "@/components/dashboard/PageHeading";
import { StatTile } from "@/components/dashboard/StatTile";
import { StatePanel } from "@/components/states/StatePanel";
import type {
  TransactionRow,
  TransactionUserDetails,
} from "@/features/transactions/contracts";
import {
  formatDate,
  formatDateTime,
  formatInteger,
} from "@/lib/formatters";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function TransactionUserDetailsPage({
  details,
  showFinancialDetails,
}: {
  details: TransactionUserDetails;
  showFinancialDetails: boolean;
}) {
  const { profile, auth, accounts, summary, recentTransactions } = details;
  const displayName = profile.fullName ?? profile.email;

  return (
    <div className="flex flex-col gap-6 lg:gap-7">
      <PageHeading
        eyebrow="Transaction user"
        title={displayName}
        description="Profile, authentication, account, and transaction information for this user."
        actions={
          <Link
            href="/dashboard/transactions"
            className="inline-flex min-h-10 items-center gap-2 rounded-md border bg-card px-3 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/10 hover:text-primary"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Back to transactions
          </Link>
        }
      />

      {showFinancialDetails ? (
        <section aria-labelledby="user-transaction-summary">
          <h2 id="user-transaction-summary" className="sr-only">
            User transaction summary
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              icon={ReceiptText}
              label="Transactions"
              value={formatInteger.format(summary.totalTransactions)}
              sublabel={
                summary.lastTransactionDate
                  ? `Last activity ${formatDate(summary.lastTransactionDate)}`
                  : "No transaction activity"
              }
            />
            <StatTile
              icon={BadgeDollarSign}
              label="Total income"
              value={usd.format(summary.totalIncome)}
              sublabel="All recorded income"
            />
            <StatTile
              icon={ArrowUpDown}
              label="Total expenses"
              value={usd.format(summary.totalExpenses)}
              sublabel="All recorded expenses"
            />
            <StatTile
              icon={WalletCards}
              label="Net flow"
              value={usd.format(summary.netFlow)}
              sublabel="Income minus expenses"
            />
          </div>
        </section>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <InfoCard
          icon={CircleUserRound}
          title="Profile information"
          description="Information stored in the user profile."
        >
          <DetailGrid>
            <DetailField label="Full name" value={profile.fullName ?? "Not set"} />
            <DetailField label="Email" value={profile.email} />
            <DetailField label="Phone" value={profile.phone ?? "Not set"} />
            <DetailField
              label="User type"
              value={profile.userType ? formatLabel(profile.userType) : "Not set"}
            />
            <DetailField
              label="Language"
              value={profile.language?.toUpperCase() ?? "Not set"}
            />
            <DetailField
              label="Theme"
              value={profile.darkMode ? "Dark mode" : "Light mode"}
            />
            <DetailField
              label="Joined"
              value={formatDateTime(profile.createdAt)}
            />
            <DetailField label="User ID" value={profile.id} mono />
          </DetailGrid>
        </InfoCard>

        <InfoCard
          icon={ShieldCheck}
          title="Authentication"
          description="Supabase authentication and access status."
        >
          {auth ? (
            <DetailGrid>
              <DetailField
                label="Status"
                value={auth.isBanned ? "Disabled" : "Active"}
                tone={auth.isBanned ? "critical" : "success"}
              />
              <DetailField
                label="Email"
                value={auth.emailConfirmedAt ? "Confirmed" : "Not confirmed"}
              />
              <DetailField
                label="Providers"
                value={
                  auth.providers.length
                    ? auth.providers.map(formatLabel).join(", ")
                    : "Email"
                }
              />
              <DetailField
                label="Last sign-in"
                value={
                  auth.lastSignInAt
                    ? formatDateTime(auth.lastSignInAt)
                    : "Never"
                }
              />
              <DetailField
                label="Auth created"
                value={formatDateTime(auth.createdAt)}
              />
              <DetailField
                label="Disabled until"
                value={
                  auth.bannedUntil
                    ? formatDateTime(auth.bannedUntil)
                    : "Not disabled"
                }
              />
            </DetailGrid>
          ) : (
            <StatePanel
              compact
              title="Authentication record unavailable"
              description="A profile exists, but its Supabase Auth record could not be loaded."
            />
          )}
        </InfoCard>
      </div>

      {showFinancialDetails ? (
        <>
          <section
            className="overflow-hidden rounded-lg border bg-card"
            aria-labelledby="user-accounts-title"
          >
            <SectionHeader
              icon={Landmark}
              title="Financial accounts"
              description={`${formatInteger.format(accounts.length)} linked account${accounts.length === 1 ? "" : "s"}`}
              id="user-accounts-title"
            />
            <div className="p-4 sm:p-5">
              {accounts.length ? (
            <div className="overflow-auto rounded-md border">
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead>
                  <tr className="border-b bg-[hsl(var(--surface-table-head))] text-muted-foreground">
                    <th className="px-3 py-2.5 font-medium" scope="col">
                      Account
                    </th>
                    <th className="px-3 py-2.5 font-medium" scope="col">
                      Type
                    </th>
                    <th className="px-3 py-2.5 text-right font-medium" scope="col">
                      Balance
                    </th>
                    <th className="px-3 py-2.5 font-medium" scope="col">
                      Source
                    </th>
                    <th className="px-3 py-2.5 font-medium" scope="col">
                      Updated
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((account, index) => (
                    <tr
                      key={account.id}
                      className={`border-b last:border-0 ${
                        index % 2 === 1
                          ? "bg-[hsl(var(--surface-table-row-alt))]"
                          : ""
                      }`}
                    >
                      <td className="px-3 py-3">
                        <p className="font-medium">
                          {account.name}
                          {account.isDefault ? (
                            <span className="ml-2 rounded-full bg-info-muted px-2 py-0.5 text-[9px] font-medium text-info">
                              Default
                            </span>
                          ) : null}
                        </p>
                        {account.description ? (
                          <p className="mt-0.5 max-w-72 truncate text-[11px] text-muted-foreground">
                            {account.description}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-3 py-3">
                        {formatLabel(account.accountType)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-medium tabular-nums">
                        {formatMoney(account.amount, account.currency)}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">
                        {account.balanceInitializedFromSms
                          ? "SMS"
                          : account.balanceManuallyEdited
                            ? "Manually edited"
                            : "App"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">
                        {formatDateTime(account.updatedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
              ) : (
                <StatePanel
                  compact
                  title="No financial accounts"
                  description="This user has not created or connected an account."
                />
              )}
            </div>
          </section>

          <section
            className="overflow-hidden rounded-lg border bg-card"
            aria-labelledby="recent-user-transactions-title"
          >
            <SectionHeader
              icon={CalendarClock}
              title="Recent transactions"
              description={`Latest ${formatInteger.format(recentTransactions.length)} of ${formatInteger.format(summary.totalTransactions)} records`}
              id="recent-user-transactions-title"
            />
            <div className="p-4 sm:p-5">
              {recentTransactions.length ? (
                <RecentTransactionsTable rows={recentTransactions} />
              ) : (
                <StatePanel
                  compact
                  title="No transactions"
                  description="This user does not have any transaction records."
                />
              )}
            </div>
          </section>
        </>
      ) : (
        <div className="rounded-lg border bg-muted/30 p-4 text-xs leading-5 text-muted-foreground">
          Financial accounts and individual transaction history require
          administrator permission.
        </div>
      )}
    </div>
  );
}

function InfoCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof CircleUserRound;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const titleId = `${title.toLowerCase().replace(/\s+/g, "-")}-title`;
  return (
    <section
      className="overflow-hidden rounded-lg border bg-card"
      aria-labelledby={titleId}
    >
      <SectionHeader
        icon={Icon}
        title={title}
        description={description}
        id={titleId}
      />
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  description,
  id,
}: {
  icon: typeof CircleUserRound;
  title: string;
  description: string;
  id: string;
}) {
  return (
    <div className="flex items-start gap-3 border-b p-4 sm:px-5">
      <span className="grid size-8 shrink-0 place-items-center rounded-md border bg-background text-primary">
        <Icon aria-hidden="true" className="size-4" />
      </span>
      <div>
        <h2 id={id} className="text-sm font-semibold">
          {title}
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function DetailGrid({ children }: { children: React.ReactNode }) {
  return <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</dl>;
}

function DetailField({
  label,
  value,
  mono = false,
  tone,
}: {
  label: string;
  value: string;
  mono?: boolean;
  tone?: "success" | "critical";
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </dt>
      <dd
        className={`mt-1 break-words text-xs ${
          mono ? "font-mono text-[11px]" : "font-medium"
        } ${
          tone === "success"
            ? "text-success"
            : tone === "critical"
              ? "text-critical"
              : "text-foreground"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function RecentTransactionsTable({ rows }: { rows: TransactionRow[] }) {
  return (
    <div className="max-h-[32rem] overflow-auto rounded-md border">
      <table className="w-full min-w-[780px] text-left text-xs">
        <thead className="sticky top-0 z-10">
          <tr className="border-b bg-[hsl(var(--surface-table-head))] text-muted-foreground">
            <th className="px-3 py-2.5 font-medium" scope="col">
              Date
            </th>
            <th className="px-3 py-2.5 font-medium" scope="col">
              Description
            </th>
            <th className="px-3 py-2.5 font-medium" scope="col">
              Category
            </th>
            <th className="px-3 py-2.5 font-medium" scope="col">
              Type
            </th>
            <th className="px-3 py-2.5 text-right font-medium" scope="col">
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={row.id}
              className={`border-b last:border-0 ${
                index % 2 === 1
                  ? "bg-[hsl(var(--surface-table-row-alt))]"
                  : ""
              }`}
            >
              <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">
                {formatDate(row.date)}
              </td>
              <td
                className="max-w-72 truncate px-3 py-3"
                title={row.description ?? undefined}
              >
                {row.description ?? "—"}
              </td>
              <td className="max-w-48 truncate px-3 py-3">
                {row.category ? formatLabel(row.category) : "Uncategorized"}
              </td>
              <td className="px-3 py-3">
                <span className={transactionTypeClass(row.type)}>
                  {formatLabel(row.type)}
                </span>
              </td>
              <td className="whitespace-nowrap px-3 py-3 text-right font-medium tabular-nums">
                {usd.format(row.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function transactionTypeClass(type: string) {
  const normalized = type.toLowerCase();
  const tone =
    normalized === "income"
      ? "bg-success-muted text-success"
      : normalized === "expense"
        ? "bg-critical-muted text-critical"
        : "bg-warning-muted text-warning";
  return `inline-flex rounded-full px-2 py-1 text-[10px] font-medium ${tone}`;
}

function formatMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

function formatLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
