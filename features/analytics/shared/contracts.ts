/**
 * Framework-agnostic analytics input contracts.
 *
 * This file is safe to import from both Client and Server Components. Keep
 * database clients and other server-only dependencies out of contract modules.
 */
export type Granularity = "day" | "week" | "month";
export type TxType = "expense" | "income" | "transfer";

export type DateRangeParams = { from: string; to: string };
