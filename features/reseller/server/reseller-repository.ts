import "server-only";
import type {
  CatalogBundle,
  CursorListParams,
  CursorPage,
  RechargeInput,
  RechargeResult,
  ResellerBundle,
  ResellerBusiness,
  ResellerCategory,
  ResellerProvider,
  ResellerTransaction,
} from "@/features/reseller/contracts";
import { compareBundlePricing } from "@/features/reseller/pricing";
import { listPriceOverridesByBundleIds } from "@/features/reseller/server/price-overrides";
import { toptayoFetch, toptayoPost } from "@/lib/toptayo/client";
import { createAdminClient } from "@/lib/supabase/admin";

export function listProviders(params: CursorListParams) {
  return toptayoFetch<CursorPage<ResellerProvider>>("/api/v1/providers", {
    q: params.q,
    cursor: params.cursor,
    limit: params.limit,
  });
}

export function listCategories(
  params: CursorListParams & { providerId?: string },
) {
  const path = params.providerId
    ? `/api/v1/providers/${params.providerId}/categories`
    : "/api/v1/categories";
  return toptayoFetch<CursorPage<ResellerCategory>>(path, {
    q: params.q,
    cursor: params.cursor,
    limit: params.limit,
  });
}

export async function listBundles(
  params: CursorListParams & { providerId?: string; categoryId?: string },
) {
  const path =
    params.providerId && params.categoryId
      ? `/api/v1/providers/${params.providerId}/categories/${params.categoryId}/bundles`
      : "/api/v1/bundles";
  const page = await toptayoFetch<CursorPage<ResellerBundle>>(path, {
    q: params.q,
    cursor: params.cursor,
    limit: params.limit,
  });
  return attachCatalogPricing(page);
}

async function attachCatalogPricing(
  page: CursorPage<ResellerBundle>,
): Promise<CursorPage<CatalogBundle>> {
  const bundles = Array.isArray(page.data) ? page.data : [];
  const overrides = await listPriceOverridesByBundleIds(
    bundles.map((bundle) => bundle.id),
  );

  return {
    ...page,
    data: bundles.map((bundle) => ({
      ...bundle,
      pricing: compareBundlePricing({
        liveAmount: bundle.amount,
        override: overrides.get(bundle.id) ?? null,
      }),
    })),
  };
}

export async function listTransactions(params: CursorListParams) {
  const page = await toptayoFetch<CursorPage<ResellerTransaction>>(
    "/api/v1/transactions",
    {
      q: params.q,
      cursor: params.cursor,
      limit: params.limit,
    },
  );
  const transactions = Array.isArray(page.data) ? page.data : [];
  return {
    ...page,
    data: await attachQoondeeyeOrders(transactions),
  };
}

export function getTransaction(id: string) {
  return toptayoFetch<ResellerTransaction>(
    `/api/v1/transactions/${encodeURIComponent(id)}`,
  );
}

export function getBusiness() {
  return toptayoFetch<ResellerBusiness>("/api/v1/businesses/me");
}

async function attachQoondeeyeOrders(
  transactions: ResellerTransaction[],
): Promise<ResellerTransaction[]> {
  const ids = transactions.map((row) => String(row.id)).filter((id) => id.length > 0);
  if (ids.length === 0) return transactions;
  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from("bundle_purchase_orders")
      .select("id, top_tayo_transaction_ids")
      .overlaps("top_tayo_transaction_ids", ids);
    if (error) {
      return transactions.map((row) => ({
        ...row,
        qoondeeyeOrderId: null,
        qoondeeyeOrderLookup: "unavailable" as const,
      }));
    }
    const byTransaction = new Map<string, string>();
    for (const row of (data ?? []) as Array<{ id: string; top_tayo_transaction_ids: string[] | null }>) {
      for (const transactionId of row.top_tayo_transaction_ids ?? []) {
        if (!byTransaction.has(transactionId)) byTransaction.set(transactionId, String(row.id));
      }
    }
    return transactions.map((row) => {
      const orderId = byTransaction.get(String(row.id)) ?? null;
      return {
        ...row,
        qoondeeyeOrderId: orderId,
        qoondeeyeOrderLookup: orderId ? ("matched" as const) : ("none" as const),
      };
    });
  } catch {
    return transactions.map((row) => ({
      ...row,
      qoondeeyeOrderId: null,
      qoondeeyeOrderLookup: "unavailable" as const,
    }));
  }
}

export function createRecharge(input: RechargeInput) {
  return toptayoPost<RechargeResult>("/api/v1/recharge", {
    sender: input.sender,
    receiver: input.receiver,
    bundleId: input.bundleId,
  });
}
