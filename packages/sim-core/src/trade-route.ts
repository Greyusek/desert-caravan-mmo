import {
  TRADE_GOODS,
  type CityEconomyState,
  type TradeGoodId,
} from "./city-economy.js";
import { quoteCityGoodPrice } from "./city-market.js";
import { DEFAULT_CITY_ARRIVAL_RADIUS_METERS } from "./city-arrival.js";
import { greatCircleDistance } from "./geometry.js";
import {
  positionAtTime,
  type DurationSeconds,
  type RoutePlan,
} from "./route.js";
import type { WorldCoordinate } from "./types.js";
import type { City } from "./world.js";

export interface TradeCargoStack {
  readonly goodId: TradeGoodId;
  readonly units: number;
  readonly costBasisCredits: number;
}

export interface TradeCargoHold {
  readonly capacityCargoUnits: number;
  readonly stacks: readonly TradeCargoStack[];
}

export type TradeJournalEvent =
  | {
      readonly id: string;
      readonly kind: "purchase";
      readonly atWorldTimeSeconds: DurationSeconds;
      readonly cityId: string;
      readonly goodId: TradeGoodId;
      readonly units: number;
      readonly unitPriceCredits: number;
      readonly creditsDelta: number;
    }
  | {
      readonly id: string;
      readonly kind: "departure";
      readonly atWorldTimeSeconds: DurationSeconds;
      readonly routeId: string;
      readonly originCityId: string;
      readonly destinationCityId: string;
      readonly cargoUnits: number;
    }
  | {
      readonly id: string;
      readonly kind: "arrival";
      readonly atWorldTimeSeconds: DurationSeconds;
      readonly routeId: string;
      readonly cityId: string;
      readonly cargoUnits: number;
    }
  | {
      readonly id: string;
      readonly kind: "sale";
      readonly atWorldTimeSeconds: DurationSeconds;
      readonly cityId: string;
      readonly goodId: TradeGoodId;
      readonly units: number;
      readonly unitPriceCredits: number;
      readonly creditsDelta: number;
      readonly costBasisCredits: number;
      readonly profitCredits: number;
    };

export interface ActiveTradeJourney {
  readonly id: string;
  readonly originCityId: string;
  readonly destinationCityId: string;
  readonly departsAtWorldTimeSeconds: DurationSeconds;
  readonly arrivesAtWorldTimeSeconds: DurationSeconds;
  readonly route: RoutePlan;
}

export interface TradeCaravanState {
  readonly id: string;
  readonly credits: number;
  readonly currentCityId: string | null;
  readonly cargo: TradeCargoHold;
  readonly activeJourney: ActiveTradeJourney | null;
  readonly realizedProfitCredits: number;
  readonly journal: readonly TradeJournalEvent[];
}

export interface TradePurchaseResult {
  readonly cityEconomy: CityEconomyState;
  readonly caravan: TradeCaravanState;
  readonly totalCostCredits: number;
}

export interface TradeSaleResult {
  readonly cityEconomy: CityEconomyState;
  readonly caravan: TradeCaravanState;
  readonly revenueCredits: number;
  readonly costBasisCredits: number;
  readonly profitCredits: number;
}

export interface TradeJourneyPosition {
  readonly routeId: string;
  readonly coordinate: WorldCoordinate;
  readonly worldTimeSeconds: DurationSeconds;
  readonly status: "scheduled" | "moving" | "arrived";
  readonly traveledDistanceMeters: number;
  readonly remainingDistanceMeters: number;
}

export function createTradeCaravanState(
  id: string,
  cityId: string,
  credits: number,
  capacityCargoUnits: number,
): TradeCaravanState {
  assertNonEmptyString(id, "id");
  assertNonEmptyString(cityId, "cityId");
  assertNonNegativeFinite(credits, "credits");
  assertPositiveFinite(capacityCargoUnits, "capacityCargoUnits");
  return {
    id,
    credits,
    currentCityId: cityId,
    cargo: { capacityCargoUnits, stacks: [] },
    activeJourney: null,
    realizedProfitCredits: 0,
    journal: [],
  };
}

