import test from "node:test";
import assert from "node:assert/strict";
import {
  beginTradeJourney,
  buyGoodFromCity,
  createCityEconomyState,
  createRoutePlan,
  createTradeCaravanState,
  generateSeededWorld,
  greatCircleDistance,
  initialBearingDegrees,
  quoteCityGoodPrice,
  sellGoodToCity,
  tradeJourneyPositionAtWorldTime,
  arriveTradeJourney,
  usedCargoCapacity,
} from "../dist/src/index.js";

function scenario() {
  const world = generateSeededWorld("trade-003-world");
  const origin = world.cities[0];
  const destination = world.cities[1];
  const originStocks = world.cityStocks[0];
  const destinationStocks = world.cityStocks[1];
  const originPopulation = world.cityPopulations[0];
  const destinationPopulation = world.cityPopulations[1];
  assert.ok(origin && destination);
  assert.ok(originStocks && destinationStocks);
  assert.ok(originPopulation && destinationPopulation);
  const makeEconomy = (stocks, population, oreStockUnits) => {
    const economy = createCityEconomyState(
      world.seed,
      stocks,
      population,
    );
    return {
      ...economy,
      goods: economy.goods.map((good) =>
        good.goodId === "ore" ? { ...good, stockUnits: oreStockUnits } : good,
      ),
    };
  };
  const route = createRoutePlan(
    origin.position,
    [
      {
        bearingDeg: initialBearingDegrees(origin.position, destination.position),
        distanceMeters: greatCircleDistance(origin.position, destination.position),
      },
    ],
    10,
  );
  return {
    origin,
    destination,
    originEconomy: makeEconomy(originStocks, originPopulation, 1_000_000),
    destinationEconomy: makeEconomy(
      destinationStocks,
      destinationPopulation,
      0,
    ),
    route,
    caravan: createTradeCaravanState("player-caravan", origin.id, 1_000, 20),
  };
}

test("TRADE-003: empty cargo exposes finite capacity", () => {
  const { caravan } = scenario();
  assert.equal(usedCargoCapacity(caravan.cargo), 0);
  assert.equal(caravan.cargo.capacityCargoUnits, 20);
  assert.deepEqual(caravan.cargo.stacks, []);
});

test("TRADE-003: local purchase changes the same city stock, wallet and cargo", () => {
  const { originEconomy, caravan } = scenario();
  const beforeQuote = quoteCityGoodPrice(originEconomy, "ore");
  const result = buyGoodFromCity(originEconomy, caravan, "ore", 10, 0);

  assert.equal(result.totalCostCredits, beforeQuote.citySellPriceCredits * 10);
  assert.equal(result.caravan.credits, caravan.credits - result.totalCostCredits);
  assert.equal(usedCargoCapacity(result.caravan.cargo), 20);
  assert.equal(result.caravan.cargo.stacks[0]?.units, 10);
  assert.equal(
    result.cityEconomy.goods.find((good) => good.goodId === "ore")?.stockUnits,
    999_990,
  );
  assert.equal(result.caravan.journal[0]?.kind, "purchase");
});

test("TRADE-003: capacity, stock and wallet prevent impossible loading", () => {
  const { originEconomy, caravan } = scenario();
  assert.throws(
    () => buyGoodFromCity(originEconomy, caravan, "ore", 11, 0),
    /cargo capacity/,
  );
  assert.throws(
    () =>
      buyGoodFromCity(
        {
          ...originEconomy,
          goods: originEconomy.goods.map((good) =>
            good.goodId === "ore" ? { ...good, stockUnits: 1 } : good,
          ),
        },
        caravan,
        "ore",
        2,
        0,
      ),
    /enough stock/,
  );
  assert.throws(
    () =>
      buyGoodFromCity(
        originEconomy,
        { ...caravan, credits: 1 },
        "ore",
        1,
        0,
      ),
    /enough credits/,
  );
});

test("TRADE-003: departure creates one physical route-backed journey", () => {
  const { origin, destination, originEconomy, route, caravan } = scenario();
  const purchased = buyGoodFromCity(originEconomy, caravan, "ore", 10, 0);
  const travelling = beginTradeJourney(
    purchased.caravan,
    origin,
    destination,
    route,
    100,
  );

  assert.equal(travelling.currentCityId, null);
  assert.equal(travelling.activeJourney?.route, route);
  assert.equal(
    travelling.activeJourney?.arrivesAtWorldTimeSeconds,
    100 + route.totalDurationSeconds,
  );
  assert.equal(travelling.journal[1]?.kind, "departure");
});

