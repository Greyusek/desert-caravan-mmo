import test from "node:test";
import assert from "node:assert/strict";
import {
  createLivingPathScenario,
  npcCaravanPositionAtWorldTime,
  positionAtTime,
} from "../dist/src/index.js";

const SEED = "mvp1-living-path";

test("MVP1-001: another caravan physically travels the same seeded world", () => {
  const scenario = createLivingPathScenario(SEED);
  const npc = scenario.serverTruth.npcCaravan;
  const position = npcCaravanPositionAtWorldTime(npc, 1_200);
  assert.equal(scenario.serverTruth.worldSeed, SEED);
  assert.equal(npc.originCityId, scenario.serverTruth.playerCaravan.originCityId);
  assert.equal(position.status, "moving");
  assert.equal(position.traveledDistanceMeters, 1_500);
  assert.equal(scenario.serverTruth.trackMarks.length, 3);
});

test("MVP1-001: player detection is one-way", () => {
  const scenario = createLivingPathScenario(SEED);
  assert.ok(scenario.serverTruth.detections.firstDetectsSecond);
  assert.equal(scenario.serverTruth.detections.secondDetectsFirst, null);
  assert.equal(scenario.playerView.reciprocalSighting, null);
  assert.equal(scenario.playerView.sighting.observerId, "player-caravan");
});

test("MVP1-001: executed travel leaves a coordinate-free approximately aged track", () => {
  const scenario = createLivingPathScenario(SEED);
  assert.equal(scenario.playerView.track.kind, "caravan-track");
  assert.equal(scenario.playerView.track.approximateAge, "recent");
  assert.match(
    scenario.playerView.track.approximateDirection,
    /north|east|south|west/,
  );
  assert.equal("sourceCaravanId" in scenario.playerView.track, false);
});

test("MVP1-001: sighting produces a route-backed pursuit without invented evasion", () => {
  const scenario = createLivingPathScenario(SEED);
  const plan = scenario.serverTruth.pursuitEvasion;
  assert.equal(plan.pursuit?.kind, "pursuit");
  assert.equal(plan.pursuit?.route.segments.length, 1);
  assert.equal(plan.evasion, null);
  assert.deepEqual(scenario.playerView.maneuver, {
    kind: "pursuit",
    durationSeconds: 300,
  });
});

test("MVP1-001: destroyed caravan remains permanently, degrades and yields loot", () => {
  const scenario = createLivingPathScenario(SEED);
  const before = scenario.serverTruth.remainsAtObservation;
  const after = scenario.serverTruth.remainsAfterRecovery;
  assert.equal(before.permanentlyPresent, true);
  assert.equal(after.permanentlyPresent, true);
  assert.ok(before.integrityFraction > 0 && before.integrityFraction < 1);
  assert.equal(before.condition, "weathered");
  assert.ok(Object.values(scenario.playerView.recoveredLoot).some((value) => value > 0));
  assert.deepEqual(after.availableLoot, {
    foodUnits: 0,
    waterUnits: 0,
    salvageUnits: 0,
  });
});

test("MVP1-001: track and remains knowledge retain provenance, confidence and journal", () => {
  const knowledge = createLivingPathScenario(SEED).playerView.knowledge;
  assert.equal(knowledge.entries.length, 2);
  assert.equal(knowledge.journal.length, 2);
  const track = knowledge.entries.find((entry) => entry.evidenceKind === "caravan-track");
  const remains = knowledge.entries.find(
    (entry) => entry.evidenceKind === "caravan-remains",
  );
  assert.equal(track?.confidence, "probable");
  assert.equal(track?.provenance[0]?.source, "direct-track-observation");
  assert.equal(remains?.confidence, "confirmed");
  assert.equal(remains?.provenance[0]?.source, "direct-remains-observation");
});

test("MVP1-001: libraries learn locally only after a physical carried copy arrives", () => {
  const view = createLivingPathScenario(SEED).playerView;
  assert.equal(view.originLibrary.entries.length, 2);
  assert.equal(view.destinationLibraryBeforeDelivery.entries.length, 0);
  assert.equal(view.destinationLibraryAfterDelivery.entries.length, 2);
  assert.ok(
    view.originDelivery.arrivedAtWorldTimeSeconds >
      view.originDelivery.departedAtWorldTimeSeconds,
  );
  assert.ok(
    view.physicalTransfer.departedAtWorldTimeSeconds >
      view.originDelivery.arrivedAtWorldTimeSeconds,
  );
  assert.ok(
    view.physicalTransfer.arrivedAtWorldTimeSeconds >
      view.physicalTransfer.departedAtWorldTimeSeconds,
  );
  assert.equal(view.physicalTransfer.carrierId, "player-caravan");
});

test("MVP1-001: physical information delivery creates a useful world-history rumor", () => {
  const scenario = createLivingPathScenario(SEED);
  const routeArrival = positionAtTime(
    scenario.serverTruth.libraryTransferRoute,
    scenario.serverTruth.libraryTransferRoute.totalDurationSeconds,
  );
  assert.equal(routeArrival.status, "arrived");
  assert.equal(scenario.playerView.rumor.type, "caravan-loss");
  assert.equal(scenario.playerView.rumor.quality, "reliable");
  assert.equal(scenario.playerView.rumor.facts.type, "caravan-loss");
  assert.equal(scenario.playerView.rumor.facts.condition, "weathered");
});

test("MVP1-001: complete player payload never leaks absolute coordinates", () => {
  const serialized = JSON.stringify(createLivingPathScenario(SEED).playerView);
  assert.doesNotMatch(
    serialized,
    /latitude|longitude|coordinate|position|sourceCaravanId/i,
  );
});

test("MVP1-001: identical seed and actions reproduce the complete scenario", () => {
  assert.deepEqual(
    createLivingPathScenario(SEED),
    createLivingPathScenario(SEED),
  );
});

test("MVP1-001: another seed produces another physical history", () => {
  assert.notDeepEqual(
    createLivingPathScenario(SEED),
    createLivingPathScenario("mvp1-living-path-other"),
  );
});
