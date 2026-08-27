import {
  DEFAULT_CITY_NPC_CONSUMPTION,
  SECONDS_PER_CITY_DAY,
} from "./city-resources.js";
import type { DurationSeconds } from "./route.js";
import type { CityPopulation, CityStocks } from "./world.js";

export const TRADE_GOOD_IDS = [
  "food",
  "water",
  "salt",
  "textiles",
  "ore",
  "medicine",
  "tools",
] as const;

export type TradeGoodId = (typeof TRADE_GOOD_IDS)[number];

export interface TradeGoodDefinition {
  readonly id: TradeGoodId;
  readonly name: string;
  readonly role: string;
  readonly cargoUnitsPerUnit: number;
}

export const TRADE_GOODS: readonly TradeGoodDefinition[] = Object.freeze([
  { id: "food", name: "Food", role: "daily survival", cargoUnitsPerUnit: 1 },
  { id: "water", name: "Water", role: "daily survival", cargoUnitsPerUnit: 1 },
  { id: "salt", name: "Salt", role: "preservation", cargoUnitsPerUnit: 0.25 },
  { id: "textiles", name: "Textiles", role: "clothing and shelter", cargoUnitsPerUnit: 0.5 },
  { id: "ore", name: "Ore", role: "raw material", cargoUnitsPerUnit: 2 },
  { id: "medicine", name: "Medicine", role: "health and recovery", cargoUnitsPerUnit: 0.1 },
  { id: "tools", name: "Tools", role: "production support", cargoUnitsPerUnit: 1.5 },
]);

export interface CityGoodEconomy {
  readonly goodId: TradeGoodId;
  readonly stockUnits: number;
  readonly producedUnits: number;
  readonly consumedUnits: number;
  readonly unmetConsumptionUnits: number;
  readonly productionUnitsPerDay: number;
  readonly consumptionUnitsPerDay: number;
}

export interface CityEconomyState {
  readonly worldSeed: string;
  readonly cityId: string;
  readonly population: number;
  readonly updatedAtWorldTimeSeconds: DurationSeconds;
  readonly goods: readonly CityGoodEconomy[];
}

const CONSUMPTION_UNITS_PER_PERSON_PER_DAY: Readonly<
  Record<TradeGoodId, number>
> = Object.freeze({
  food: DEFAULT_CITY_NPC_CONSUMPTION.foodUnitsPerPersonPerDay,
  water: DEFAULT_CITY_NPC_CONSUMPTION.waterUnitsPerPersonPerDay,
  salt: 0.05,
  textiles: 0.02,
  ore: 0.01,
  medicine: 0.01,
  tools: 0.005,
});

const INITIAL_STOCK_DAYS: Readonly<Record<TradeGoodId, number>> = Object.freeze({
  food: 0,
  water: 0,
  salt: 40,
  textiles: 60,
  ore: 80,
  medicine: 45,
  tools: 90,
});

/**
 * TRADE-001 creates one finite seven-good economy without replacing CITY-001.
 * Food/water start at the exact seeded CityStocks values and every daily rate
 * is derived from the existing aggregate population. A namespaced seed stream
 * selects one guaranteed surplus and one guaranteed deficit good per city.
 */
export function createCityEconomyState(
  worldSeed: string,
  stocks: CityStocks,
  population: CityPopulation,
  worldTimeSeconds: DurationSeconds = 0,
): CityEconomyState {
  assertNonEmptyString(worldSeed, "worldSeed");
  assertCityInputs(stocks, population);
  assertNonNegativeFinite(worldTimeSeconds, "worldTimeSeconds");

  const specializationIndex =
    hashSeed(`${worldSeed}:city-economy:${stocks.cityId}:surplus`) %
    TRADE_GOOD_IDS.length;
  let deficitIndex =
    hashSeed(`${worldSeed}:city-economy:${stocks.cityId}:deficit`) %
    TRADE_GOOD_IDS.length;
  if (deficitIndex === specializationIndex) {
    deficitIndex = (deficitIndex + 1) % TRADE_GOOD_IDS.length;
  }

  const goods = TRADE_GOOD_IDS.map((goodId, index): CityGoodEconomy => {
    const consumptionUnitsPerDay =
      population.inhabitants * CONSUMPTION_UNITS_PER_PERSON_PER_DAY[goodId];
    const ordinaryFactor =
      0.8 +
      seededUnitFraction(
        `${worldSeed}:city-economy:${stocks.cityId}:${goodId}:production`,
      ) *
        0.4;
    const productionFactor =
      index === specializationIndex
        ? 1.5
        : index === deficitIndex
          ? 0.5
          : ordinaryFactor;
    const stockUnits =
      goodId === "food"
        ? stocks.foodUnits
        : goodId === "water"
          ? stocks.waterUnits
          : consumptionUnitsPerDay *
            INITIAL_STOCK_DAYS[goodId] *
            (0.8 +
              seededUnitFraction(
                `${worldSeed}:city-economy:${stocks.cityId}:${goodId}:stock`,
              ) *
                0.4);

    return {
      goodId,
      stockUnits: roundUnits(stockUnits),
      producedUnits: 0,
      consumedUnits: 0,
      unmetConsumptionUnits: 0,
      productionUnitsPerDay: roundUnits(
        consumptionUnitsPerDay * productionFactor,
      ),
      consumptionUnitsPerDay: roundUnits(consumptionUnitsPerDay),
    };
  });

  const initial: CityEconomyState = {
    worldSeed,
    cityId: stocks.cityId,
    population: population.inhabitants,
    updatedAtWorldTimeSeconds: 0,
    goods,
  };
  return advanceCityEconomyToWorldTime(initial, worldTimeSeconds);
}

