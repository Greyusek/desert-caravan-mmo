import assert from "node:assert/strict";
import test from "node:test";

import { createPlayerSessionController } from "../dist/src/index.js";

const SESSION_SEED = "player-projection-test";

test("PLAYER-PROJECTION-001: initial view exposes only available player screens and actions", () => {
  const view = createPlayerSessionController(SESSION_SEED).getView();

  assert.equal(view.revision, 0);
  assert.equal(view.phase, "city");
  assert.deepEqual(
    view.screens.map((screen) => [screen.id, screen.available]),
    [
      ["global", true],
      ["city", true],
      ["preparation", true],
      ["battle", false],
      ["result", false],
    ],
  );
  assert.deepEqual(view.availableActions, [
    {
      kind: "SELECT_DESTINATION",
      label: "Plan route to North Camp",
      destinationRefs: ["place:north-camp"],
    },
  ]);
});

test("PLAYER-PROJECTION-001: known map is north-up and uses relative player coordinates", () => {
  const view = createPlayerSessionController(SESSION_SEED).getView();

  assert.equal(view.map.orientation, "north-up");
  assert.equal(view.map.currentPlaceRef, "place:south-camp");
  assert.deepEqual(view.map.places, [
    {
      ref: "place:south-camp",
      name: "South Camp",
      kind: "city",
      eastMeters: 0,
      northMeters: 0,
    },
    {
      ref: "place:north-camp",
      name: "North Camp",
      kind: "city",
      eastMeters: 0,
      northMeters: 2_000,
    },
  ]);
  assert.equal(view.map.route, null);
});

test("PLAYER-PROJECTION-001: city market exposes quotes without economy formula inputs", () => {
  const city = createPlayerSessionController(SESSION_SEED).getView().city;

  assert.ok(city);
  assert.equal(city.market.length, 7);
  assert.deepEqual(Object.keys(city.market[0]).sort(), [
    "cityBuyPriceCredits",
    "citySellPriceCredits",
    "goodId",
    "stockUnits",
  ]);
  assert.ok(
    city.market.every(
      (quote) => quote.citySellPriceCredits > quote.cityBuyPriceCredits,
    ),
  );
});

test("PLAYER-PROJECTION-001: caravan projection removes cost basis and internal member identities", () => {
  const { caravan } = createPlayerSessionController(SESSION_SEED).getView();

  assert.deepEqual(caravan.cargo, {
    capacityCargoUnits: 20,
    usedCargoUnits: 10.2,
    freeCargoUnits: 9.8,
    stacks: [
      { goodId: "ore", units: 5 },
      { goodId: "medicine", units: 2 },
    ],
  });
  assert.deepEqual(
    caravan.members.map((member) => [member.ref, member.role, member.health]),
    [
      ["member:guard", "guard", 12],
      ["member:skirmisher", "skirmisher", 8],
    ],
  );
});

test("PLAYER-PROJECTION-001: destination selection creates an authoritative planned route", () => {
  const ready = createPlayerSessionController(SESSION_SEED)
    .dispatch({
      kind: "SELECT_DESTINATION",
      destinationRef: "place:north-camp",
    })
    .getView();

  assert.equal(ready.revision, 1);
  assert.equal(ready.phase, "ready");
  assert.deepEqual(ready.map.route, {
    originRef: "place:south-camp",
    destinationRef: "place:north-camp",
    distanceMeters: 2_000,
    durationSeconds: 200,
    speedMetersPerSecond: 10,
    status: "planned",
    progressFraction: 0,
    etaSeconds: 200,
  });
  assert.deepEqual(ready.availableActions, [
    { kind: "START_JOURNEY", label: "Start journey" },
  ]);
  assert.deepEqual(
    ready.journal.map((entry) => entry.kind),
    ["session-ready", "route-planned"],
  );
});

