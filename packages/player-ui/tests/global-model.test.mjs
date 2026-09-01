import assert from "node:assert/strict";
import test from "node:test";

import { createPlayerSessionController } from "../../sim-core/dist/src/index.js";
import {
  GLOBAL_LAYER_DEFINITIONS,
  createGlobalScreenState,
} from "../global-model.js";

const SEED = "player-global-model-test";

test("PLAYER-GLOBAL-001: known places project north-up without hidden geography", () => {
  const state = createGlobalScreenState(
    createPlayerSessionController(SEED).getView(),
  );
  const south = state.map.places.find((place) => place.ref === "place:south-camp");
  const north = state.map.places.find((place) => place.ref === "place:north-camp");

  assert.ok(south);
  assert.ok(north);
  assert.equal(state.map.orientation, "north-up");
  assert.equal(south.x, north.x);
  assert.ok(north.y < south.y);
  assert.equal(state.map.route, null);
  assert.deepEqual(Object.keys(south).sort(), [
    "eastMeters",
    "kind",
    "name",
    "northMeters",
    "ref",
    "x",
    "y",
  ]);
});

test("PLAYER-GLOBAL-001: five layer controls expose honest projected counts", () => {
  const state = createGlobalScreenState(
    createPlayerSessionController(SEED).getView(),
  );

  assert.deepEqual(
    state.layers.map(({ id, count, visible }) => [id, count, visible]),
    [
      ["cities", 2, true],
      ["objects", 0, true],
      ["routes", 0, true],
      ["intelligence", 0, true],
      ["events", 1, true],
    ],
  );
  assert.equal(state.layers.length, GLOBAL_LAYER_DEFINITIONS.length);
});

test("PLAYER-GLOBAL-001: destination command comes only from projected actions", () => {
  const state = createGlobalScreenState(
    createPlayerSessionController(SEED).getView(),
  );

  assert.equal(state.routeCommand.canSelectDestination, true);
  assert.equal(state.routeCommand.canStartJourney, false);
  assert.deepEqual(state.routeCommand.destinationOptions, [
    { ref: "place:north-camp", name: "North Camp" },
  ]);
});

test("PLAYER-GLOBAL-001: planned route reuses projected distance, speed and ETA", () => {
  const ready = createPlayerSessionController(SEED)
    .dispatch({
      kind: "SELECT_DESTINATION",
      destinationRef: "place:north-camp",
    })
    .getView();
  const state = createGlobalScreenState(ready);

  assert.equal(state.map.route?.distanceMeters, 2_000);
  assert.equal(state.map.route?.speedMetersPerSecond, 10);
  assert.equal(state.map.route?.etaSeconds, 200);
  assert.equal(state.map.route?.status, "planned");
  assert.equal(state.routeCommand.canSelectDestination, false);
  assert.equal(state.routeCommand.canStartJourney, true);
});

test("PLAYER-GLOBAL-001: travelling caravan uses projected progress for presentation", () => {
  const travelling = createPlayerSessionController(SEED)
    .dispatch({
      kind: "SELECT_DESTINATION",
      destinationRef: "place:north-camp",
    })
    .dispatch({ kind: "START_JOURNEY" })
    .getView();
  const state = createGlobalScreenState(travelling);

  assert.equal(state.map.route?.status, "moving");
  assert.deepEqual(state.map.caravanPoint, state.map.route?.origin);
  assert.equal(state.routeCommand.canSelectDestination, false);
  assert.equal(state.routeCommand.canStartJourney, false);
});

test("PLAYER-GLOBAL-001: local layer preferences change visibility only", () => {
  const view = createPlayerSessionController(SEED).getView();
  const state = createGlobalScreenState(view, new Set(["cities", "events"]));

  assert.deepEqual(
    state.layers.filter((layer) => layer.visible).map((layer) => layer.id),
    ["cities", "events"],
  );
  assert.equal(state.map.places.length, view.map.places.length);
});

test("PLAYER-GLOBAL-001: screen state is deeply immutable", () => {
  const state = createGlobalScreenState(
    createPlayerSessionController(SEED).getView(),
  );

  assert.equal(Object.isFrozen(state), true);
  assert.equal(Object.isFrozen(state.map.places[0]), true);
  assert.throws(() => state.layers.push({}), TypeError);
});
