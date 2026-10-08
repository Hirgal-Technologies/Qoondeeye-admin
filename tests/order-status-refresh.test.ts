import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("Check TopTayo reconciles a stored transaction and does not recharge", () => {
  const panel = readFileSync(
    join(root, "features/merchant-gateway/components/paid-orders-panel.tsx"),
    "utf8",
  );
  const route = readFileSync(
    join(root, "app/api/merchant-gateway/order-status-refresh/route.ts"),
    "utf8",
  );
  const functions = readFileSync(join(root, "features/qoondeeye/admin-functions.ts"), "utf8");

  assert.match(panel, /\/api\/merchant-gateway\/order-status-refresh/);
  assert.doesNotMatch(panel, /\/api\/resellers\/transactions\//);
  assert.doesNotMatch(panel, /createRecharge|\/api\/v1\/recharge/);
  assert.match(panel, /checkMessage/);
  assert.match(panel, /Awaiting TopTayo confirmation/);
  assert.match(route, /orderStatusRefresh/);
  assert.doesNotMatch(route, /createRecharge|\/recharge/);
  assert.match(functions, /bundles-admin-order-status-refresh/);
});
