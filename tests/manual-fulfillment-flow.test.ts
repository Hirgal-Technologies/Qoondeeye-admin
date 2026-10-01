import assert from "node:assert/strict";
import test from "node:test";
import {
  executeManualFulfillment,
  publicRevokeBody,
  type AdminCall,
  type ManualFlowDeps,
} from "../features/merchant-gateway/manual-fulfillment-flow.ts";

const ORDER = "11111111-1111-4111-8111-111111111111";
const CLAIM = "22222222-2222-4222-8222-222222222222";

test("begin-send 409 never calls createRecharge", async () => {
  const harness = createHarness({
    begin: { status: 409, body: { ok: false, sendAuthorized: false, code: "already_sending" } },
  });
  const result = await executeManualFulfillment(harness.deps, { orderId: ORDER, retryRecording: false });
  assert.equal(result.kind, "not_sent");
  assert.equal(harness.recharges.length, 0);
  assert.equal(harness.uncertainCalls, 0);
  assert.equal(harness.finalizeCalls.length, 0);
});

test("a successful begin-send calls TopTayo once and finalizes that id", async () => {
  const harness = createHarness({});
  const result = await executeManualFulfillment(harness.deps, { orderId: ORDER, retryRecording: false });
  assert.deepEqual(result, { kind: "completed", transactionId: "tt-real" });
  assert.equal(harness.recharges.length, 1);
  assert.deepEqual(harness.recharges[0], {
    sender: 611111111,
    receiver: 622222222,
    bundleId: "bundle-from-begin",
  });
  assert.deepEqual(harness.finalizeCalls, [{ orderId: ORDER, transactionId: "tt-real" }]);
  assert.equal(harness.uncertainCalls, 0);
});

test("finalize network failure does not call TopTayo again and retry uses the same id", async () => {
  const harness = createHarness({ finalizeResults: ["failed", "failed"] });
  const first = await executeManualFulfillment(harness.deps, { orderId: ORDER, retryRecording: false });
  assert.deepEqual(first, { kind: "recording_pending", transactionId: "tt-real" });
  assert.equal(harness.recharges.length, 1);
  assert.deepEqual(
    harness.finalizeCalls.map((call) => call.transactionId),
    ["tt-real", "tt-real"],
  );

  harness.finalizeResults = ["recorded"];
  const retry = await executeManualFulfillment(harness.deps, { orderId: ORDER, retryRecording: true });
  assert.deepEqual(retry, { kind: "completed", transactionId: "tt-real" });
  assert.equal(harness.recharges.length, 1);
  assert.equal(harness.finalizeCalls.at(-1)?.transactionId, "tt-real");
});

test("an unknown TopTayo result invokes uncertain and does not recharge again", async () => {
  const thrown = createHarness({ rechargeError: true });
  const failed = await executeManualFulfillment(thrown.deps, { orderId: ORDER, retryRecording: false });
  assert.equal(failed.kind, "uncertain");
  assert.equal(thrown.recharges.length, 1);
  assert.equal(thrown.uncertainCalls, 1);
  assert.equal(thrown.finalizeCalls.length, 0);

  const empty = createHarness({ transactionIds: [] });
  const missing = await executeManualFulfillment(empty.deps, { orderId: ORDER, retryRecording: false });
  assert.equal(missing.kind, "uncertain");
  assert.equal(empty.recharges.length, 1);
  assert.equal(empty.uncertainCalls, 1);
});

test("a claim can resume before begin-send without another recharge", async () => {
  const harness = createHarness({ payer: null });
  const paused = await executeManualFulfillment(harness.deps, { orderId: ORDER, retryRecording: false });
  assert.equal(paused.kind, "claimed_ready");
  if (paused.kind === "claimed_ready") assert.equal(paused.claimId, CLAIM);
  assert.equal(harness.beginCalls, 0);
  assert.equal(harness.recharges.length, 0);
  assert.equal(harness.claimCalls, 1);

  harness.payer = "252611111111";
  const resumed = await executeManualFulfillment(harness.deps, { orderId: ORDER, retryRecording: false });
  assert.equal(resumed.kind, "completed");
  assert.equal(harness.claimCalls, 2);
  assert.equal(harness.beginCalls, 1);
  assert.equal(harness.recharges.length, 1);
  assert.equal(harness.recharges[0]?.bundleId, "bundle-from-begin");
});

test("revoke requests only the device id", () => {
  const body = publicRevokeBody("simulator-device");
  assert.deepEqual(body, { deviceId: "simulator-device" });
  assert.equal("adminUserId" in body, false);
  assert.equal(JSON.stringify(body).includes("service_role"), false);
});

function createHarness(options: {
  begin?: AdminCall;
  payer?: string | null;
  finalizeResults?: Array<"recorded" | "failed">;
  rechargeError?: boolean;
  transactionIds?: string[];
}) {
  const recharges: Array<{ sender: number; receiver: number; bundleId: string }> = [];
  const finalizeCalls: Array<{ orderId: string; transactionId: string }> = [];
  const state = {
    recharges,
    finalizeCalls,
    uncertainCalls: 0,
    claimCalls: 0,
    beginCalls: 0,
    payer: options.payer === undefined ? "252611111111" : options.payer,
    finalizeResults: options.finalizeResults ?? ["recorded"],
    deps: {} as ManualFlowDeps,
  };

  state.deps = {
    claim: async () => {
      state.claimCalls += 1;
      return {
        status: 200,
        body: {
          ok: true,
          sendAuthorized: false,
          reservationOutcome: "manual_claimed",
          claimId: CLAIM,
          destination: "252611111111",
          providerId: "provider-claim",
          bundleId: "bundle-from-claim",
          rechargeCostCents: 100,
        },
      };
    },
    beginSend: async () => {
      state.beginCalls += 1;
      return (
        options.begin ?? {
          status: 200,
          body: {
            ok: true,
            sendAuthorized: true,
            reservationOutcome: "manual_sending",
            claimId: CLAIM,
            destination: "252622222222",
            providerId: "provider-begin",
            bundleId: "bundle-from-begin",
            rechargeCostCents: 100,
          },
        }
      );
    },
    createRecharge: async (purchase) => {
      state.recharges.push(purchase);
      if (options.rechargeError) throw new Error("timeout");
      return { transactionIds: options.transactionIds ?? ["tt-real"] };
    },
    finalize: async (orderId, transactionId) => {
      state.finalizeCalls.push({ orderId, transactionId });
      return state.finalizeResults.shift() ?? "failed";
    },
    uncertain: async () => {
      state.uncertainCalls += 1;
    },
    payerPhone: async () => state.payer,
    rememberTransaction: async () => undefined,
    readPendingTransaction: async () => "tt-real",
  };

  return state;
}
