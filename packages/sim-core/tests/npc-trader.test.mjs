import test from "node:test";
import assert from "node:assert/strict";
import {
  createCityEconomyState,
  createRoutePlan,
  executeNpcTradeOrder,
  generateSeededWorld,
  greatCircleDistance,
  initialBearingDegrees,
  quoteCityGoodPrice,
} from "../dist/src/index.js";

function scenario() {
  const world = generateSeededWorld("trade-004-world");
  const originCity = world.cities[0];
  const destinationCity = world.cities[1];
  const originStocks = world.cityStocks[0];
  const destinationStocks = world.cityStocks[1];
  const originPopulation = world.cityPopulations[0];
  const destinationPopulation = world.cityPopulations[1];
  assert.ok(originCity && destinationCity);
  assert.ok(originStocks && destinationStocks);
  assert.ok(originPopulation && destinationPopulation);
  const withOre = (economy, stockUnits) => ({
    ...economy,
    goods: economy.goods.map((good) =>
      good.goodId === "ore"
        ? {
            ...good,
            stockUnits,
            productionUnitsPerDay: 0,
            consumptionUnitsPerDay: 1,
          }
        : good,
    ),
  });
  const route = createRoutePlan(
    originCity.position,
    [
      {
        bearingDeg: initialBearingDegrees(
          originCity.position,
          destinationCity.position,
        ),
        distanceMeters: greatCircleDistance(
          originCity.position,
          destinationCity.position,
        ),
      },
    ],
    1_000,
  );
  return {
    originEconomy: withOre(
      createCityEconomyState(world.seed, originStocks, originPopulation),
      1_000,
    ),
    destinationEconomy: withOre(
      createCityEconomyState(
        world.seed,
        destinationStocks,
        destinationPopulation,
      ),
      0,
    ),
    order: {
      npcTraderId: "npc-merchant-01",
      goodId: "ore",
      units: 20,
      startingCredits: 2_000,
      capacityCargoUnits: 40,
      departsAtWorldTimeSeconds: 0,
      originCity,
      destinationCity,
      route,
    },
  };
}

test("TRADE-004: NPC buys from the same origin market as the player", () => {
  const { originEconomy, destinationEconomy, order } = scenario();
  const before = quoteCityGoodPrice(originEconomy, "ore");
  const result = executeNpcTradeOrder(originEconomy, destinationEconomy, order);
  const after = quoteCityGoodPrice(result.originAfterPurchase, "ore");

  assert.equal(after.stockUnits, before.stockUnits - order.units);
  assert.equal(result.npcTrader.journal[0]?.kind, "purchase");
  assert.equal(result.purchaseCostCredits, before.citySellPriceCredits * 20);
});

test("TRADE-004: NPC cargo physically occupies the shared RoutePlan", () => {
  const { originEconomy, destinationEconomy, order } = scenario();
  const result = executeNpcTradeOrder(originEconomy, destinationEconomy, order);

  assert.equal(result.inTransit.status, "moving");
  assert.ok(result.inTransit.traveledDistanceMeters > 0);
  assert.ok(result.inTransit.remainingDistanceMeters > 0);
  assert.equal(
    result.inTransit.routeId,
    result.npcTrader.journal.find((event) => event.kind === "arrival")?.routeId,
  );
});

test("TRADE-004: NPC sale changes the next destination quote for the player", () => {
  const { originEconomy, destinationEconomy, order } = scenario();
  const result = executeNpcTradeOrder(originEconomy, destinationEconomy, order);

  assert.equal(result.destinationQuoteBeforeSale.stockUnits, 0);
  assert.equal(result.destinationQuoteAfterSale.stockUnits, 20);
  assert.ok(
    result.destinationQuoteAfterSale.cityBuyPriceCredits <
      result.destinationQuoteBeforeSale.cityBuyPriceCredits,
  );
  assert.ok(
    result.destinationQuoteAfterSale.citySellPriceCredits <
      result.destinationQuoteBeforeSale.citySellPriceCredits,
  );
});

test("TRADE-004: NPC uses the same journal and realized profit accounting", () => {
  const { originEconomy, destinationEconomy, order } = scenario();
  const result = executeNpcTradeOrder(originEconomy, destinationEconomy, order);

  assert.deepEqual(
    result.npcTrader.journal.map((event) => event.kind),
    ["purchase", "departure", "arrival", "sale"],
  );
  assert.equal(result.npcTrader.realizedProfitCredits, result.profitCredits);
  assert.equal(
    result.saleRevenueCredits - result.purchaseCostCredits,
    result.profitCredits,
  );
});

test("TRADE-004: identical seed and order reproduce the complete execution", () => {
  const execute = () => {
    const { originEconomy, destinationEconomy, order } = scenario();
    return executeNpcTradeOrder(originEconomy, destinationEconomy, order);
  };
  assert.deepEqual(execute(), execute());
});

test("TRADE-004: world, city and capacity boundaries are enforced", () => {
  const { originEconomy, destinationEconomy, order } = scenario();
  assert.throws(
    () =>
      executeNpcTradeOrder(
        originEconomy,
        { ...destinationEconomy, worldSeed: "another-world" },
        order,
      ),
    /share one worldSeed/,
  );
  assert.throws(
    () =>
      executeNpcTradeOrder(originEconomy, destinationEconomy, {
        ...order,
        capacityCargoUnits: 39,
      }),
    /cargo capacity/,
  );
  assert.throws(
    () =>
      executeNpcTradeOrder(
        { ...originEconomy, cityId: "wrong-city" },
        destinationEconomy,
        order,
      ),
    /match NPC trade origin/,
  );
});
