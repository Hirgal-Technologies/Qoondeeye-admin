"use client";

import Image from "next/image";
import {
  Boxes,
  CheckCircle2,
  ChevronRight,
  Layers3,
  Loader2,
  Phone,
  Receipt,
  RefreshCw,
  Search,
  Signal,
  Smartphone,
  TriangleAlert,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { PageHeading } from "@/components/dashboard/PageHeading";
import { StatePanel } from "@/components/states/StatePanel";
import type {
  RechargeResult,
  ResellerBundle,
  ResellerBusiness,
  ResellerCategory,
  ResellerProvider,
  ResellerTransaction,
} from "@/features/reseller/contracts";
import { formatDateTime } from "@/lib/formatters";
import { useApiData } from "@/lib/hooks/useApiData";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

type Envelope<T> = { data: T | null; error: string | null };

async function fetchEnvelope<T>(url: string): Promise<Envelope<T>> {
  try {
    const response = await fetch(url);
    const body = (await response
      .json()
      .catch(() => ({ data: null, error: "invalid response" }))) as Envelope<T>;
    if (!response.ok || body.error) {
      return { data: null, error: body.error ?? "request failed" };
    }
    return body;
  } catch {
    return { data: null, error: "network error" };
  }
}

type CursorPage<T> = { data: T[]; nextCursor: string | null };

type CursorListState<T> = {
  items: T[];
  status: "loading" | "success" | "error" | "loading-more";
  error: string | null;
  nextCursor: string | null;
};

const EMPTY_LIST_STATE: CursorListState<unknown> = {
  items: [],
  status: "loading",
  error: null,
  nextCursor: null,
};

/** Accumulates a TopTayo cursor-paginated list, resetting whenever the base URL's filters change. */
function useCursorList<T>(baseUrl: string): CursorListState<T> & {
  loadMore: () => void;
} {
  const [url, setUrl] = useState(baseUrl);
  const [state, setState] = useState<CursorListState<T>>(
    EMPTY_LIST_STATE as CursorListState<T>,
  );
  const requestId = useRef(0);

  // Render-phase reset: when the URL (filters) changes, show the loading
  // state immediately instead of stale items from the previous filter.
  if (url !== baseUrl) {
    setUrl(baseUrl);
    setState(EMPTY_LIST_STATE as CursorListState<T>);
  }

  useEffect(() => {
    const id = ++requestId.current;
    fetchEnvelope<CursorPage<T>>(baseUrl).then((outcome) => {
      if (requestId.current !== id) return;
      if (outcome.error || !outcome.data) {
        setState({
          items: [],
          status: "error",
          error: outcome.error ?? "request failed",
          nextCursor: null,
        });
        return;
      }
      setState({
        items: outcome.data.data,
        status: "success",
        error: null,
        nextCursor: outcome.data.nextCursor,
      });
    });
  }, [baseUrl]);

  function loadMore() {
    setState((current) => {
      if (!current.nextCursor || current.status === "loading-more") {
        return current;
      }
      const id = ++requestId.current;
      const separator = baseUrl.includes("?") ? "&" : "?";
      fetchEnvelope<CursorPage<T>>(
        `${baseUrl}${separator}cursor=${encodeURIComponent(current.nextCursor)}`,
      ).then((outcome) => {
        if (requestId.current !== id) return;
        if (outcome.error || !outcome.data) {
          setState((previous) => ({
            ...previous,
            status: "error",
            error: outcome.error ?? "request failed",
          }));
          return;
        }
        setState((previous) => ({
          items: [...previous.items, ...outcome.data!.data],
          status: "success",
          error: null,
          nextCursor: outcome.data!.nextCursor,
        }));
      });
      return { ...current, status: "loading-more" };
    });
  }

  return { ...state, loadMore };
}

export function ResellerPage({
  hasSupportRole,
  hasAdminRole,
}: {
  hasSupportRole: boolean;
  hasAdminRole: boolean;
}) {
  if (!hasSupportRole) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeading
          eyebrow="TopTayo integration"
          title="Reseller catalog"
          description="Browse TopTayo providers, bundles, and airtime top-up transactions."
        />
        <StatePanel
          kind="permission"
          title="Support permission required"
          description="Your current role can view aggregate analytics, but not the reseller catalog."
        />
      </div>
    );
  }

  return <AuthorizedResellerPage hasAdminRole={hasAdminRole} />;
}

