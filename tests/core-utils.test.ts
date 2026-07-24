import assert from "node:assert/strict";
import test from "node:test";
import { rowsToCsv } from "../lib/csv.ts";
import { buildDateRange } from "../lib/date-range.ts";
import { formatCurrency, formatInteger, formatPercent } from "../lib/formatters.ts";
import { hasMinimumRole } from "../lib/permissions.ts";

test("metric formatters avoid fake precision", () => {
  assert.equal(formatInteger.format(12_540), "12,540");
  assert.equal(formatCurrency.format(1_240_000), "$1.2M");
  assert.equal(formatPercent.format(0.186), "18.6%");
});

test("CSV export escapes commas, quotes, newlines, and missing values", () => {
  assert.equal(
    rowsToCsv([
      { name: 'A "quoted", value', amount: 42, note: null },
      { name: "Second\nrow", amount: 7, note: "ok" },
    ]),
    'name,amount,note\n"A ""quoted"", value",42,\n"Second\nrow",7,ok'
  );
});

test("role hierarchy permits only equal or stronger roles", () => {
  assert.equal(hasMinimumRole("admin", "support"), true);
  assert.equal(hasMinimumRole("support", "viewer"), true);
  assert.equal(hasMinimumRole("viewer", "support"), false);
  assert.equal(hasMinimumRole("support", "admin"), false);
});

test("dashboard date range uses stable UTC boundaries and readable granularity", () => {
  const now = new Date("2026-07-24T12:00:00.000Z");
  const thirtyDays = buildDateRange(30, now);
  const ninetyDays = buildDateRange(90, now);

  assert.equal(thirtyDays.from, "2026-06-24T12:00:00.000Z");
  assert.equal(thirtyDays.to, "2026-07-24T12:00:00.000Z");
  assert.equal(thirtyDays.granularity, "day");
  assert.equal(ninetyDays.granularity, "week");
});
