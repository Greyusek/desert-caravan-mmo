import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_CITY_NPC_CONSUMPTION,
  DEFAULT_CITY_SHORTAGE_PROFILE,
  SECONDS_PER_CITY_DAY,
  projectCitySettlementAtTime,
  projectCityStocksAtTime,
} from "../dist/src/index.js";

function approx(actual, expected, tolerance = 1e-9) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );
}

const stocks = { cityId: "city-01", foodUnits: 10_000, waterUnits: 20_000 };
const population = { cityId: "city-01", inhabitants: 100 };

test("CITY-002: time zero preserves initial city stocks", () => {
  const projected = projectCityStocksAtTime(stocks, population, 0);

  assert.equal(projected.foodUnits, 10_000);
  assert.equal(projected.waterUnits, 20_000);
  assert.equal(projected.status, "supplied");
  assert.equal(projected.firstDepletionAtSeconds, 100 * SECONDS_PER_CITY_DAY);
  assert.equal(projected.firstDepletionCause, "both");
});

test("CITY-002: aggregate NPC consumption is proportional to world days", () => {
  const projected = projectCityStocksAtTime(
    stocks,
    population,
    10 * SECONDS_PER_CITY_DAY,
  );

  assert.equal(projected.foodConsumedUnits, 1_000);
  assert.equal(projected.waterConsumedUnits, 2_000);
  assert.equal(projected.foodUnits, 9_000);
  assert.equal(projected.waterUnits, 18_000);
});

test("CITY-002: exact depletion and later projection clamp stocks at zero", () => {
  const exact = projectCityStocksAtTime(
    { cityId: "city-01", foodUnits: 1_000, waterUnits: 10_000 },
    population,
    10 * SECONDS_PER_CITY_DAY,
  );
  const later = projectCityStocksAtTime(
    { cityId: "city-01", foodUnits: 1_000, waterUnits: 10_000 },
    population,
    200 * SECONDS_PER_CITY_DAY,
  );

  assert.equal(exact.status, "food-depleted");
  assert.equal(exact.firstDepletionCause, "food");
  assert.equal(later.status, "food-and-water-depleted");
  assert.equal(later.foodUnits, 0);
  assert.equal(later.waterUnits, 0);
});

test("CITY-002: zero consumption keeps finite stocks indefinitely", () => {
  const projected = projectCityStocksAtTime(
    stocks,
    population,
    1_000 * SECONDS_PER_CITY_DAY,
    { foodUnitsPerPersonPerDay: 0, waterUnitsPerPersonPerDay: 0 },
  );

  assert.equal(projected.status, "supplied");
  assert.equal(projected.firstDepletionAtSeconds, null);
  assert.equal(projected.firstDepletionCause, null);
  assert.deepEqual(DEFAULT_CITY_NPC_CONSUMPTION, {
    foodUnitsPerPersonPerDay: 1,
    waterUnitsPerPersonPerDay: 2,
  });
});

test("CITY-002: mismatched cities and invalid population, time or rates are rejected", () => {
  assert.throws(
    () => projectCityStocksAtTime(stocks, { ...population, cityId: "city-02" }, 0),
    /same cityId/,
  );
  assert.throws(
    () => projectCityStocksAtTime(stocks, { ...population, inhabitants: 0 }, 0),
    /inhabitants/,
  );
  assert.throws(
    () => projectCityStocksAtTime(stocks, population, -1),
    /elapsedSeconds/,
  );
  assert.throws(
    () =>
      projectCityStocksAtTime(stocks, population, 0, {
        foodUnitsPerPersonPerDay: -1,
        waterUnitsPerPersonPerDay: 2,
      }),
    /foodUnitsPerPersonPerDay/,
  );
});

test("CITY-003: population stays intact before and exactly at first shortage", () => {
  const before = projectCitySettlementAtTime(
    { cityId: "city-01", foodUnits: 1_000, waterUnits: 10_000 },
    population,
    9 * SECONDS_PER_CITY_DAY,
  );
  const exact = projectCitySettlementAtTime(
    { cityId: "city-01", foodUnits: 1_000, waterUnits: 10_000 },
    population,
    10 * SECONDS_PER_CITY_DAY,
  );

  assert.equal(before.inhabitants, 100);
  assert.equal(before.shortageElapsedSeconds, 0);
  assert.equal(exact.inhabitants, 100);
  assert.equal(exact.populationLost, 0);
  assert.equal(exact.shortageStartedAtSeconds, 10 * SECONDS_PER_CITY_DAY);
});

test("CITY-003: food shortage compounds population loss by world time", () => {
  const projected = projectCitySettlementAtTime(
    { cityId: "city-01", foodUnits: 1_000, waterUnits: 10_000 },
    population,
    20 * SECONDS_PER_CITY_DAY,
  );

  assert.equal(projected.shortageCause, "food");
  assert.equal(projected.shortageElapsedSeconds, 10 * SECONDS_PER_CITY_DAY);
  assert.equal(projected.inhabitants, Math.floor(100 * 0.99 ** 10));
  assert.equal(projected.populationLost, 10);
  assert.equal(projected.foodUnits, 0);
});

test("CITY-003: declining population slows consumption of the remaining stock", () => {
  const projected = projectCitySettlementAtTime(
    { cityId: "city-01", foodUnits: 1_000, waterUnits: 10_000 },
    population,
    20 * SECONDS_PER_CITY_DAY,
  );
  const fixedPopulation = projectCityStocksAtTime(
    { cityId: "city-01", foodUnits: 1_000, waterUnits: 10_000 },
    population,
    20 * SECONDS_PER_CITY_DAY,
  );
  const expectedPostShortagePopulationDays =
    (100 * (0.99 ** 10 - 1)) / Math.log(0.99);

  approx(
    projected.waterUnits,
    8_000 - expectedPostShortagePopulationDays * 2,
    1e-7,
  );
  assert.ok(projected.waterUnits > fixedPopulation.waterUnits);
});

test("CITY-003: zero attrition preserves population and CITY-002 consumption", () => {
  const inputStocks = {
    cityId: "city-01",
    foodUnits: 1_000,
    waterUnits: 10_000,
  };
  const elapsedSeconds = 20 * SECONDS_PER_CITY_DAY;
  const projected = projectCitySettlementAtTime(
    inputStocks,
    population,
    elapsedSeconds,
    DEFAULT_CITY_NPC_CONSUMPTION,
    { dailyPopulationLossFraction: 0 },
  );
  const baseline = projectCityStocksAtTime(
    inputStocks,
    population,
    elapsedSeconds,
  );

  assert.equal(projected.inhabitants, 100);
  assert.equal(projected.populationLost, 0);
  assert.equal(projected.foodUnits, baseline.foodUnits);
  assert.equal(projected.waterUnits, baseline.waterUnits);
  assert.deepEqual(DEFAULT_CITY_SHORTAGE_PROFILE, {
    dailyPopulationLossFraction: 0.01,
  });
});

test("CITY-003: invalid shortage attrition is rejected", () => {
  for (const dailyPopulationLossFraction of [-0.01, 1, Number.NaN]) {
    assert.throws(
      () =>
        projectCitySettlementAtTime(
          stocks,
          population,
          0,
          DEFAULT_CITY_NPC_CONSUMPTION,
          { dailyPopulationLossFraction },
        ),
      /dailyPopulationLossFraction/,
    );
  }
});
