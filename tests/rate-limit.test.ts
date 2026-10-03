import assert from "node:assert/strict";
import test from "node:test";
import { clientAddress, createRateLimiter } from "../lib/api/rate-limit.ts";

test("allows attempts up to the limit, then reports seconds until reset", () => {
  const limiter = createRateLimiter({ limit: 3, windowMs: 60_000 });
  const start = 1_000_000;

  for (let i = 0; i < 3; i += 1) {
    assert.equal(limiter.retryAfter("a", start), 0);
    limiter.hit("a", start);
  }
  assert.equal(limiter.retryAfter("a", start), 60);
  assert.equal(limiter.retryAfter("a", start + 30_000), 30);
  assert.equal(limiter.retryAfter("b", start), 0, "keys are independent");
});

test("the window expires and reset clears a key", () => {
  const limiter = createRateLimiter({ limit: 1, windowMs: 10_000 });
  limiter.hit("a", 0);
  assert.ok(limiter.retryAfter("a", 1) > 0);
  assert.equal(limiter.retryAfter("a", 10_000), 0);

  limiter.hit("b", 0);
  limiter.reset("b");
  assert.equal(limiter.retryAfter("b", 1), 0);
});

test("clientAddress uses the proxy-appended X-Forwarded-For entry", () => {
  assert.equal(
    clientAddress(new Headers({ "x-forwarded-for": "6.6.6.6, 203.0.113.9" })),
    "203.0.113.9"
  );
  assert.equal(clientAddress(new Headers({ "x-real-ip": "198.51.100.2" })), "198.51.100.2");
  assert.equal(clientAddress(new Headers()), "unknown");
});