test("TRADE-003: cargo moves on the route and cannot arrive early", () => {
  const { origin, destination, originEconomy, route, caravan } = scenario();
  const purchased = buyGoodFromCity(originEconomy, caravan, "ore", 10, 0);
  const travelling = beginTradeJourney(
    purchased.caravan,
    origin,
    destination,
    route,
    100,
  );
  const halfway = tradeJourneyPositionAtWorldTime(
    travelling,
    100 + route.totalDurationSeconds / 2,
  );

  assert.equal(halfway.status, "moving");
  assert.ok(halfway.traveledDistanceMeters > 0);
  assert.ok(halfway.remainingDistanceMeters > 0);
  assert.throws(
    () => arriveTradeJourney(travelling, 100 + route.totalDurationSeconds - 1),
    /cannot arrive before/,
  );
});

test("TRADE-003: completed route arrives at the destination with cargo intact", () => {
  const { origin, destination, originEconomy, route, caravan } = scenario();
  const purchased = buyGoodFromCity(originEconomy, caravan, "ore", 10, 0);
  const travelling = beginTradeJourney(
    purchased.caravan,
    origin,
    destination,
    route,
    100,
  );
  const arrived = arriveTradeJourney(
    travelling,
    100 + route.totalDurationSeconds,
  );

  assert.equal(arrived.currentCityId, destination.id);
  assert.equal(arrived.activeJourney, null);
  assert.equal(arrived.cargo.stacks[0]?.units, 10);
  assert.equal(arrived.journal[2]?.kind, "arrival");
});

test("TRADE-003: destination sale changes stock and records route profit", () => {
  const {
    origin,
    destination,
    originEconomy,
    destinationEconomy,
    route,
    caravan,
  } = scenario();
  const purchased = buyGoodFromCity(originEconomy, caravan, "ore", 10, 0);
  const travelling = beginTradeJourney(
    purchased.caravan,
    origin,
    destination,
    route,
    100,
  );
  const arrivalTime = 100 + route.totalDurationSeconds;
  const arrived = arriveTradeJourney(travelling, arrivalTime);
  const sale = sellGoodToCity(
    { ...destinationEconomy, updatedAtWorldTimeSeconds: arrivalTime },
    arrived,
    "ore",
    10,
    arrivalTime,
  );

  assert.equal(sale.revenueCredits, 540);
  assert.equal(sale.costBasisCredits, purchased.totalCostCredits);
  assert.equal(sale.profitCredits, 430);
  assert.equal(sale.caravan.realizedProfitCredits, 430);
  assert.equal(usedCargoCapacity(sale.caravan.cargo), 0);
  assert.equal(sale.cityEconomy.goods.find((g) => g.goodId === "ore")?.stockUnits, 10);
  assert.equal(sale.caravan.journal[3]?.kind, "sale");
});

test("TRADE-003: identical actions reproduce the complete trade result", () => {
  const execute = () => {
    const {
      origin,
      destination,
      originEconomy,
      destinationEconomy,
      route,
      caravan,
    } = scenario();
    const purchased = buyGoodFromCity(originEconomy, caravan, "ore", 10, 0);
    const travelling = beginTradeJourney(
      purchased.caravan,
      origin,
      destination,
      route,
      100,
    );
    const arrivalTime = 100 + route.totalDurationSeconds;
    const arrived = arriveTradeJourney(travelling, arrivalTime);
    return sellGoodToCity(
      { ...destinationEconomy, updatedAtWorldTimeSeconds: arrivalTime },
      arrived,
      "ore",
      10,
      arrivalTime,
    );
  };

  assert.deepEqual(execute(), execute());
});

test("TRADE-003: route endpoints must physically connect the selected cities", () => {
  const { origin, destination, originEconomy, route, caravan } = scenario();
  const purchased = buyGoodFromCity(originEconomy, caravan, "ore", 1, 0);
  const reversed = createRoutePlan(
    destination.position,
    [
      {
        bearingDeg: initialBearingDegrees(destination.position, origin.position),
        distanceMeters: greatCircleDistance(destination.position, origin.position),
      },
    ],
    10,
  );
  assert.throws(
    () =>
      beginTradeJourney(
        purchased.caravan,
        origin,
        destination,
        reversed,
        0,
      ),
    /start inside the origin/,
  );
  assert.throws(
    () =>
      beginTradeJourney(
        purchased.caravan,
        origin,
        destination,
        route,
        -1,
      ),
    /departsAtWorldTimeSeconds/,
  );
});

test("TRADE-003: transactions require one city and one authoritative time", () => {
  const { destinationEconomy, originEconomy, caravan } = scenario();
  assert.throws(
    () => buyGoodFromCity(destinationEconomy, caravan, "ore", 1, 0),
    /same city/,
  );
  assert.throws(
    () => buyGoodFromCity(originEconomy, caravan, "ore", 1, 1),
    /projected to transaction world time/,
  );
  assert.throws(
    () => sellGoodToCity(originEconomy, caravan, "ore", 1, 0),
    /enough cargo/,
  );
});
