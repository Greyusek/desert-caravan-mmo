import test from "node:test";
import assert from "node:assert/strict";
import {
  CITY_MARKET_MAXIMUM_PRICE_MULTIPLIER,
  CITY_MARKET_MINIMUM_PRICE_MULTIPLIER,
  CITY_MARKET_TARGET_STOCK_DAYS,
  SECONDS_PER_CITY_DAY,
  TRADE_GOOD_REFERENCE_PRICES,
  advanceCityEconomyToWorldTime,
  createCityEconomyState,
  generateSeededWorld,
  quoteCityGoodPrice,
  quoteCityMarketPrices,
} from "../dist/src/index.js";

function economy(seed = "trade-002-world") {
  const world = generateSeededWorld(seed);
  const stocks = world.cityStocks[0];
  const population = world.cityPopulations[0];
  assert.ok(stocks);
  assert.ok(population);
  return createCityEconomyState(seed, stocks, population);
}

function withGoodStock(state, goodId, stockUnits) {
  return {
    ...state,
    goods: state.goods.map((good) =>
      good.goodId === goodId ? { ...good, stockUnits } : good,
    ),
  };
}

test("TRADE-002: thirty days of stock quotes the reference pressure", () => {
  const initial = economy();
  const food = initial.goods.find((good) => good.goodId === "food");
  assert.ok(food);
  const atTarget = withGoodStock(
    initial,
    "food",
    food.consumptionUnitsPerDay * CITY_MARKET_TARGET_STOCK_DAYS,
  );
  const quote = quoteCityGoodPrice(atTarget, "food");

  assert.equal(quote.scarcityMultiplier, 1);
  assert.equal(quote.stockCoverageDays, CITY_MARKET_TARGET_STOCK_DAYS);
  assert.equal(
    quote.cityBuyPriceCredits,
    Math.floor(TRADE_GOOD_REFERENCE_PRICES.food * 0.9),
  );
  assert.equal(
    quote.citySellPriceCredits,
    Math.ceil(TRADE_GOOD_REFERENCE_PRICES.food * 1.1),
  );
});

test("TRADE-002: lower stock raises both local prices", () => {
  const initial = economy();
  const abundant = quoteCityGoodPrice(
    withGoodStock(initial, "medicine", 1_000),
    "medicine",
  );
  const scarce = quoteCityGoodPrice(
    withGoodStock(initial, "medicine", 1),
    "medicine",
  );

  assert.ok(scarce.cityBuyPriceCredits > abundant.cityBuyPriceCredits);
  assert.ok(scarce.citySellPriceCredits > abundant.citySellPriceCredits);
  assert.ok(scarce.stockCoverageDays < abundant.stockCoverageDays);
});

test("TRADE-002: empty and excessive stocks stay inside explicit bounds", () => {
  const initial = economy();
  const empty = quoteCityGoodPrice(withGoodStock(initial, "tools", 0), "tools");
  const excessive = quoteCityGoodPrice(
    withGoodStock(initial, "tools", 1_000_000),
    "tools",
  );

  assert.equal(
    empty.scarcityMultiplier,
    CITY_MARKET_MAXIMUM_PRICE_MULTIPLIER,
  );
  assert.equal(
    excessive.scarcityMultiplier,
    CITY_MARKET_MINIMUM_PRICE_MULTIPLIER,
  );
  assert.ok(empty.citySellPriceCredits > empty.cityBuyPriceCredits);
  assert.ok(excessive.citySellPriceCredits > excessive.cityBuyPriceCredits);
});

test("TRADE-002: authoritative production/consumption changes later price", () => {
  const initial = economy();
  const deficit = initial.goods.find(
    (good) => good.productionUnitsPerDay < good.consumptionUnitsPerDay,
  );
  assert.ok(deficit);
  const before = quoteCityGoodPrice(initial, deficit.goodId);
  const laterEconomy = advanceCityEconomyToWorldTime(
    initial,
    20 * SECONDS_PER_CITY_DAY,
  );
  const after = quoteCityGoodPrice(laterEconomy, deficit.goodId);

  assert.ok(after.stockUnits < before.stockUnits);
  assert.ok(after.scarcityMultiplier >= before.scarcityMultiplier);
  assert.ok(after.citySellPriceCredits >= before.citySellPriceCredits);
});

test("TRADE-002: complete quote table is ordered and deterministic", () => {
  const initial = economy();
  const first = quoteCityMarketPrices(initial);
  const second = quoteCityMarketPrices(initial);

  assert.deepEqual(second, first);
  assert.deepEqual(
    first.map((quote) => quote.goodId),
    ["food", "water", "salt", "textiles", "ore", "medicine", "tools"],
  );
  assert.equal(first.length, 7);
});

test("TRADE-002: missing goods and invalid demand are rejected", () => {
  const initial = economy();
  assert.throws(
    () => quoteCityGoodPrice(initial, "unknown"),
    /missing good/,
  );
  const invalid = {
    ...initial,
    goods: initial.goods.map((good) =>
      good.goodId === "food"
        ? { ...good, consumptionUnitsPerDay: 0 }
        : good,
    ),
  };
  assert.throws(
    () => quoteCityGoodPrice(invalid, "food"),
    /demand must be positive/,
  );
});
