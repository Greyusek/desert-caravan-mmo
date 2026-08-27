import test from "node:test";
import assert from "node:assert/strict";
import {
  SECONDS_PER_CITY_DAY,
  TRADE_GOODS,
  TRADE_GOOD_IDS,
  advanceCityEconomyToWorldTime,
  cityGood,
  createCityEconomyState,
  generateSeededWorld,
} from "../dist/src/index.js";

function seededInputs(seed = "trade-001-world", cityIndex = 0) {
  const world = generateSeededWorld(seed);
  const city = world.cities[cityIndex];
  assert.ok(city);
  const stocks = world.cityStocks.find((item) => item.cityId === city.id);
  const population = world.cityPopulations.find(
    (item) => item.cityId === city.id,
  );
  assert.ok(stocks);
  assert.ok(population);
  return { world, city, stocks, population };
}

function approx(actual, expected, tolerance = 1e-6) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );
}

test("TRADE-001: catalog contains seven unique goods with explicit roles", () => {
  assert.equal(TRADE_GOODS.length, 7);
  assert.deepEqual(
    TRADE_GOODS.map((good) => good.id),
    TRADE_GOOD_IDS,
  );
  assert.equal(new Set(TRADE_GOOD_IDS).size, 7);
  for (const good of TRADE_GOODS) {
    assert.ok(good.role.length > 0);
    assert.ok(good.cargoUnitsPerUnit > 0);
  }
});

test("TRADE-001: city economy reuses finite food/water stocks and population", () => {
  const { stocks, population } = seededInputs();
  const economy = createCityEconomyState(
    "trade-001-world",
    stocks,
    population,
  );

  assert.equal(economy.population, population.inhabitants);
  assert.equal(cityGood(economy, "food").stockUnits, stocks.foodUnits);
  assert.equal(cityGood(economy, "water").stockUnits, stocks.waterUnits);
  assert.equal(
    cityGood(economy, "food").consumptionUnitsPerDay,
    population.inhabitants,
  );
  assert.equal(
    cityGood(economy, "water").consumptionUnitsPerDay,
    population.inhabitants * 2,
  );
});

test("TRADE-001: every seeded city has one surplus and one deficit flow", () => {
  const { stocks, population } = seededInputs();
  const economy = createCityEconomyState(
    "trade-001-world",
    stocks,
    population,
  );
  const netFlows = economy.goods.map(
    (good) => good.productionUnitsPerDay - good.consumptionUnitsPerDay,
  );

  assert.ok(netFlows.some((flow) => flow > 0));
  assert.ok(netFlows.some((flow) => flow < 0));
});

test("TRADE-001: authoritative world time produces and consumes finite goods", () => {
  const { stocks, population } = seededInputs();
  const initial = createCityEconomyState(
    "trade-001-world",
    stocks,
    population,
  );
  const afterTenDays = advanceCityEconomyToWorldTime(
    initial,
    10 * SECONDS_PER_CITY_DAY,
  );

  for (const good of afterTenDays.goods) {
    approx(good.producedUnits, good.productionUnitsPerDay * 10);
    assert.ok(good.consumedUnits > 0);
    assert.ok(good.stockUnits >= 0);
  }
  assert.notDeepEqual(afterTenDays.goods, initial.goods);
});

test("TRADE-001: direct and staged catch-up are identical", () => {
  const { stocks, population } = seededInputs();
  const initial = createCityEconomyState(
    "trade-001-world",
    stocks,
    population,
  );
  const direct = advanceCityEconomyToWorldTime(
    initial,
    20 * SECONDS_PER_CITY_DAY,
  );
  const staged = advanceCityEconomyToWorldTime(
    advanceCityEconomyToWorldTime(initial, 8 * SECONDS_PER_CITY_DAY),
    20 * SECONDS_PER_CITY_DAY,
  );

  assert.deepEqual(staged, direct);
});

test("TRADE-001: shortages clamp stock and retain unmet consumption", () => {
  const population = { cityId: "city-starved", inhabitants: 100 };
  const initial = createCityEconomyState(
    "trade-001-shortage",
    { cityId: "city-starved", foodUnits: 0, waterUnits: 0 },
    population,
  );
  const deficit = initial.goods.find(
    (good) => good.productionUnitsPerDay < good.consumptionUnitsPerDay,
  );
  assert.ok(deficit);
  const afterYear = advanceCityEconomyToWorldTime(
    initial,
    365 * SECONDS_PER_CITY_DAY,
  );
  const projected = cityGood(afterYear, deficit.goodId);

  assert.equal(projected.stockUnits, 0);
  assert.ok(projected.unmetConsumptionUnits > 0);
});

test("TRADE-001: identical seed/state reproduces complete city economy", () => {
  const { stocks, population } = seededInputs();
  const first = createCityEconomyState(
    "trade-001-world",
    stocks,
    population,
    30 * SECONDS_PER_CITY_DAY,
  );
  const second = createCityEconomyState(
    "trade-001-world",
    stocks,
    population,
    30 * SECONDS_PER_CITY_DAY,
  );
  const anotherSeed = createCityEconomyState(
    "trade-001-another-world",
    stocks,
    population,
    30 * SECONDS_PER_CITY_DAY,
  );

  assert.deepEqual(second, first);
  assert.notDeepEqual(anotherSeed.goods, first.goods);
});

test("TRADE-001: city identity, chronology and economy shape are validated", () => {
  const { stocks, population } = seededInputs();
  assert.throws(
    () =>
      createCityEconomyState(
        "trade-001-world",
        stocks,
        { ...population, cityId: "city-other" },
      ),
    /same cityId/,
  );
  const economy = createCityEconomyState(
    "trade-001-world",
    stocks,
    population,
    SECONDS_PER_CITY_DAY,
  );
  assert.throws(
    () => advanceCityEconomyToWorldTime(economy, 0),
    /must not rewind/,
  );
  assert.throws(
    () =>
      advanceCityEconomyToWorldTime(
        { ...economy, goods: economy.goods.slice(1) },
        SECONDS_PER_CITY_DAY,
      ),
    /every trade good/,
  );
});
