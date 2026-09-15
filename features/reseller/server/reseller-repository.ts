import "server-only";
import type {
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

export function listBundles(
  params: CursorListParams & { providerId?: string; categoryId?: string },
) {
  const path =
    params.providerId && params.categoryId
      ? `/api/v1/providers/${params.providerId}/categories/${params.categoryId}/bundles`
      : "/api/v1/bundles";
  return toptayoFetch<CursorPage<ResellerBundle>>(path, {
    q: params.q,
    cursor: params.cursor,
    limit: params.limit,
  });
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
    ...(input.scheduledTime ? { scheduledTime: input.scheduledTime } : {}),
  });
}
