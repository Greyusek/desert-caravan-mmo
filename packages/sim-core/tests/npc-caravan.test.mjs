import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_NPC_CARAVAN_INTERACTION_RADIUS_METERS,
  DEFAULT_NPC_CARAVAN_SPEED_METERS_PER_SECOND,
  DEFAULT_NPC_CARAVAN_VISION_RADIUS_METERS,
  createRoutePlan,
  createWorldCoordinate,
  generateSeededWorld,
  greatCircleDistance,
  npcCaravanPositionAtWorldTime,
  positionAtTime,
} from "../dist/src/index.js";

const EPS_METERS = 0.001;

test("LIVING-001: a seeded NPC caravan travels between cities on a RoutePlan", () => {
  const world = generateSeededWorld("living-traveller");
  const caravan = world.npcCaravans[0];

  assert.ok(caravan);
  assert.equal(caravan.id, "npc-caravan-01");
  assert.equal(caravan.kind, "npc-caravan");
  assert.equal(caravan.originCityId, world.cities[0].id);
  assert.equal(caravan.destinationCityId, world.cities[1].id);
  assert.equal(
    caravan.route.speedMetersPerSecond,
    DEFAULT_NPC_CARAVAN_SPEED_METERS_PER_SECOND,
  );
  assert.equal(caravan.visionRadiusMeters, DEFAULT_NPC_CARAVAN_VISION_RADIUS_METERS);
  assert.equal(
    caravan.interactionRadiusMeters,
    DEFAULT_NPC_CARAVAN_INTERACTION_RADIUS_METERS,
  );
  assert.ok(caravan.route.totalDistanceMeters > 0);
});

test("LIVING-001: NPC projection reuses SIM-005 at authoritative world time", () => {
  const caravan = generateSeededWorld("living-position").npcCaravans[0];
  assert.ok(caravan);
  const halfwayWorldTime = caravan.route.totalDurationSeconds / 2;
  const npcPosition = npcCaravanPositionAtWorldTime(caravan, halfwayWorldTime);
  const routePosition = positionAtTime(caravan.route, halfwayWorldTime);

  assert.equal(npcPosition.status, "moving");
  assert.equal(npcPosition.routeElapsedSeconds, halfwayWorldTime);
  assert.equal(npcPosition.segmentIndex, routePosition.segmentIndex);
  assert.ok(
    greatCircleDistance(
      npcPosition.coordinate,
      routePosition.coordinate,
      caravan.route.planetRadiusMeters,
    ) <= EPS_METERS,
  );
  assert.equal(npcPosition.traveledDistanceMeters, routePosition.traveledDistanceMeters);
  assert.equal(npcPosition.remainingDistanceMeters, routePosition.remainingDistanceMeters);
});

test("LIVING-001: departure and arrival are derived from world time", () => {
  const route = createRoutePlan(
    createWorldCoordinate(0, 0),
    [{ bearingDeg: 90, distanceMeters: 1_000 }],
    10,
  );
  const caravan = {
    id: "delayed",
    kind: "npc-caravan",
    originCityId: "city-a",
    destinationCityId: "city-b",
    departsAtSeconds: 50,
    visionRadiusMeters: 300,
    interactionRadiusMeters: 500,
    route,
  };

  const scheduled = npcCaravanPositionAtWorldTime(caravan, 49);
  const moving = npcCaravanPositionAtWorldTime(caravan, 100);
  const arrived = npcCaravanPositionAtWorldTime(caravan, 150);

  assert.equal(scheduled.status, "scheduled");
  assert.equal(scheduled.routeElapsedSeconds, 0);
  assert.equal(scheduled.traveledDistanceMeters, 0);
  assert.equal(moving.status, "moving");
  assert.equal(moving.routeElapsedSeconds, 50);
  assert.equal(arrived.status, "arrived");
  assert.equal(arrived.routeElapsedSeconds, 100);
  assert.equal(arrived.remainingDistanceMeters, 0);
});

test("LIVING-001: generation is deterministic, configurable and stream-safe", () => {
  const repeated = generateSeededWorld("living-repeat", { npcCaravanCount: 3 });
  assert.deepEqual(
    repeated.npcCaravans,
    generateSeededWorld("living-repeat", { npcCaravanCount: 3 }).npcCaravans,
  );
  assert.deepEqual(
    generateSeededWorld("living-repeat", { npcCaravanCount: 0 }).npcCaravans,
    [],
  );
  assert.deepEqual(
    repeated.wanderingMonsters,
    generateSeededWorld("living-repeat", { npcCaravanCount: 0 }).wanderingMonsters,
  );
  assert.deepEqual(
    repeated.staticObjects,
    generateSeededWorld("living-repeat", { npcCaravanCount: 0 }).staticObjects,
  );

  for (const count of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(
      () => generateSeededWorld("living-invalid", { npcCaravanCount: count }),
      /npcCaravanCount must be a non-negative safe integer/,
    );
  }
});

test("LIVING-001: invalid world times and departure times are rejected", () => {
  const caravan = generateSeededWorld("living-validation").npcCaravans[0];
  assert.ok(caravan);

  for (const worldTime of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(
      () => npcCaravanPositionAtWorldTime(caravan, worldTime),
      /worldTimeSeconds must be a non-negative finite number/,
    );
  }

  assert.throws(
    () => npcCaravanPositionAtWorldTime({ ...caravan, departsAtSeconds: -1 }, 0),
    /caravan.departsAtSeconds must be a non-negative finite number/,
  );
});
