import test from "node:test";
import assert from "node:assert/strict";
import {
  createNpcCaravanDetectionSubject,
  createRoutePlan,
  createWorldCoordinate,
  destinationPoint,
  findAsymmetricCaravanDetections,
  findFirstMovingEncounter,
  planNpcCaravanManeuver,
  planNpcCaravanPursuitEvasion,
} from "../dist/src/index.js";

const PLANET_RADIUS_METERS = 1_000_000;

function caravan(id, start, speedMetersPerSecond, visionRadiusMeters) {
  return {
    id,
    kind: "npc-caravan",
    originCityId: `${id}-origin`,
    destinationCityId: `${id}-destination`,
    departsAtSeconds: 0,
    visionRadiusMeters,
    interactionRadiusMeters: 100,
    route: createRoutePlan(
      start,
      [{ bearingDeg: 0, distanceMeters: speedMetersPerSecond * 600 }],
      speedMetersPerSecond,
      PLANET_RADIUS_METERS,
    ),
  };
}

function detections(first, second) {
  return findAsymmetricCaravanDetections(
    createNpcCaravanDetectionSubject(first),
    createNpcCaravanDetectionSubject(second),
    { startSeconds: 0, endSeconds: 600 },
  );
}

test("LIVING-004: a sighting creates a finite pursuit route at existing speed", () => {
  const firstStart = createWorldCoordinate(0, 0);
  const secondStart = destinationPoint(
    firstStart,
    90,
    300,
    PLANET_RADIUS_METERS,
  );
  const first = caravan("pursuer", firstStart, 10, 500);
  const second = caravan("target", secondStart, 5, 100);
  const result = planNpcCaravanPursuitEvasion(
    first,
    second,
    detections(first, second),
    60,
  );

  assert.ok(result.pursuit);
  assert.equal(result.pursuit.kind, "pursuit");
  assert.equal(result.pursuit.decisionAtWorldTimeSeconds, 0);
  assert.equal(result.pursuit.route.speedMetersPerSecond, 10);
  assert.equal(result.pursuit.route.totalDistanceMeters, 600);
  assert.equal(result.pursuit.motion.startsAtSeconds, 0);
  assert.equal(result.pursuit.motion.mode, "finite");
  assert.ok(Math.abs(result.pursuit.bearingDeg - 90) < 1e-7);
});

test("LIVING-004: one-way detection starts pursuit without target evasion", () => {
  const firstStart = createWorldCoordinate(0, 0);
  const secondStart = destinationPoint(
    firstStart,
    90,
    300,
    PLANET_RADIUS_METERS,
  );
  const first = caravan("wide", firstStart, 10, 500);
  const second = caravan("narrow", secondStart, 5, 100);
  const result = planNpcCaravanPursuitEvasion(
    first,
    second,
    detections(first, second),
    60,
  );

  assert.ok(result.pursuit);
  assert.equal(result.evasion, null);
});

test("LIVING-004: reciprocal detection sends the target directly away", () => {
  const firstStart = createWorldCoordinate(0, 0);
  const secondStart = destinationPoint(
    firstStart,
    90,
    300,
    PLANET_RADIUS_METERS,
  );
  const first = caravan("first", firstStart, 10, 500);
  const second = caravan("second", secondStart, 5, 500);
  const result = planNpcCaravanPursuitEvasion(
    first,
    second,
    detections(first, second),
    60,
  );

  assert.ok(result.pursuit);
  assert.ok(result.evasion);
  assert.equal(result.evasion.kind, "evasion");
  assert.equal(result.evasion.route.speedMetersPerSecond, 5);
  assert.equal(result.evasion.route.totalDistanceMeters, 300);
  assert.ok(Math.abs(result.evasion.bearingDeg - 90) < 1e-7);
});

test("LIVING-004: a later original-path sighting cannot rewrite an active pursuit", () => {
  const firstStart = createWorldCoordinate(0, 0);
  const secondStart = destinationPoint(
    firstStart,
    90,
    300,
    PLANET_RADIUS_METERS,
  );
  const first = caravan("first", firstStart, 10, 500);
  const second = caravan("second", secondStart, 5, 500);
  const original = detections(first, second);
  assert.ok(original.firstDetectsSecond);
  assert.ok(original.secondDetectsFirst);
  const delayedReciprocal = {
    ...original,
    secondDetectsFirst: {
      ...original.secondDetectsFirst,
      atWorldTimeSeconds: original.firstDetectsSecond.atWorldTimeSeconds + 1,
    },
  };

  const result = planNpcCaravanPursuitEvasion(
    first,
    second,
    delayedReciprocal,
    60,
  );
  assert.ok(result.pursuit);
  assert.equal(result.evasion, null);
});

test("LIVING-004: the existing continuous solver resolves a faster pursuit", () => {
  const firstStart = createWorldCoordinate(0, 0);
  const secondStart = destinationPoint(
    firstStart,
    90,
    300,
    PLANET_RADIUS_METERS,
  );
  const first = caravan("first", firstStart, 10, 500);
  const second = caravan("second", secondStart, 5, 500);
  const plan = planNpcCaravanPursuitEvasion(
    first,
    second,
    detections(first, second),
    60,
  );
  assert.ok(plan.pursuit);
  assert.ok(plan.evasion);

  const contact = findFirstMovingEncounter(
    plan.pursuit.motion,
    plan.evasion.motion,
    { startSeconds: 0, endSeconds: 60 },
    100,
  );
  assert.ok(contact);
  assert.ok(Math.abs(contact.atSeconds - 40) < 1e-5);
});

test("LIVING-004: a faster evader opens distance without invented contact", () => {
  const firstStart = createWorldCoordinate(0, 0);
  const secondStart = destinationPoint(
    firstStart,
    90,
    300,
    PLANET_RADIUS_METERS,
  );
  const first = caravan("first", firstStart, 5, 500);
  const second = caravan("second", secondStart, 10, 500);
  const plan = planNpcCaravanPursuitEvasion(
    first,
    second,
    detections(first, second),
    60,
  );
  assert.ok(plan.pursuit);
  assert.ok(plan.evasion);
  assert.equal(
    findFirstMovingEncounter(
      plan.pursuit.motion,
      plan.evasion.motion,
      { startSeconds: 0, endSeconds: 60 },
      100,
    ),
    null,
  );
});

test("LIVING-004: maneuvers reject mismatched sightings and invalid inputs", () => {
  const start = createWorldCoordinate(0, 0);
  const first = caravan("first", start, 10, 500);
  const second = caravan("second", start, 5, 500);
  const sighting = detections(first, second).firstDetectsSecond;
  assert.ok(sighting);

  assert.throws(
    () => planNpcCaravanManeuver("evasion", second, first, sighting, 60),
    /sighting identities must match/,
  );
  assert.throws(
    () => planNpcCaravanPursuitEvasion(first, second, detections(first, second), 0),
    /durationSeconds must be a positive finite number/,
  );
  assert.throws(
    () =>
      planNpcCaravanPursuitEvasion(
        first,
        { ...second, id: "first" },
        detections(first, second),
      ),
    /unique ids/,
  );
});
