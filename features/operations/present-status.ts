import type { ExposedValue, ProductionSafeguardView } from "@/features/operations/contracts";

export type ProductionStatusPayload = {
  productionEnabled?: unknown;
  dailyRechargeLimitCents?: unknown;
  todayExposureCents?: unknown;
  remainingDailyCapacityCents?: unknown;
  reserveFloorCents?: unknown;
  canaryEnabled?: unknown;
  topTayoBalanceCents?: unknown;
  balanceKnown?: unknown;
  balanceAsOf?: unknown;
  topTayoEnvironment?: unknown;
};

const UNAVAILABLE = "Unavailable";

export function presentProductionStatus(
  payload: ProductionStatusPayload,
  generatedAt = new Date().toISOString(),
): ProductionSafeguardView {
  const balanceKnown = payload.balanceKnown === true;
  const balanceCents = finiteCents(payload.topTayoBalanceCents);
  return {
    generatedAt,
    environment: environmentValue(payload.topTayoEnvironment),
    toptayoBalanceCents:
      balanceKnown && balanceCents != null
        ? { state: "known", value: balanceCents }
        : { state: "unavailable", label: "Balance unavailable" },
    balanceAsOf:
      balanceKnown && typeof payload.balanceAsOf === "string" && payload.balanceAsOf.trim()
        ? payload.balanceAsOf
        : null,
    automatedSales: flagValue(payload.productionEnabled),
    reserveFloorCents: optionalCents(payload.reserveFloorCents, "Not configured"),
    dailyLimitCents: optionalCents(payload.dailyRechargeLimitCents, "Not configured"),
    todayExposureCents: optionalCents(payload.todayExposureCents, "Today's exposure unavailable"),
    remainingCapacityCents: optionalCents(
      payload.remainingDailyCapacityCents,
      "Remaining capacity unavailable",
    ),
    canary: flagValue(payload.canaryEnabled),
  };
}

export function unavailableProductionStatus(
  generatedAt = new Date().toISOString(),
): ProductionSafeguardView {
  return {
    generatedAt,
    environment: { state: "unavailable", label: UNAVAILABLE },
    toptayoBalanceCents: { state: "unavailable", label: "Balance unavailable" },
    balanceAsOf: null,
    automatedSales: { state: "unavailable", label: UNAVAILABLE },
    reserveFloorCents: { state: "unavailable", label: UNAVAILABLE },
    dailyLimitCents: { state: "unavailable", label: UNAVAILABLE },
    todayExposureCents: { state: "unavailable", label: "Today's exposure unavailable" },
    remainingCapacityCents: { state: "unavailable", label: "Remaining capacity unavailable" },
    canary: { state: "unavailable", label: UNAVAILABLE },
  };
}

function flagValue(value: unknown): ExposedValue<"enabled" | "disabled"> {
  if (value === true) return { state: "known", value: "enabled" };
  if (value === false) return { state: "known", value: "disabled" };
  return { state: "unavailable", label: UNAVAILABLE };
}

function optionalCents(value: unknown, label: string): ExposedValue<number> {
  const cents = finiteCents(value);
  if (cents == null) return { state: "unavailable", label };
  return { state: "known", value: cents };
}

function finiteCents(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatUsdFromCents(cents: number) {
  return usd.format(cents / 100);
}

export function formatExposure(view: ProductionSafeguardView) {
  if (view.todayExposureCents.state !== "known") return view.todayExposureCents.label;
  const used = formatUsdFromCents(view.todayExposureCents.value);
  if (view.dailyLimitCents.state !== "known") return used;
  return `${used} / ${formatUsdFromCents(view.dailyLimitCents.value)}`;
}

function environmentValue(value: unknown): ExposedValue<string> {
  if (typeof value !== "string" || !value.trim()) {
    return { state: "unavailable", label: UNAVAILABLE };
  }
  return { state: "known", value: value.trim() };
}