export function usedCargoCapacity(cargo: TradeCargoHold): number {
  assertCargo(cargo);
  return roundCredits(
    cargo.stacks.reduce(
      (total, stack) => total + stack.units * cargoSize(stack.goodId),
      0,
    ),
  );
}

export function buyGoodFromCity(
  cityEconomy: CityEconomyState,
  caravan: TradeCaravanState,
  goodId: TradeGoodId,
  units: number,
  atWorldTimeSeconds: DurationSeconds,
): TradePurchaseResult {
  assertTransactionContext(cityEconomy, caravan, atWorldTimeSeconds);
  assertPositiveSafeInteger(units, "units");
  const quote = quoteCityGoodPrice(cityEconomy, goodId);
  if (quote.stockUnits < units) {
    throw new RangeError("city does not have enough stock for purchase");
  }
  const requiredCapacity = units * cargoSize(goodId);
  if (
    usedCargoCapacity(caravan.cargo) + requiredCapacity >
    caravan.cargo.capacityCargoUnits + 1e-9
  ) {
    throw new RangeError("purchase exceeds caravan cargo capacity");
  }
  const totalCostCredits = quote.citySellPriceCredits * units;
  if (caravan.credits < totalCostCredits) {
    throw new RangeError("caravan does not have enough credits");
  }
  const cargo = addCargo(
    caravan.cargo,
    goodId,
    units,
    totalCostCredits,
  );
  const event: TradeJournalEvent = {
    id: `trade-${caravan.id}-event-${caravan.journal.length + 1}`,
    kind: "purchase",
    atWorldTimeSeconds,
    cityId: cityEconomy.cityId,
    goodId,
    units,
    unitPriceCredits: quote.citySellPriceCredits,
    creditsDelta: -totalCostCredits,
  };

  return {
    cityEconomy: changeCityStock(cityEconomy, goodId, -units),
    caravan: {
      ...caravan,
      credits: caravan.credits - totalCostCredits,
      cargo,
      journal: [...caravan.journal, event],
    },
    totalCostCredits,
  };
}

export function beginTradeJourney(
  caravan: TradeCaravanState,
  originCity: City,
  destinationCity: City,
  route: RoutePlan,
  departsAtWorldTimeSeconds: DurationSeconds,
): TradeCaravanState {
  assertCaravan(caravan);
  assertNonNegativeFinite(
    departsAtWorldTimeSeconds,
    "departsAtWorldTimeSeconds",
  );
  if (caravan.activeJourney !== null) {
    throw new RangeError("caravan already has an active trade journey");
  }
  if (caravan.currentCityId !== originCity.id) {
    throw new RangeError("caravan must depart from its current city");
  }
  if (originCity.id === destinationCity.id) {
    throw new RangeError("trade journey destination must differ from origin");
  }
  if (
    greatCircleDistance(route.start, originCity.position) >
    DEFAULT_CITY_ARRIVAL_RADIUS_METERS
  ) {
    throw new RangeError("trade route must start inside the origin city");
  }
  if (
    greatCircleDistance(route.end, destinationCity.position) >
    DEFAULT_CITY_ARRIVAL_RADIUS_METERS
  ) {
    throw new RangeError("trade route must end inside the destination city");
  }
  const routeId = `trade-route-${caravan.id}-${caravan.journal.length + 1}`;
  const activeJourney: ActiveTradeJourney = {
    id: routeId,
    originCityId: originCity.id,
    destinationCityId: destinationCity.id,
    departsAtWorldTimeSeconds,
    arrivesAtWorldTimeSeconds:
      departsAtWorldTimeSeconds + route.totalDurationSeconds,
    route,
  };
  const event: TradeJournalEvent = {
    id: `trade-${caravan.id}-event-${caravan.journal.length + 1}`,
    kind: "departure",
    atWorldTimeSeconds: departsAtWorldTimeSeconds,
    routeId,
    originCityId: originCity.id,
    destinationCityId: destinationCity.id,
    cargoUnits: usedCargoCapacity(caravan.cargo),
  };
  return {
    ...caravan,
    currentCityId: null,
    activeJourney,
    journal: [...caravan.journal, event],
  };
}

