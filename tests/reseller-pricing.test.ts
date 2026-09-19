import assert from "node:assert/strict";
import test from "node:test";
import {
  QOONDEEYE_PRICE_DATA_SOURCE,
  compareBundlePricing,
  dollarsToCents,
} from "../features/reseller/pricing.ts";

test("dollarsToCents converts live TopTayo amounts with integer cents", () => {
  assert.equal(dollarsToCents("0.17"), 17);
  assert.equal(dollarsToCents("0.20"), 20);
  assert.equal(dollarsToCents(1), 100);
  assert.equal(dollarsToCents("1,234.56"), 123456);
  assert.equal(dollarsToCents(""), null);
  assert.equal(dollarsToCents("not-a-price"), null);
});

test("unpriced bundles expose no Qoondeeye amount or gross", () => {
  const pricing = compareBundlePricing({
    liveAmount: "0.17",
    override: null,
  });

  assert.deepEqual(pricing, {
    status: "not_priced",
    enabled: null,
    topTayoCostCents: 17,
    sellingPriceCents: null,
    grossCents: null,
    isLoss: false,
    dataSource: null,
  });
});

test("disabled overrides keep the data source and hide gross", () => {
  const pricing = compareBundlePricing({
    liveAmount: "0.17",
    override: { enabled: false, sellingPriceCents: 20 },
  });

  assert.equal(pricing.status, "disabled");
  assert.equal(pricing.enabled, false);
  assert.equal(pricing.sellingPriceCents, null);
  assert.equal(pricing.grossCents, null);
  assert.equal(pricing.isLoss, false);
  assert.equal(pricing.dataSource, QOONDEEYE_PRICE_DATA_SOURCE);
});

test("priced bundles compute gross from integer cents", () => {
  const pricing = compareBundlePricing({
    liveAmount: "0.17",
    override: { enabled: true, sellingPriceCents: 20 },
  });

  assert.equal(pricing.status, "priced");
  assert.equal(pricing.sellingPriceCents, 20);
  assert.equal(pricing.grossCents, 3);
  assert.equal(pricing.isLoss, false);
  assert.equal(pricing.dataSource, QOONDEEYE_PRICE_DATA_SOURCE);
});

test("supplier cost above selling price is a loss", () => {
  const pricing = compareBundlePricing({
    liveAmount: "0.22",
    override: { enabled: true, sellingPriceCents: 20 },
  });

  assert.equal(pricing.grossCents, -2);
  assert.equal(pricing.isLoss, true);
});

test("enabled overrides without a selling price stay unpriced", () => {
  const pricing = compareBundlePricing({
    liveAmount: "0.17",
    override: { enabled: true, sellingPriceCents: null },
  });

  assert.equal(pricing.status, "not_priced");
  assert.equal(pricing.grossCents, null);
  assert.equal(pricing.dataSource, QOONDEEYE_PRICE_DATA_SOURCE);
});