test("PLAYER-PROJECTION-001: journey starts through trade-route state and closes city actions", () => {
  const travelling = createTravellingController().getView();

  assert.equal(travelling.revision, 2);
  assert.equal(travelling.phase, "travelling");
  assert.equal(travelling.map.currentPlaceRef, null);
  assert.equal(travelling.map.route?.status, "moving");
  assert.equal(travelling.map.route?.etaSeconds, 200);
  assert.equal(travelling.city, null);
  assert.deepEqual(travelling.availableActions, []);
  assert.deepEqual(
    travelling.journal.map((entry) => entry.kind),
    ["session-ready", "route-planned", "departure"],
  );
  assert.equal(
    travelling.screens.find((screen) => screen.id === "city")?.available,
    false,
  );
});

test("PLAYER-PROJECTION-001: invalid destinations and action order are rejected", () => {
  const session = createPlayerSessionController(SESSION_SEED);

  assert.throws(
    () =>
      session.dispatch({
        kind: "SELECT_DESTINATION",
        destinationRef: "place:unknown",
      }),
    /destination is not known/,
  );
  assert.throws(
    () => session.dispatch({ kind: "START_JOURNEY" }),
    /after route preparation/,
  );
  assert.throws(
    () => session.dispatch({ kind: "UNSUPPORTED" }),
    /unsupported player action/,
  );
});

test("PLAYER-PROJECTION-001: private controller state cannot be serialized", () => {
  const session = createPlayerSessionController(SESSION_SEED);

  assert.equal(JSON.stringify(session), "{}");
  assert.deepEqual(Object.getOwnPropertyNames(session).sort(), [
    "dispatch",
    "getView",
  ]);
});

test("PLAYER-PROJECTION-001: pre-contact views contain no hidden encounter data", () => {
  for (const view of [
    createPlayerSessionController(SESSION_SEED).getView(),
    createTravellingController().getView(),
  ]) {
    const serialized = JSON.stringify(view).toLowerCase();
    for (const forbidden of [
      "monster",
      "patrol",
      "battlefield",
      "battleid",
      "creature",
      "contactposition",
    ]) {
      assert.equal(serialized.includes(forbidden), false, forbidden);
    }
  }
});

test("PLAYER-PROJECTION-001: serialized view excludes server-truth fields", () => {
  const views = [
    createPlayerSessionController(SESSION_SEED).getView(),
    createTravellingController().getView(),
  ];
  const forbiddenKeys = new Set([
    "latitudeDeg",
    "longitudeDeg",
    "worldSeed",
    "seed",
    "cityId",
    "routeId",
    "battleId",
    "costBasisCredits",
    "targetStockUnits",
    "stockCoverageDays",
    "scarcityMultiplier",
    "consumptionUnitsPerDay",
    "productionUnitsPerDay",
  ]);

  for (const view of views) {
    visitKeys(view, (key) => assert.equal(forbiddenKeys.has(key), false, key));
  }
});

test("PLAYER-PROJECTION-001: identical seed and actions reproduce the same projection", () => {
  const first = createTravellingController().getView();
  const second = createTravellingController().getView();

  assert.deepEqual(first, second);
});

test("PLAYER-PROJECTION-001: every returned projection is deeply immutable", () => {
  const view = createPlayerSessionController(SESSION_SEED).getView();

  assert.equal(Object.isFrozen(view), true);
  assert.equal(Object.isFrozen(view.map), true);
  assert.equal(Object.isFrozen(view.map.places), true);
  assert.equal(Object.isFrozen(view.caravan.cargo.stacks[0]), true);
  assert.throws(() => view.map.places.push({}), TypeError);
});

function createTravellingController() {
  return createPlayerSessionController(SESSION_SEED)
    .dispatch({
      kind: "SELECT_DESTINATION",
      destinationRef: "place:north-camp",
    })
    .dispatch({ kind: "START_JOURNEY" });
}

function visitKeys(value, visitor) {
  if (value === null || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    visitor(key);
    visitKeys(child, visitor);
  }
}