function AuthorizedResellerPage({ hasAdminRole }: { hasAdminRole: boolean }) {
  const [tab, setTab] = useState<"catalog" | "transactions">("catalog");
  const [rechargeBundle, setRechargeBundle] = useState<ResellerBundle | null>(
    null,
  );

  return (
    <div className="flex flex-col gap-6 lg:gap-7">
      <PageHeading
        eyebrow="TopTayo integration"
        title="Reseller catalog"
        description="Browse TopTayo providers, bundles, and airtime top-up transactions from the live reseller API."
      />

      <BusinessHero />

      <div
        role="tablist"
        aria-label="Reseller sections"
        className="inline-flex w-fit gap-1 rounded-lg border bg-muted/30 p-1"
      >
        <TabButton
          active={tab === "catalog"}
          icon={Boxes}
          label="Providers & bundles"
          onClick={() => setTab("catalog")}
        />
        <TabButton
          active={tab === "transactions"}
          icon={Receipt}
          label="Transactions"
          onClick={() => setTab("transactions")}
        />
      </div>

      {tab === "catalog" ? (
        <CatalogExplorer
          canRecharge={hasAdminRole}
          onRecharge={setRechargeBundle}
        />
      ) : null}
      {tab === "transactions" ? (
        hasAdminRole ? (
          <TransactionsPanel />
        ) : (
          <StatePanel
            kind="permission"
            title="Administrator permission required"
            description="Reseller transaction records include sender and receiver phone numbers and are limited to administrators."
          />
        )
      ) : null}

      {rechargeBundle ? (
        <RechargeModal
          bundle={rechargeBundle}
          onClose={() => setRechargeBundle(null)}
        />
      ) : null}
    </div>
  );
}

function TabButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof Boxes;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`inline-flex h-9 items-center gap-2 rounded-md px-3.5 text-xs font-medium transition-colors ${
        active
          ? "gradient-button text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:bg-background hover:text-foreground"
      }`}
    >
      <Icon aria-hidden="true" className="size-3.5" />
      {label}
    </button>
  );
}

const LOW_BALANCE_THRESHOLD_USD = 25;

