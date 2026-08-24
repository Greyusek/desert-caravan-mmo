import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_CITY_NPC_CONSUMPTION,
  SECONDS_PER_CITY_DAY,
  projectCityStocksAtTime,
} from "../dist/src/index.js";

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
