export type ExposedValue<T> =
  | { state: "known"; value: T }
  | { state: "unavailable"; label: string };

/**
 * Read-only production snapshot.
 * Fields the Qoondeeye backend does not expose stay unavailable.
 * They are never filled with a local default.
 */
export type ProductionSafeguardView = {
  generatedAt: string;
  environment: ExposedValue<string>;
  toptayoBalanceCents: ExposedValue<number>;
  balanceAsOf: string | null;
  /** True when a later production-status call failed and this snapshot was kept. */
  stale?: boolean;
  automatedSales: ExposedValue<"enabled" | "disabled">;
  reserveFloorCents: ExposedValue<number>;
  dailyLimitCents: ExposedValue<number>;
  todayExposureCents: ExposedValue<number>;
  remainingCapacityCents: ExposedValue<number>;
  canary: ExposedValue<"enabled" | "disabled">;
};