export function tradeJourneyPositionAtWorldTime(
  caravan: TradeCaravanState,
  worldTimeSeconds: DurationSeconds,
): TradeJourneyPosition {
  assertCaravan(caravan);
  assertNonNegativeFinite(worldTimeSeconds, "worldTimeSeconds");
  const journey = caravan.activeJourney;
  if (!journey) throw new RangeError("caravan has no active trade journey");
  const routeElapsedSeconds = Math.max(
    0,
    worldTimeSeconds - journey.departsAtWorldTimeSeconds,
  );
  const position = positionAtTime(journey.route, routeElapsedSeconds);
  return {
    routeId: journey.id,
    coordinate: position.coordinate,
    worldTimeSeconds,
    status:
      worldTimeSeconds < journey.departsAtWorldTimeSeconds
        ? "scheduled"
        : position.status,
    traveledDistanceMeters: position.traveledDistanceMeters,
    remainingDistanceMeters: position.remainingDistanceMeters,
  };
}

export function arriveTradeJourney(
  caravan: TradeCaravanState,
  worldTimeSeconds: DurationSeconds,
): TradeCaravanState {
  assertCaravan(caravan);
  assertNonNegativeFinite(worldTimeSeconds, "worldTimeSeconds");
  const journey = caravan.activeJourney;
  if (!journey) throw new RangeError("caravan has no active trade journey");
  if (worldTimeSeconds < journey.arrivesAtWorldTimeSeconds) {
    throw new RangeError("trade caravan cannot arrive before route completion");
  }
  const event: TradeJournalEvent = {
    id: `trade-${caravan.id}-event-${caravan.journal.length + 1}`,
    kind: "arrival",
    atWorldTimeSeconds: journey.arrivesAtWorldTimeSeconds,
    routeId: journey.id,
    cityId: journey.destinationCityId,
    cargoUnits: usedCargoCapacity(caravan.cargo),
  };
  return {
    ...caravan,
    currentCityId: journey.destinationCityId,
    activeJourney: null,
    journal: [...caravan.journal, event],
  };
}

export function sellGoodToCity(
  cityEconomy: CityEconomyState,
  caravan: TradeCaravanState,
  goodId: TradeGoodId,
  units: number,
  atWorldTimeSeconds: DurationSeconds,
): TradeSaleResult {
  assertTransactionContext(cityEconomy, caravan, atWorldTimeSeconds);
  assertPositiveSafeInteger(units, "units");
  const stack = caravan.cargo.stacks.find(
    (candidate) => candidate.goodId === goodId,
  );
  if (!stack || stack.units < units) {
    throw new RangeError("caravan does not have enough cargo to sell");
  }
  const quote = quoteCityGoodPrice(cityEconomy, goodId);
  const revenueCredits = quote.cityBuyPriceCredits * units;
  const costBasisCredits = roundCredits(
    (stack.costBasisCredits * units) / stack.units,
  );
  const profitCredits = roundCredits(revenueCredits - costBasisCredits);
  const event: TradeJournalEvent = {
    id: `trade-${caravan.id}-event-${caravan.journal.length + 1}`,
    kind: "sale",
    atWorldTimeSeconds,
    cityId: cityEconomy.cityId,
    goodId,
    units,
    unitPriceCredits: quote.cityBuyPriceCredits,
    creditsDelta: revenueCredits,
    costBasisCredits,
    profitCredits,
  };

  return {
    cityEconomy: changeCityStock(cityEconomy, goodId, units),
    caravan: {
      ...caravan,
      credits: caravan.credits + revenueCredits,
      cargo: removeCargo(caravan.cargo, goodId, units, costBasisCredits),
      realizedProfitCredits: roundCredits(
        caravan.realizedProfitCredits + profitCredits,
      ),
      journal: [...caravan.journal, event],
    },
    revenueCredits,
    costBasisCredits,
    profitCredits,
  };
}