function BusinessHero() {
  const result = useApiData<ResellerBusiness>("/api/resellers/business");
  const notifiedBalanceRef = useRef<number | null>(null);

  const business = result.status === "success" ? result.data : null;
  const balance = business ? Number(business.balance.replace(/,/g, "")) : null;
  const isLowBalance = balance !== null && balance < LOW_BALANCE_THRESHOLD_USD;

  useEffect(() => {
    if (!isLowBalance || balance === null) return;
    // Only fire the OS notification once per distinct low balance reading,
    // not on every re-render or poll while it stays at the same value.
    if (notifiedBalanceRef.current === balance) return;
    notifiedBalanceRef.current = balance;

    if (typeof window === "undefined" || !("Notification" in window)) return;
    const send = () =>
      new Notification("Low TopTayo balance", {
        body: `Your reseller balance is ${currency.format(balance)}, below the $${LOW_BALANCE_THRESHOLD_USD} threshold. Top up to avoid failed recharges.`,
      });

    if (Notification.permission === "granted") {
      send();
    } else if (Notification.permission === "default") {
      Notification.requestPermission().then((permission) => {
        if (permission === "granted") send();
      });
    }
  }, [isLowBalance, balance]);

  if (result.status === "error") {
    return (
      <StatePanel
        compact
        kind="error"
        title="TopTayo account details unavailable"
        description={result.error}
        actionLabel="Retry"
        onAction={result.retry}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <section className="gradient-kpi relative overflow-hidden rounded-lg border p-5 shadow-[var(--shadow-card)] sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-xl border bg-card text-primary">
              <Wallet aria-hidden="true" className="size-6" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {business
                  ? business.name
                  : result.status === "loading"
                    ? "Loading account…"
                    : "TopTayo balance"}
              </p>
              {result.status === "loading" ? (
                <div className="mt-2 skeleton h-8 w-40 rounded" />
              ) : (
                <p
                  className={`mt-0.5 text-3xl font-semibold tracking-tight tabular-nums ${
                    isLowBalance ? "text-destructive" : "text-foreground"
                  }`}
                >
                  {business
                    ? currency.format(
                        Number(business.balance.replace(/,/g, "")),
                      )
                    : "—"}
                </p>
              )}
            </div>
          </div>

          {business ? (
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs sm:flex sm:items-center sm:gap-6">
              <HeroField label="Email" value={business.email} />
              <HeroField label="Mobile" value={String(business.mobile)} />
              <HeroField
                label="Member since"
                value={formatDateTime(business.createdAt)}
              />
            </div>
          ) : null}
        </div>
      </section>

      {isLowBalance && balance !== null ? (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/35 bg-destructive/5 p-4">
          <TriangleAlert
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-destructive"
          />
          <div>
            <p className="text-xs font-medium text-destructive">
              Low TopTayo balance — {currency.format(balance)} remaining
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              The account balance is below the ${LOW_BALANCE_THRESHOLD_USD}{" "}
              threshold. Top up soon to avoid failed recharges.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function HeroField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 truncate font-medium text-foreground">{value}</p>
    </div>
  );
}

function CatalogExplorer({
  canRecharge,
  onRecharge,
}: {
  canRecharge: boolean;
  onRecharge: (bundle: ResellerBundle) => void;
}) {
  const [provider, setProvider] = useState<ResellerProvider | null>(null);
  const [category, setCategory] = useState<ResellerCategory | null>(null);
  const [draftSearch, setDraftSearch] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(draftSearch.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [draftSearch]);

  function reset(level: "providers" | "provider" | "category") {
    setDraftSearch("");
    setSearch("");
    if (level === "providers") {
      setProvider(null);
      setCategory(null);
    } else if (level === "provider") {
      setCategory(null);
    }
  }

  const placeholder = !provider
    ? "Search providers…"
    : !category
      ? "Search categories…"
      : "Search bundles…";

  return (
    <section className="overflow-hidden rounded-lg border bg-card">
      <div className="flex flex-col gap-4 border-b p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <nav
          aria-label="Breadcrumb"
          className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs"
        >
          <Crumb
            label="All providers"
            active={!provider}
            onClick={() => reset("providers")}
          />
          {provider ? (
            <>
              <ChevronRight
                aria-hidden="true"
                className="size-3.5 shrink-0 text-muted-foreground"
              />
              <Crumb
                label={provider.name}
                active={!!provider && !category}
                onClick={() => reset("provider")}
              />
            </>
          ) : null}
          {category ? (
            <>
              <ChevronRight
                aria-hidden="true"
                className="size-3.5 shrink-0 text-muted-foreground"
              />
              <Crumb label={category.name} active onClick={() => {}} />
            </>
          ) : null}
        </nav>

        <span className="relative block sm:w-64">
          <Search
            aria-hidden="true"
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            value={draftSearch}
            onChange={(event) => setDraftSearch(event.target.value)}
            placeholder={placeholder}
            className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/15"
          />
        </span>
      </div>

      <div className="p-4 sm:p-5">
        {!provider ? (
          <ProviderGrid
            search={search}
            onSelect={(next) => {
              setProvider(next);
              setDraftSearch("");
              setSearch("");
            }}
          />
        ) : !category ? (
          <CategoryGrid
            providerId={provider.id}
            search={search}
            onSelect={(next) => {
              setCategory(next);
              setDraftSearch("");
              setSearch("");
            }}
          />
        ) : (
          <BundleGrid
            providerId={provider.id}
            categoryId={category.id}
            search={search}
            canRecharge={canRecharge}
            onRecharge={onRecharge}
          />
        )}
      </div>
    </section>
  );
}

function Crumb({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={active}
      className={`truncate rounded-sm px-1 py-0.5 ${
        active
          ? "font-semibold text-foreground"
          : "text-muted-foreground hover:text-primary"
      }`}
    >
      {label}
    </button>
  );
}

function ProviderGrid({
  search,
  onSelect,
}: {
  search: string;
  onSelect: (provider: ResellerProvider) => void;
}) {
  const url = useMemo(() => {
    const params = new URLSearchParams({ limit: "24" });
    if (search) params.set("q", search);
    return `/api/resellers/providers?${params.toString()}`;
  }, [search]);
  const list = useCursorList<ResellerProvider>(url);

  if (list.status === "loading") return <CardGridSkeleton />;
  if (list.status === "error") {
    return (
      <StatePanel
        compact
        kind="error"
        title="Providers could not be loaded"
        description={list.error ?? "Something went wrong."}
      />
    );
  }
  if (list.items.length === 0) {
    return (
      <StatePanel
        compact
        title="No providers found"
        description="Try a different search term."
      />
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {list.items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item)}
            className="group flex items-start gap-3 rounded-lg border bg-background p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[var(--shadow-card)]"
          >
            <span className="relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-md border bg-card">
              <Image
                src={item.image}
                alt=""
                fill
                sizes="44px"
                className="object-contain p-1.5"
                unoptimized
              />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground group-hover:text-primary">
                {item.name}
              </p>
              <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-muted-foreground">
                {item.description}
              </p>
            </div>
            <ChevronRight
              aria-hidden="true"
              className="ml-auto size-4 shrink-0 self-center text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
            />
          </button>
        ))}
      </div>
      <LoadMore list={list} />
    </>
  );
}

