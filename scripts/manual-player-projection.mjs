import assert from "node:assert/strict";
import { createPlayerSessionController } from "../packages/sim-core/dist/src/index.js";

const seed = process.argv[2] ?? "manual-player-projection";
const initialController = createPlayerSessionController(seed);
const initial = initialController.getView();
const readyController = initialController.dispatch({
  kind: "SELECT_DESTINATION",
  destinationRef: "place:north-camp",
});
const ready = readyController.getView();
const travelling = readyController.dispatch({ kind: "START_JOURNEY" }).getView();

assert.equal(JSON.stringify(initialController), "{}");
assert.equal(initial.phase, "city");
assert.equal(initial.map.orientation, "north-up");
assert.equal(ready.phase, "ready");
assert.equal(ready.map.route?.status, "planned");
assert.equal(ready.map.route?.distanceMeters, 2_000);
assert.equal(ready.map.route?.etaSeconds, 200);
assert.equal(travelling.phase, "travelling");
assert.equal(travelling.map.route?.status, "moving");
assert.equal(travelling.city, null);
assert.deepEqual(
  travelling.journal.map((entry) => entry.kind),
  ["session-ready", "route-planned", "departure"],
);

const serialized = JSON.stringify([initial, ready, travelling]).toLowerCase();
for (const forbidden of [
  "latitudedeg",
  "longitudedeg",
  "worldseed",
  "monster",
  "patrol",
  "battlefield",
  "battleid",
  "costbasiscredits",
  "scarcitymultiplier",
]) {
  assert.equal(serialized.includes(forbidden), false, forbidden);
}

console.log("\nPLAYER-PROJECTION-001 — safe player session");
console.log(
  `  initial=${initial.phase}; place=${initial.map.currentPlaceRef}; action=${initial.availableActions[0]?.kind}`,
);
console.log(
  `  known-map=${initial.map.orientation}; places=${initial.map.places.map((place) => `${place.ref}@E${place.eastMeters}/N${place.northMeters}`).join(",")}`,
);
console.log(
  `  caravan=${initial.caravan.credits}cr; cargo=${initial.caravan.cargo.usedCargoUnits}/${initial.caravan.cargo.capacityCargoUnits}; members=${initial.caravan.members.map((member) => `${member.ref}:${member.health}hp`).join(",")}`,
);
console.log(
  `  market=${initial.city?.market.length} goods; first=${initial.city?.market[0]?.goodId}:${initial.city?.market[0]?.stockUnits}@${initial.city?.market[0]?.cityBuyPriceCredits}/${initial.city?.market[0]?.citySellPriceCredits}; projected fields=${Object.keys(initial.city?.market[0] ?? {}).join(",")}`,
);
console.log(
  `  planned=${ready.map.route?.distanceMeters}m/${ready.map.route?.etaSeconds}s; action=${ready.availableActions[0]?.kind}`,
);
console.log(
  `  travelling=${travelling.map.route?.status}; city=${travelling.city}; journal=${travelling.journal.map((entry) => entry.kind).join("->")}`,
);
console.log("  private controller serialization={} — PASS");
console.log("  forbidden server-truth scan — PASS");
console.log("  PLAYER-PROJECTION-001 manual assertions — PASS");
