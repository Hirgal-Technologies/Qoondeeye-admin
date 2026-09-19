export const QOONDEEYE_PRICE_DATA_SOURCE = "bundle_price_overrides" as const;

export type BundlePricingStatus = "priced" | "disabled" | "not_priced";
export type BundlePriceDataSource = typeof QOONDEEYE_PRICE_DATA_SOURCE;

export type BundlePriceOverride = {
  enabled: boolean;
  sellingPriceCents: number | null;
};

export type BundlePriceComparison = {
  status: BundlePricingStatus;
  enabled: boolean | null;
  topTayoCostCents: number | null;
  sellingPriceCents: number | null;
  grossCents: number | null;
  isLoss: boolean;
  dataSource: BundlePriceDataSource | null;
};

export function dollarsToCents(amount: string | number): number | null {
  const raw =
    typeof amount === "number" ? String(amount) : amount.replace(/,/g, "").trim();
  if (!raw) return null;
  const dollars = Number(raw);
  if (!Number.isFinite(dollars)) return null;
  return Math.round(dollars * 100);
}

function isIntegerCents(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

export function compareBundlePricing(input: {
  liveAmount: string | number;
  override: BundlePriceOverride | null;
}): BundlePriceComparison {
  const topTayoCostCents = dollarsToCents(input.liveAmount);
  const override = input.override;

  if (!override) {
    return {
      status: "not_priced",
      enabled: null,
      topTayoCostCents,
      sellingPriceCents: null,
      grossCents: null,
      isLoss: false,
      dataSource: null,
    };
  }

  if (!override.enabled) {
    return {
      status: "disabled",
      enabled: false,
      topTayoCostCents,
      sellingPriceCents: null,
      grossCents: null,
      isLoss: false,
      dataSource: QOONDEEYE_PRICE_DATA_SOURCE,
    };
  }

  const sellingPriceCents = isIntegerCents(override.sellingPriceCents)
    ? override.sellingPriceCents
    : null;

  if (sellingPriceCents === null) {
    return {
      status: "not_priced",
      enabled: true,
      topTayoCostCents,
      sellingPriceCents: null,
      grossCents: null,
      isLoss: false,
      dataSource: QOONDEEYE_PRICE_DATA_SOURCE,
    };
  }

  const canGross =
    isIntegerCents(topTayoCostCents) && isIntegerCents(sellingPriceCents);
  const grossCents = canGross ? sellingPriceCents - topTayoCostCents : null;

  return {
    status: "priced",
    enabled: true,
    topTayoCostCents,
    sellingPriceCents,
    grossCents,
    isLoss: grossCents !== null && grossCents < 0,
    dataSource: QOONDEEYE_PRICE_DATA_SOURCE,
  };
}