function CategoryGrid({
  providerId,
  search,
  onSelect,
}: {
  providerId: string;
  search: string;
  onSelect: (category: ResellerCategory) => void;
}) {
  const url = useMemo(() => {
    const params = new URLSearchParams({ limit: "24", providerId });
    if (search) params.set("q", search);
    return `/api/resellers/categories?${params.toString()}`;
  }, [providerId, search]);
  const list = useCursorList<ResellerCategory>(url);

  if (list.status === "loading") return <CardGridSkeleton />;
  if (list.status === "error") {
    return (
      <StatePanel
        compact
        kind="error"
        title="Categories could not be loaded"
        description={list.error ?? "Something went wrong."}
      />
    );
  }
  if (list.items.length === 0) {
    return (
      <StatePanel
        compact
        title="No categories found"
        description="This provider has no matching bundle categories."
      />
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {list.items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item)}
            className="group flex items-start gap-3 rounded-lg border bg-background p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[var(--shadow-card)]"
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-md border bg-primary/10 text-primary">
              <Layers3 aria-hidden="true" className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground group-hover:text-primary">
                {item.name}
              </p>
              <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-muted-foreground">
                {item.description || "—"}
              </p>
            </div>
            <ChevronRight
              aria-hidden="true"
              className="ml-auto size-4 shrink-0 self-center text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
            />
          </button>
        ))}
      </div>
      <LoadMore list={list} />
    </>
  );
}

