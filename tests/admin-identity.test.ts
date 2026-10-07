import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  adminIdentityFromRecord,
  adminIdentityLabel,
  salaamReviewActorLines,
  withSalaamAdminNames,
  type AdminIdentitySource,
} from "../features/admin-users/identity.ts";

const MAHDI_ID = "3e1c8c5a-1111-4111-8111-111111111111";
const OTHER_ID = "9aa09aa0-2222-4222-8222-222222222222";

function identity(overrides: Partial<AdminIdentitySource> = {}): AdminIdentitySource {
  return {
    id: MAHDI_ID,
    fullName: "Mahdi",
    username: "mahdi",
    email: "mahdi@example.com",
    ...overrides,
  };
}

test("a claimed review displays the admin name and keeps the user id", () => {
  const named = withSalaamAdminNames(
    { claimedBy: MAHDI_ID, resolvedBy: null },
    new Map([[MAHDI_ID, identity()]]),
  );
  assert.equal(named.claimedBy, MAHDI_ID);
  assert.equal(named.claimedByName, "Mahdi");
  assert.deepEqual(salaamReviewActorLines(named), ["Claimed by: Mahdi"]);
});

test("a resolved review displays the admin name and keeps the user id", () => {
  const named = withSalaamAdminNames(
    { claimedBy: MAHDI_ID, resolvedBy: OTHER_ID },
    new Map([
      [MAHDI_ID, identity()],
      [OTHER_ID, identity({ id: OTHER_ID, fullName: "Amina", username: "amina" })],
    ]),
  );
  assert.equal(named.resolvedBy, OTHER_ID);
  assert.equal(named.resolvedByName, "Amina");
  assert.deepEqual(salaamReviewActorLines(named), [
    "Claimed by: Mahdi",
    "Resolved by: Amina",
  ]);
});

test("username and email are used when the display name is absent", () => {
  const username = adminIdentityLabel(
    identity({ fullName: "  ", username: "mahdi", email: "mahdi@example.com" }),
  );
  assert.equal(username, "mahdi");
  const email = adminIdentityLabel(
    identity({ fullName: null, username: "", email: "mahdi@example.com" }),
  );
  assert.equal(email, "mahdi@example.com");
  const fromMetadata = adminIdentityFromRecord({
    id: MAHDI_ID,
    email: "roster@example.com",
    metadata: { username: "mahdi", email: "auth@example.com" },
  });
  assert.equal(adminIdentityLabel(fromMetadata), "mahdi");
  assert.equal(
    adminIdentityLabel(adminIdentityFromRecord({ id: MAHDI_ID, email: "roster@example.com" })),
    "roster@example.com",
  );
});

test("the stored admin id remains available for auditing", () => {
  const row = { claimedBy: MAHDI_ID, resolvedBy: OTHER_ID, amountCents: 44 };
  const named = withSalaamAdminNames(row, new Map([[MAHDI_ID, identity()]]));
  assert.equal(named.claimedBy, MAHDI_ID);
  assert.equal(named.resolvedBy, OTHER_ID);
  assert.equal(row.claimedBy, MAHDI_ID);
  assert.equal(named.amountCents, 44);
});

test("an unknown admin identity falls back without throwing", () => {
  const named = withSalaamAdminNames(
    { claimedBy: MAHDI_ID, resolvedBy: null },
    new Map(),
  );
  assert.equal(named.claimedByName, MAHDI_ID);
  assert.deepEqual(salaamReviewActorLines(named), [`Claimed by: ${MAHDI_ID}`]);
  assert.equal(adminIdentityLabel({ id: MAHDI_ID, fullName: null, username: null, email: null }), MAHDI_ID);
  assert.equal(adminIdentityLabel(null), "Unknown admin");
  assert.equal(salaamReviewActorLines({ claimedBy: null, resolvedBy: null }).length, 0);
});

test("the Salaam review page renders the display name fields", () => {
  const page = fs.readFileSync(
    new URL("../features/merchant-gateway/components/salaam-review-page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(page, /salaamReviewActorLines/);
  assert.doesNotMatch(page, /Claimed by: \{row\.claimedBy\}/);
  assert.doesNotMatch(page, /Resolved by: \{row\.resolvedBy\}/);
});
