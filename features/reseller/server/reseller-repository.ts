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

export function listTransactions(params: CursorListParams) {
  return toptayoFetch<CursorPage<ResellerTransaction>>(
    "/api/v1/transactions",
    {
      q: params.q,
      cursor: params.cursor,
      limit: params.limit,
    },
  );
}

export function getTransaction(id: string) {
  return toptayoFetch<ResellerTransaction>(
    `/api/v1/transactions/${encodeURIComponent(id)}`,
  );
}

export function getBusiness() {
  return toptayoFetch<ResellerBusiness>("/api/v1/businesses/me");
}

export function createRecharge(input: RechargeInput) {
  return toptayoPost<RechargeResult>("/api/v1/recharge", {
    sender: input.sender,
    receiver: input.receiver,
    bundleId: input.bundleId,
  });
}