function BundleGrid({
  providerId,
  categoryId,
  search,
  canRecharge,
  onRecharge,
}: {
  providerId: string;
  categoryId: string;
  search: string;
  canRecharge: boolean;
  onRecharge: (bundle: ResellerBundle) => void;
}) {
  const url = useMemo(() => {
    const params = new URLSearchParams({ limit: "24", providerId, categoryId });
    if (search) params.set("q", search);
    return `/api/resellers/bundles?${params.toString()}`;
  }, [providerId, categoryId, search]);
  const list = useCursorList<ResellerBundle>(url);

  if (list.status === "loading") return <CardGridSkeleton />;
  if (list.status === "error") {
    return (
      <StatePanel
        compact
        kind="error"
        title="Bundles could not be loaded"
        description={list.error ?? "Something went wrong."}
      />
    );
  }
  if (list.items.length === 0) {
    return (
      <StatePanel
        compact
        title="No bundles found"
        description="This category has no matching bundles."
      />
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {list.items.map((bundle) => (
          <BundleCard
            key={bundle.id}
            bundle={bundle}
            canRecharge={canRecharge}
            onRecharge={onRecharge}
          />
        ))}
      </div>
      <LoadMore list={list} />
    </>
  );
}

function BundleCard({
  bundle,
  canRecharge,
  onRecharge,
}: {
  bundle: ResellerBundle;
  canRecharge: boolean;
  onRecharge: (bundle: ResellerBundle) => void;
}) {
  const specs = bundleSpecs(bundle);
  return (
    <article className="gradient-surface flex flex-col rounded-lg border p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold leading-5 text-foreground">
          {bundle.name}
        </p>
        <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
          {currency.format(Number(bundle.amount))}
        </span>
      </div>
      {bundle.description ? (
        <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
          {bundle.description}
        </p>
      ) : null}
      <div className="mt-3 flex flex-1 flex-wrap items-center gap-1.5">
        {specs.map((spec) => (
          <span
            key={spec.label}
            className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-[10px] font-medium text-muted-foreground"
          >
            <spec.icon aria-hidden="true" className="size-3" />
            {spec.label}
          </span>
        ))}
      </div>
      <p className="mt-3 border-t pt-2.5 text-[10px] text-muted-foreground">
        Valid {bundle.validity} {bundle.validityType.toLowerCase()}
        {bundle.validity === 1 ? "" : "s"}
      </p>
      {canRecharge ? (
        <button
          type="button"
          onClick={() => onRecharge(bundle)}
          className="gradient-button mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-md text-xs font-medium text-primary-foreground"
        >
          <Zap aria-hidden="true" className="size-3.5" />
          Recharge
        </button>
      ) : null}
    </article>
  );
}

function bundleSpecs(bundle: ResellerBundle) {
  const specs: { label: string; icon: typeof Signal }[] = [];
  if (bundle.dataGb)
    specs.push({ label: `${bundle.dataGb} GB data`, icon: Signal });
  else if (bundle.dataMb)
    specs.push({ label: `${bundle.dataMb} MB data`, icon: Signal });
  if (bundle.minutes)
    specs.push({ label: `${bundle.minutes} min`, icon: Phone });
  else if (bundle.minutesInt)
    specs.push({ label: `${bundle.minutesInt} min`, icon: Phone });
  if (bundle.sms) specs.push({ label: `${bundle.sms} SMS`, icon: Smartphone });
  if (specs.length === 0) specs.push({ label: "Custom bundle", icon: Boxes });
  return specs;
}

function LoadMore<T>({
  list,
}: {
  list: CursorListState<T> & { loadMore: () => void };
}) {
  if (!list.nextCursor) return null;
  return (
    <div className="mt-4 flex justify-center">
      <button
        type="button"
        onClick={list.loadMore}
        disabled={list.status === "loading-more"}
        className="inline-flex h-9 items-center gap-2 rounded-md border bg-background px-4 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/10 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
      >
        {list.status === "loading-more" ? (
          <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
        ) : (
          <RefreshCw aria-hidden="true" className="size-3.5" />
        )}
        {list.status === "loading-more" ? "Loading…" : "Load more"}
      </button>
    </div>
  );
}

function CardGridSkeleton() {
  return (
    <div
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      aria-label="Loading"
    >
      {[0, 1, 2, 3, 4, 5, 6, 7].map((row) => (
        <div className="skeleton h-24 rounded-lg" key={row} />
      ))}
    </div>
  );
}

function TransactionsPanel() {
  const [draftSearch, setDraftSearch] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(draftSearch.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [draftSearch]);

  const url = useMemo(() => {
    const params = new URLSearchParams({ limit: "25" });
    if (search) params.set("q", search);
    return `/api/resellers/transactions?${params.toString()}`;
  }, [search]);
  const list = useCursorList<ResellerTransaction>(url);

  return (
    <section className="overflow-hidden rounded-lg border bg-card">
      <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <h2 className="text-sm font-semibold">Top-up transactions</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Live TopTayo reseller ledger
          </p>
        </div>
        <span className="relative block sm:w-64">
          <Search
            aria-hidden="true"
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            value={draftSearch}
            onChange={(event) => setDraftSearch(event.target.value)}
            placeholder="Search transactions…"
            className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/15"
          />
        </span>
      </div>

      <div className="p-4 sm:p-5">
        {list.status === "loading" ? <TransactionsTableSkeleton /> : null}
        {list.status === "error" ? (
          <StatePanel
            compact
            kind="error"
            title="Transactions could not be loaded"
            description={list.error ?? "Something went wrong."}
          />
        ) : null}
        {list.status !== "loading" &&
        list.status !== "error" &&
        list.items.length === 0 ? (
          <StatePanel
            compact
            title="No transactions found"
            description="Try a different search term."
          />
        ) : null}
        {list.items.length > 0 ? (
          <>
            <div className="max-h-[38rem] overflow-auto rounded-md border">
              <table className="w-full min-w-[880px] text-left text-xs">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b bg-[hsl(var(--surface-table-head))] text-muted-foreground">
                    <th scope="col" className="px-3 py-2.5 font-medium">
                      Date
                    </th>
                    <th scope="col" className="px-3 py-2.5 font-medium">
                      Sender
                    </th>
                    <th scope="col" className="px-3 py-2.5 font-medium">
                      Receiver
                    </th>
                    <th scope="col" className="px-3 py-2.5 font-medium">
                      Bundle
                    </th>
                    <th scope="col" className="px-3 py-2.5 font-medium">
                      Provider
                    </th>
                    <th scope="col" className="px-3 py-2.5 font-medium">
                      Status
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2.5 text-right font-medium"
                    >
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {list.items.map((row, index) => (
                    <tr
                      key={row.id}
                      className={`border-b transition-colors last:border-0 hover:bg-[hsl(var(--surface-table-hover))] ${
                        index % 2 === 1
                          ? "bg-[hsl(var(--surface-table-row-alt))]"
                          : ""
                      }`}
                    >
                      <td className="whitespace-nowrap px-3 py-3 tabular-nums text-muted-foreground">
                        {formatDateTime(row.createdAt)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 font-mono tabular-nums">
                        {row.sender}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 font-mono tabular-nums">
                        {row.receiver}
                      </td>
                      <td className="max-w-52 px-3 py-3">
                        <p className="truncate font-medium">
                          {row.bundle?.name ?? "—"}
                        </p>
                        <p className="truncate text-[10px] text-muted-foreground">
                          {row.bundle?.category?.name}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        {row.bundle?.category?.provider?.name ?? "—"}
                      </td>
                      <td className="px-3 py-3">
                        <TransactionStatusBadge status={row.status} />
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-medium tabular-nums">
                        {currency.format(Number(row.amount))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <LoadMore list={list} />
          </>
        ) : null}
      </div>
    </section>
  );
}

function TransactionStatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const classes =
    normalized === "success" || normalized === "completed"
      ? "bg-success-muted text-success"
      : normalized === "failed" || normalized === "cancelled"
        ? "bg-critical-muted text-critical"
        : "bg-warning-muted text-warning";
  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-[10px] font-medium capitalize ${classes}`}
    >
      {status.toLowerCase()}
    </span>
  );
}

function TransactionsTableSkeleton() {
  return (
    <div className="space-y-2" aria-label="Loading transactions">
      {[0, 1, 2, 3, 4, 5].map((row) => (
        <div className="skeleton h-12 rounded-md" key={row} />
      ))}
    </div>
  );
}

function RechargeModal({
  bundle,
  onClose,
}: {
  bundle: ResellerBundle;
  onClose: () => void;
}) {
  const [sender, setSender] = useState("612673277");
  const [receiver, setReceiver] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RechargeResult | null>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const response = await fetch("/api/resellers/recharge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: Number(sender),
        receiver: Number(receiver),
        bundleId: bundle.id,
      }),
    }).catch(() => null);

    const body = await response?.json().catch(() => ({
      data: null,
      error: "The server returned an invalid response.",
    }));
    setSubmitting(false);

    if (!response || !response.ok || body.error) {
      setError(
        typeof body?.error === "string"
          ? body.error
          : "The recharge could not be completed.",
      );
      return;
    }

    setResult(body.data as RechargeResult);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="recharge-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-lg border bg-card p-5 shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-primary">
              Recharge
            </p>
            <h2
              id="recharge-modal-title"
              className="mt-0.5 text-sm font-semibold"
            >
              {bundle.name}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {currency.format(Number(bundle.amount))} · valid {bundle.validity}{" "}
              {bundle.validityType.toLowerCase()}
              {bundle.validity === 1 ? "" : "s"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>

        {result ? (
          <div className="mt-5">
            <div className="flex items-center gap-2 rounded-md border border-success/25 bg-success-muted px-3 py-2.5 text-xs font-medium text-success">
              <CheckCircle2 aria-hidden="true" className="size-4 shrink-0" />
              {result.message}
            </div>
            {result.transactionIds.length > 0 ? (
              <div className="mt-3 rounded-md border bg-background p-3">
                <p className="text-[11px] font-medium text-muted-foreground">
                  Transaction ID
                </p>
                {result.transactionIds.map((id) => (
                  <p key={id} className="mt-1 break-all font-mono text-xs">
                    {id}
                  </p>
                ))}
              </div>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="gradient-button mt-4 inline-flex h-10 w-full items-center justify-center rounded-md text-sm font-medium text-primary-foreground"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <label>
                <span className="mb-1.5 block text-[11px] font-medium text-muted-foreground">
                  Sender mobile
                </span>
                <input
                  required
                  inputMode="numeric"
                  pattern="[0-9]+"
                  value={sender}
                  onChange={(event) => setSender(event.target.value)}
                  placeholder="252615301507"
                  className="h-10 w-full rounded-md border bg-background px-3 font-mono text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/15"
                />
              </label>
              <label>
                <span className="mb-1.5 block text-[11px] font-medium text-muted-foreground">
                  Receiver mobile
                </span>
                <input
                  required
                  inputMode="numeric"
                  pattern="[0-9]+"
                  value={receiver}
                  onChange={(event) => setReceiver(event.target.value)}
                  placeholder="252770022200"
                  className="h-10 w-full rounded-md border bg-background px-3 font-mono text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/15"
                />
              </label>
            </div>

            {error ? (
              <p className="text-xs text-destructive" role="alert">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="gradient-button inline-flex h-10 w-full items-center justify-center gap-2 rounded-md text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              ) : (
                <Zap aria-hidden="true" className="size-4" />
              )}
              {submitting ? "Sending…" : "Send recharge"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
