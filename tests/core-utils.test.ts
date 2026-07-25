import assert from "node:assert/strict";
import test from "node:test";
import { rowsToCsv } from "../lib/csv.ts";
import { buildCustomDateRange, buildDateRange } from "../lib/date-range.ts";
import { formatCurrency, formatInteger, formatPercent } from "../lib/formatters.ts";
import { hasMinimumRole } from "../lib/permissions.ts";
import { parseSupportLookupInput } from "../features/support/validation.ts";
import {
  isAdminUserId,
  parseCreateAdminUserInput,
  parseUpdateAdminUserInput,
} from "../features/admin-users/validation.ts";

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

test("custom calendar range includes both boundary dates", () => {
  assert.deepEqual(buildCustomDateRange("2026-07-01", "2026-07-25"), {
    from: "2026-07-01T00:00:00.000Z",
    to: "2026-07-25T23:59:59.999Z",
    granularity: "day",
  });
  assert.equal(
    buildCustomDateRange("2026-01-01", "2026-07-25").granularity,
    "month"
  );
});

test("support lookup validation normalizes valid input and rejects unsafe requests", () => {
  const valid = parseSupportLookupInput({
    userId: "8a3d24d0-42aa-4d65-9a5f-a954f34bf727",
    reason: "  Customer approved account access for a billing investigation.  ",
    permissionConfirmed: true,
  });

  assert.deepEqual(valid, {
    userId: "8a3d24d0-42aa-4d65-9a5f-a954f34bf727",
    reason: "Customer approved account access for a billing investigation.",
    permissionConfirmed: true,
  });
  assert.equal(
    parseSupportLookupInput({
      userId: "not-a-user-id",
      reason: "Too short",
      permissionConfirmed: false,
    }),
    null
  );
});

test("admin user validation normalizes safe create and update payloads", () => {
  assert.deepEqual(
    parseCreateAdminUserInput({
      email: "  ADMIN@Qoondeeye.com ",
      role: "support",
      password: "temporary-password",
    }),
    {
      email: "admin@qoondeeye.com",
      role: "support",
      password: "temporary-password",
    }
  );
  assert.deepEqual(
    parseUpdateAdminUserInput({
      email: "VIEWER@Qoondeeye.com",
      role: "viewer",
    }),
    { email: "viewer@qoondeeye.com", role: "viewer" }
  );
  assert.equal(
    parseCreateAdminUserInput({
      email: "not-an-email",
      role: "owner",
      password: "short",
    }),
    null
  );
  assert.equal(
    isAdminUserId("8a3d24d0-42aa-4d65-9a5f-a954f34bf727"),
    true
  );
  assert.equal(isAdminUserId("../unsafe"), false);
});
