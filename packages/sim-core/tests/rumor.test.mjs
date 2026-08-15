import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_RUMOR_MAXIMUM_DISTANCE_METERS,
  DEFAULT_RUMOR_MINIMUM_DISTANCE_METERS,
  DEFAULT_RUMOR_SECTOR_CENTER_BEARING_DEG,
  DEFAULT_RUMOR_SECTOR_HALF_WIDTH_DEG,
  createRumorSearchScenario,
  createWorldCoordinate,
  generateSeededWorld,
  greatCircleDistance,
} from "../dist/src/index.js";

const checkpointWorld = generateSeededWorld("checkpoint-04");
const checkpointOrigin = checkpointWorld.cities[0];

test("GAME-001: rumor exposes coarse knowledge without target coordinates", () => {
  assert.ok(checkpointOrigin);
  const { rumor } = createRumorSearchScenario("checkpoint-04", checkpointOrigin);

  assert.deepEqual(rumor, {
    id: "rumor-city-01-01",
    originCityId: "city-01",
    targetKind: "mine",
    bearingSector: {
      name: "northwest",
      centerBearingDeg: 315,
      minimumBearingDeg: 292.5,
      maximumBearingDeg: 337.5,
    },
    distanceRange: {
      minimumMeters: 30_000,
      maximumMeters: 50_000,
    },
    informationQuality: "rough",
  });
  assert.equal("position" in rumor, false);
});

test("GAME-001: identical seed and origin reproduce the complete scenario", () => {
  assert.ok(checkpointOrigin);
  const scenario = createRumorSearchScenario("checkpoint-04", checkpointOrigin);
  assert.deepEqual(
    scenario,
    createRumorSearchScenario("checkpoint-04", checkpointOrigin),
  );
  assert.deepEqual(scenario.serverTruth, {
    target: {
      id: "rumor-mine-city-01",
      kind: "mine",
      position: {
        latitudeDeg: -4.807635440771959,
        longitudeDeg: -112.946409507633,
      },
    },
    exactBearingDeg: 307.8012190503068,
    exactDistanceMeters: 32_830.61096072197,
  });
});

test("GAME-001: authoritative target stays inside the advertised sector and range", () => {
  assert.ok(checkpointOrigin);
  const scenario = createRumorSearchScenario("checkpoint-04", checkpointOrigin);
  const { exactBearingDeg, exactDistanceMeters, target } = scenario.serverTruth;

  assert.ok(
    exactBearingDeg >=
      DEFAULT_RUMOR_SECTOR_CENTER_BEARING_DEG -
        DEFAULT_RUMOR_SECTOR_HALF_WIDTH_DEG,
  );
  assert.ok(
    exactBearingDeg <=
      DEFAULT_RUMOR_SECTOR_CENTER_BEARING_DEG +
        DEFAULT_RUMOR_SECTOR_HALF_WIDTH_DEG,
  );
  assert.ok(exactDistanceMeters >= DEFAULT_RUMOR_MINIMUM_DISTANCE_METERS);
  assert.ok(exactDistanceMeters <= DEFAULT_RUMOR_MAXIMUM_DISTANCE_METERS);
  assert.ok(
    Math.abs(
      greatCircleDistance(checkpointOrigin.position, target.position) -
        exactDistanceMeters,
    ) < 1e-6,
  );
});

test("GAME-001: different seeds move server truth without changing clue quality", () => {
  assert.ok(checkpointOrigin);
  const first = createRumorSearchScenario("rumor-a", checkpointOrigin);
  const second = createRumorSearchScenario("rumor-b", checkpointOrigin);

  assert.notDeepEqual(first.serverTruth.target.position, second.serverTruth.target.position);
  assert.deepEqual(first.rumor.bearingSector, second.rumor.bearingSector);
  assert.deepEqual(first.rumor.distanceRange, second.rumor.distanceRange);
});

test("GAME-001: origin city has its own namespaced target", () => {
  const firstOrigin = checkpointWorld.cities[0];
  const secondOrigin = checkpointWorld.cities[1];
  assert.ok(firstOrigin);
  assert.ok(secondOrigin);

  const first = createRumorSearchScenario("checkpoint-04", firstOrigin);
  const second = createRumorSearchScenario("checkpoint-04", secondOrigin);

  assert.equal(first.serverTruth.target.id, "rumor-mine-city-01");
  assert.equal(second.serverTruth.target.id, "rumor-mine-city-02");
  assert.notDeepEqual(first.serverTruth.target.position, second.serverTruth.target.position);
});

test("GAME-001: unrelated world generation counts cannot perturb the rumor", () => {
  const smallOrigin = generateSeededWorld("independent-rumor", {
    cityCount: 1,
    staticObjectCounts: { mine: 0 },
    wanderingMonsterCount: 0,
  }).cities[0];
  const largeOrigin = generateSeededWorld("independent-rumor", {
    cityCount: 20,
    staticObjectCounts: { mine: 12 },
    wanderingMonsterCount: 8,
  }).cities[0];
  assert.ok(smallOrigin);
  assert.ok(largeOrigin);

  assert.deepEqual(
    createRumorSearchScenario("independent-rumor", smallOrigin),
    createRumorSearchScenario("independent-rumor", largeOrigin),
  );
});

test("GAME-001: empty seed and origin identity are rejected", () => {
  assert.ok(checkpointOrigin);
  assert.throws(
    () => createRumorSearchScenario("", checkpointOrigin),
    /seed must not be empty/,
  );
  assert.throws(
    () =>
      createRumorSearchScenario("rumor", {
        id: "",
        name: "Invalid",
        position: createWorldCoordinate(0, 0),
      }),
    /originCity.id must not be empty/,
  );
});
