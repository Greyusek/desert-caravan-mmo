import type { CityPopulation, CityStocks } from "./world.js";

export const SECONDS_PER_CITY_DAY = 86_400;

export interface CityNpcConsumptionProfile {
  readonly foodUnitsPerPersonPerDay: number;
  readonly waterUnitsPerPersonPerDay: number;
}

export const DEFAULT_CITY_NPC_CONSUMPTION: CityNpcConsumptionProfile =
  Object.freeze({
    foodUnitsPerPersonPerDay: 1,
    waterUnitsPerPersonPerDay: 2,
  });

export type CityStockStatus =
  | "supplied"
  | "food-depleted"
  | "water-depleted"
  | "food-and-water-depleted";

export type CityStockDepletionCause = "food" | "water" | "both";

export interface CityStockProjection {
  readonly cityId: string;
  readonly population: number;
  readonly elapsedSeconds: number;
  readonly foodUnits: number;
  readonly waterUnits: number;
  readonly foodConsumedUnits: number;
  readonly waterConsumedUnits: number;
  readonly status: CityStockStatus;
  readonly firstDepletionAtSeconds: number | null;
  readonly firstDepletionCause: CityStockDepletionCause | null;
}

/**
 * CITY-002 projects aggregate NPC consumption from immutable initial stocks.
 * Population loss and resource production deliberately remain later layers.
 */
export function projectCityStocksAtTime(
  stocks: CityStocks,
  population: CityPopulation,
  elapsedSeconds: number,
  profile: CityNpcConsumptionProfile = DEFAULT_CITY_NPC_CONSUMPTION,
): CityStockProjection {
  assertCityInputs(stocks, population, elapsedSeconds, profile);

  const elapsedDays = elapsedSeconds / SECONDS_PER_CITY_DAY;
  const foodConsumedUnits =
    population.inhabitants * profile.foodUnitsPerPersonPerDay * elapsedDays;
  const waterConsumedUnits =
    population.inhabitants * profile.waterUnitsPerPersonPerDay * elapsedDays;
  const foodUnits = Math.max(0, stocks.foodUnits - foodConsumedUnits);
  const waterUnits = Math.max(0, stocks.waterUnits - waterConsumedUnits);
  const foodDepleted = foodUnits === 0;
  const waterDepleted = waterUnits === 0;
  const foodRatePerSecond =
    (population.inhabitants * profile.foodUnitsPerPersonPerDay) /
    SECONDS_PER_CITY_DAY;
  const waterRatePerSecond =
    (population.inhabitants * profile.waterUnitsPerPersonPerDay) /
    SECONDS_PER_CITY_DAY;
  const foodDepletionAtSeconds =
    stocks.foodUnits === 0
      ? 0
      : foodRatePerSecond > 0
        ? stocks.foodUnits / foodRatePerSecond
        : Infinity;
  const waterDepletionAtSeconds =
    stocks.waterUnits === 0
      ? 0
      : waterRatePerSecond > 0
        ? stocks.waterUnits / waterRatePerSecond
        : Infinity;
  const firstDepletionAtSeconds = Math.min(
    foodDepletionAtSeconds,
    waterDepletionAtSeconds,
  );
  const firstDepletionCause = Number.isFinite(firstDepletionAtSeconds)
    ? Math.abs(foodDepletionAtSeconds - waterDepletionAtSeconds) <= 1e-7
      ? "both"
      : foodDepletionAtSeconds < waterDepletionAtSeconds
        ? "food"
        : "water"
    : null;

  return {
    cityId: stocks.cityId,
    population: population.inhabitants,
    elapsedSeconds,
    foodUnits,
    waterUnits,
    foodConsumedUnits: Math.min(stocks.foodUnits, foodConsumedUnits),
    waterConsumedUnits: Math.min(stocks.waterUnits, waterConsumedUnits),
    status: foodDepleted
      ? waterDepleted
        ? "food-and-water-depleted"
        : "food-depleted"
      : waterDepleted
        ? "water-depleted"
        : "supplied",
    firstDepletionAtSeconds: Number.isFinite(firstDepletionAtSeconds)
      ? firstDepletionAtSeconds
      : null,
    firstDepletionCause,
  };
}

function assertCityInputs(
  stocks: CityStocks,
  population: CityPopulation,
  elapsedSeconds: number,
  profile: CityNpcConsumptionProfile,
): void {
  if (stocks.cityId.length === 0 || population.cityId.length === 0) {
    throw new RangeError("cityId must not be empty");
  }
  if (stocks.cityId !== population.cityId) {
    throw new RangeError("stocks and population must reference the same cityId");
  }
  if (!Number.isFinite(stocks.foodUnits) || stocks.foodUnits < 0) {
    throw new RangeError("foodUnits must be a non-negative finite number");
  }
  if (!Number.isFinite(stocks.waterUnits) || stocks.waterUnits < 0) {
    throw new RangeError("waterUnits must be a non-negative finite number");
  }
  if (
    !Number.isSafeInteger(population.inhabitants) ||
    population.inhabitants <= 0
  ) {
    throw new RangeError("inhabitants must be a positive safe integer");
  }
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) {
    throw new RangeError("elapsedSeconds must be a non-negative finite number");
  }
  for (const [name, value] of Object.entries(profile)) {
    if (!Number.isFinite(value) || value < 0) {
      throw new RangeError(`${name} must be a non-negative finite number`);
    }
  }
}