function addCargo(
  cargo: TradeCargoHold,
  goodId: TradeGoodId,
  units: number,
  costBasisCredits: number,
): TradeCargoHold {
  const existing = cargo.stacks.find((stack) => stack.goodId === goodId);
  const stacks = existing
    ? cargo.stacks.map((stack) =>
        stack.goodId === goodId
          ? {
              ...stack,
              units: stack.units + units,
              costBasisCredits: roundCredits(
                stack.costBasisCredits + costBasisCredits,
              ),
            }
          : stack,
      )
    : [...cargo.stacks, { goodId, units, costBasisCredits }];
  return {
    ...cargo,
    stacks: [...stacks].sort((first, second) =>
      first.goodId < second.goodId ? -1 : first.goodId > second.goodId ? 1 : 0,
    ),
  };
}

function removeCargo(
  cargo: TradeCargoHold,
  goodId: TradeGoodId,
  units: number,
  costBasisCredits: number,
): TradeCargoHold {
  return {
    ...cargo,
    stacks: cargo.stacks.flatMap((stack) => {
      if (stack.goodId !== goodId) return [stack];
      const remainingUnits = stack.units - units;
      return remainingUnits === 0
        ? []
        : [
            {
              ...stack,
              units: remainingUnits,
              costBasisCredits: roundCredits(
                stack.costBasisCredits - costBasisCredits,
              ),
            },
          ];
    }),
  };
}

function changeCityStock(
  economy: CityEconomyState,
  goodId: TradeGoodId,
  deltaUnits: number,
): CityEconomyState {
  return {
    ...economy,
    goods: economy.goods.map((good) =>
      good.goodId === goodId
        ? { ...good, stockUnits: roundCredits(good.stockUnits + deltaUnits) }
        : good,
    ),
  };
}

function cargoSize(goodId: TradeGoodId): number {
  const good = TRADE_GOODS.find((candidate) => candidate.id === goodId);
  if (!good) throw new RangeError(`unknown trade good ${goodId}`);
  return good.cargoUnitsPerUnit;
}

function assertTransactionContext(
  cityEconomy: CityEconomyState,
  caravan: TradeCaravanState,
  atWorldTimeSeconds: DurationSeconds,
): void {
  assertCaravan(caravan);
  assertNonNegativeFinite(atWorldTimeSeconds, "atWorldTimeSeconds");
  if (caravan.activeJourney !== null) {
    throw new RangeError("transactions require a caravan inside a city");
  }
  if (caravan.currentCityId !== cityEconomy.cityId) {
    throw new RangeError("caravan and market must be in the same city");
  }
  if (atWorldTimeSeconds !== cityEconomy.updatedAtWorldTimeSeconds) {
    throw new RangeError("market must be projected to transaction world time");
  }
}

function assertCaravan(caravan: TradeCaravanState): void {
  assertNonEmptyString(caravan.id, "caravan.id");
  assertNonNegativeFinite(caravan.credits, "caravan.credits");
  assertCargo(caravan.cargo);
  if (!Array.isArray(caravan.journal)) {
    throw new TypeError("caravan.journal must be an array");
  }
}

function assertCargo(cargo: TradeCargoHold): void {
  assertPositiveFinite(cargo.capacityCargoUnits, "cargo.capacityCargoUnits");
  if (!Array.isArray(cargo.stacks)) {
    throw new TypeError("cargo.stacks must be an array");
  }
  const ids = cargo.stacks.map((stack) => stack.goodId);
  if (new Set(ids).size !== ids.length) {
    throw new RangeError("cargo stacks must have unique goods");
  }
  for (const stack of cargo.stacks) {
    assertPositiveSafeInteger(stack.units, "cargo stack units");
    assertNonNegativeFinite(
      stack.costBasisCredits,
      "cargo stack costBasisCredits",
    );
    cargoSize(stack.goodId);
  }
}

function roundCredits(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function assertPositiveSafeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive safe integer`);
  }
}

function assertPositiveFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive finite number`);
  }
}

function assertNonNegativeFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative finite number`);
  }
}

function assertNonEmptyString(value: string, name: string): void {
  if (typeof value !== "string" || value.length === 0) {
    throw new RangeError(`${name} must not be empty`);
  }
}
