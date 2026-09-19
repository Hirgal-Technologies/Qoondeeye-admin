import "server-only";
import type { BundlePriceOverride } from "@/features/reseller/pricing";
import { createAdminClient } from "@/lib/supabase/admin";

type OverrideRow = {
  top_tayo_bundle_id: string;
  enabled: boolean;
  selling_price_cents: number | null;
};

export async function listPriceOverridesByBundleIds(
  bundleIds: string[],
): Promise<Map<string, BundlePriceOverride>> {
  const overrides = new Map<string, BundlePriceOverride>();
  if (bundleIds.length === 0) return overrides;

  const db = createAdminClient();
  const { data, error } = await db
    .from("bundle_price_overrides")
    .select("top_tayo_bundle_id, enabled, selling_price_cents")
    .in("top_tayo_bundle_id", bundleIds);

  if (error) throw error;

  for (const row of (data ?? []) as OverrideRow[]) {
    const bundleId = row.top_tayo_bundle_id?.trim();
    if (!bundleId) continue;
    overrides.set(bundleId, {
      enabled: Boolean(row.enabled),
      sellingPriceCents:
        typeof row.selling_price_cents === "number" &&
        Number.isInteger(row.selling_price_cents)
          ? row.selling_price_cents
          : null,
    });
  }

  return overrides;
}
