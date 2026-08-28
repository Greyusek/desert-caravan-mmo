import test from "node:test";
import assert from "node:assert/strict";
import {
  createTradingPrototypeScenario,
  greatCircleDistance,
  positionAtTime,
} from "../dist/src/index.js";

const SEED = "trading-001-world";

test("TRADING-001: two seeded cities expose complete seven-good markets", () => {
  const view = createTradingPrototypeScenario(SEED).playerView;

  assert.notEqual(view.markets.origin.cityId, view.markets.destination.cityId);
  assert.equal(view.markets.origin.goods.length, 7);
  assert.equal(view.markets.destination.goods.length, 7);
  for (const market of [view.markets.origin, view.markets.destination]) {
    for (const good of market.goods) {
      assert.ok(good.cityBuyPriceCredits > 0);
      assert.ok(good.citySellPriceCredits > good.cityBuyPriceCredits);
      assert.ok(good.productionUnitsPerDay >= 0);
      assert.ok(good.consumptionUnitsPerDay > 0);
    }
  }
});

test("TRADING-001: player purchase fills finite cargo and changes origin stock", () => {
  const scenario = createTradingPrototypeScenario(SEED);
  const view = scenario.playerView.playerTrade;
  const before = scenario.serverTruth.originInitialEconomy.goods.find(
    (good) => good.goodId === view.goodId,
  );
  const after = scenario.serverTruth.playerPurchase.cityEconomy.goods.find(
    (good) => good.goodId === view.goodId,
  );

  assert.equal(view.goodId, "ore");
  assert.equal(view.units, 5);
  assert.equal(view.loadedCargoUnits, view.capacityCargoUnits);
  assert.equal(view.loadedStacks[0]?.units, 5);
  assert.equal(after?.stockUnits, (before?.stockUnits ?? 0) - 5);
});

test("TRADING-001: goods move over one physical city-to-city RoutePlan", () => {
  const scenario = createTradingPrototypeScenario(SEED);
  const route = scenario.serverTruth.physicalTradeRoute;
  const halfway = positionAtTime(route, route.totalDurationSeconds / 2);
  const arrival = positionAtTime(route, route.totalDurationSeconds);

  assert.equal(scenario.serverTruth.playerInTransit.currentCityId, null);
  assert.equal(halfway.status, "moving");
  assert.ok(halfway.traveledDistanceMeters > 0);
  assert.equal(arrival.status, "arrived");
  assert.ok(
    greatCircleDistance(
      arrival.coordinate,
      scenario.serverTruth.destinationCity.position,
    ) < 0.001,
  );
});

test("TRADING-001: destination sale realizes profit and empties cargo", () => {
  const scenario = createTradingPrototypeScenario(SEED);
  const trade = scenario.playerView.playerTrade;

  assert.ok(trade.saleUnitPriceCredits > trade.purchaseUnitPriceCredits);
  assert.ok(trade.profitCredits > 0);
  assert.equal(trade.endingCredits, trade.startingCredits + trade.profitCredits);
  assert.deepEqual(trade.endingStacks, []);
  assert.deepEqual(
    trade.journal.map((event) => event.kind),
    ["purchase", "departure", "arrival", "sale"],
  );
});

test("TRADING-001: NPC reuses physical trade and changes the next player bid", () => {
  const scenario = createTradingPrototypeScenario(SEED);
  const impact = scenario.playerView.npcImpact;

  assert.deepEqual(impact.journalKinds, [
    "purchase",
    "departure",
    "arrival",
    "sale",
  ]);
  assert.ok(impact.stockAfterSale > impact.stockBeforeSale);
  assert.ok(
    impact.playerBidAfterSaleCredits < impact.playerBidBeforeSaleCredits,
  );
  assert.equal(
    scenario.serverTruth.npcTrade.inTransit.status,
    "moving",
  );
});

test("TRADING-001: information carrier physically reaches one local library", () => {
  const scenario = createTradingPrototypeScenario(SEED);
  const truth = scenario.serverTruth;
  const information = scenario.playerView.informationTrade;

  assert.equal(truth.informationCarrierHalfway.status, "moving");
  assert.equal(truth.informationCarrierArrival.status, "arrived");
  assert.ok(
    greatCircleDistance(
      truth.informationCarrierArrival.coordinate,
      truth.destinationCity.position,
    ) < 0.001,
  );
  assert.ok(
    information.arrivedAtWorldTimeSeconds >
      information.departedAtWorldTimeSeconds,
  );
  assert.equal(truth.destinationLibraryBeforeDelivery.entries.length, 0);
  assert.equal(information.depositedEntryCount, 1);
});

test("TRADING-001: local novelty, age and copy fidelity create different values", () => {
  const information = createTradingPrototypeScenario(SEED).playerView
    .informationTrade;

  assert.ok(information.novelValueCredits > 0);
  assert.ok(information.copiedValueCredits < information.novelValueCredits);
  assert.ok(information.oldValueCredits < information.novelValueCredits);
  assert.equal(information.duplicateValueCredits, 0);
  assert.equal(information.copyGeneration, 1);
  assert.equal(information.copiedFidelityFraction, 0.8);
});

test("TRADING-001: material and information routes share physical scale", () => {
  const scenario = createTradingPrototypeScenario(SEED);

  assert.equal(
    scenario.playerView.route.distanceMeters,
    scenario.playerView.informationTrade.routeDistanceMeters,
  );
  assert.equal(
    scenario.serverTruth.physicalTradeRoute,
    scenario.serverTruth.informationDeliveryRoute,
  );
});

test("TRADING-001: player view contains no server coordinates", () => {
  const serialized = JSON.stringify(
    createTradingPrototypeScenario(SEED).playerView,
  );

  assert.doesNotMatch(
    serialized,
    /latitude|longitude|coordinate|position/i,
  );
});

test("TRADING-001: identical seed and fixed actions reproduce all state", () => {
  assert.deepEqual(
    createTradingPrototypeScenario(SEED),
    createTradingPrototypeScenario(SEED),
  );
});

test("TRADING-001: another seed produces another complete trade history", () => {
  assert.notDeepEqual(
    createTradingPrototypeScenario(SEED),
    createTradingPrototypeScenario("trading-001-other-world"),
  );
});