/** Advances immutable finite stocks from their last authoritative timestamp. */
export function advanceCityEconomyToWorldTime(
  state: CityEconomyState,
  worldTimeSeconds: DurationSeconds,
): CityEconomyState {
  assertCityEconomyState(state);
  assertNonNegativeFinite(worldTimeSeconds, "worldTimeSeconds");
  if (worldTimeSeconds < state.updatedAtWorldTimeSeconds) {
    throw new RangeError("worldTimeSeconds must not rewind city economy");
  }
  const elapsedDays =
    (worldTimeSeconds - state.updatedAtWorldTimeSeconds) /
    SECONDS_PER_CITY_DAY;
  if (elapsedDays === 0) return state;

  return {
    ...state,
    updatedAtWorldTimeSeconds: worldTimeSeconds,
    goods: state.goods.map((good): CityGoodEconomy => {
      const producedUnits = good.productionUnitsPerDay * elapsedDays;
      const requestedConsumptionUnits =
        good.consumptionUnitsPerDay * elapsedDays;
      const availableUnits = good.stockUnits + producedUnits;
      const consumedUnits = Math.min(
        availableUnits,
        requestedConsumptionUnits,
      );
      return {
        ...good,
        stockUnits: roundUnits(availableUnits - consumedUnits),
        producedUnits: roundUnits(good.producedUnits + producedUnits),
        consumedUnits: roundUnits(good.consumedUnits + consumedUnits),
        unmetConsumptionUnits: roundUnits(
          good.unmetConsumptionUnits +
            requestedConsumptionUnits -
            consumedUnits,
        ),
      };
    }),
  };
}

export function cityGood(
  state: CityEconomyState,
  goodId: TradeGoodId,
): CityGoodEconomy {
  const good = state.goods.find((candidate) => candidate.goodId === goodId);
  if (!good) throw new RangeError(`city economy is missing good ${goodId}`);
  return good;
}

function assertCityEconomyState(state: CityEconomyState): void {
  assertNonEmptyString(state.worldSeed, "state.worldSeed");
  assertNonEmptyString(state.cityId, "state.cityId");
  assertNonNegativeFinite(
    state.updatedAtWorldTimeSeconds,
    "state.updatedAtWorldTimeSeconds",
  );
  if (!Number.isSafeInteger(state.population) || state.population <= 0) {
    throw new RangeError("state.population must be a positive safe integer");
  }
  if (!Array.isArray(state.goods) || state.goods.length !== TRADE_GOOD_IDS.length) {
    throw new RangeError("state.goods must contain every trade good exactly once");
  }
  const ids = state.goods.map((good) => good.goodId);
  if (new Set(ids).size !== TRADE_GOOD_IDS.length) {
    throw new RangeError("state.goods must contain unique trade goods");
  }
  for (const goodId of TRADE_GOOD_IDS) {
    if (!ids.includes(goodId)) {
      throw new RangeError(`state.goods must contain ${goodId}`);
    }
  }
  for (const good of state.goods) {
    for (const [name, value] of Object.entries(good)) {
      if (name === "goodId") continue;
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
        throw new RangeError(`${name} must be a non-negative finite number`);
      }
    }
  }
}

function assertCityInputs(
  stocks: CityStocks,
  population: CityPopulation,
): void {
  assertNonEmptyString(stocks.cityId, "stocks.cityId");
  assertNonEmptyString(population.cityId, "population.cityId");
  if (stocks.cityId !== population.cityId) {
    throw new RangeError("stocks and population must reference the same cityId");
  }
  for (const [name, value] of [
    ["stocks.foodUnits", stocks.foodUnits],
    ["stocks.waterUnits", stocks.waterUnits],
  ] as const) {
    assertNonNegativeFinite(value, name);
  }
  if (
    !Number.isSafeInteger(population.inhabitants) ||
    population.inhabitants <= 0
  ) {
    throw new RangeError("population.inhabitants must be a positive safe integer");
  }
}

function seededUnitFraction(seed: string): number {
  return hashSeed(seed) / 0xffff_ffff;
}

function hashSeed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function roundUnits(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function assertNonEmptyString(value: string, name: string): void {
  if (typeof value !== "string" || value.length === 0) {
    throw new RangeError(`${name} must not be empty`);
  }
}

function assertNonNegativeFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative finite number`);
  }
}
