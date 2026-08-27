import test from "node:test";
import assert from "node:assert/strict";
import {
  createNpcCaravanDetectionSubject,
  createRoutePlan,
  createWorldCoordinate,
  destinationPoint,
  findAsymmetricCaravanDetections,
  generateSeededWorld,
} from "../dist/src/index.js";

const PLANET_RADIUS_METERS = 1_000_000;

function subject(id, start, visionRadiusMeters, startsAtSeconds = 0) {
  return {
    id,
    visionRadiusMeters,
    motion: {
      route: createRoutePlan(
        start,
        [{ bearingDeg: 90, distanceMeters: 2_000 }],
        10,
        PLANET_RADIUS_METERS,
      ),
      startsAtSeconds,
      mode: "finite",
    },
  };
}

test("LIVING-002: one caravan can detect another without reciprocal sighting", () => {
  const firstStart = createWorldCoordinate(0, 0);
  const secondStart = destinationPoint(
    firstStart,
    0,
    300,
    PLANET_RADIUS_METERS,
  );
  const detections = findAsymmetricCaravanDetections(
    subject("wide-observer", firstStart, 500),
    subject("narrow-observer", secondStart, 100),
    { startSeconds: 0, endSeconds: 200 },
  );

  assert.ok(detections.firstDetectsSecond);
  assert.equal(detections.firstDetectsSecond.atWorldTimeSeconds, 0);
  assert.equal(detections.firstDetectsSecond.observerId, "wide-observer");
  assert.equal(detections.firstDetectsSecond.targetId, "narrow-observer");
  assert.equal(detections.secondDetectsFirst, null);
});

test("LIVING-002: player-facing sightings contain no absolute coordinates", () => {
  const start = createWorldCoordinate(0, 0);
  const detections = findAsymmetricCaravanDetections(
    subject("first", start, 500),
    subject("second", start, 500),
    { startSeconds: 0, endSeconds: 200 },
  );

  assert.ok(detections.firstDetectsSecond);
  assert.deepEqual(Object.keys(detections.firstDetectsSecond).sort(), [
    "atWorldTimeSeconds",
    "observerId",
    "observerRouteElapsedSeconds",
    "separationMeters",
    "targetId",
    "targetRouteElapsedSeconds",
  ]);
  assert.equal("coordinate" in detections.firstDetectsSecond, false);
  assert.equal("position" in detections.firstDetectsSecond, false);
});

test("LIVING-002: each radius produces its own deterministic first detection", () => {
  const crossing = createWorldCoordinate(0, 0);
  const west = destinationPoint(crossing, 270, 1_000, PLANET_RADIUS_METERS);
  const south = destinationPoint(crossing, 180, 1_000, PLANET_RADIUS_METERS);
  const first = subject("first", west, 500);
  const second = {
    ...subject("second", south, 100),
    motion: {
      ...subject("second", south, 100).motion,
      route: createRoutePlan(
        south,
        [{ bearingDeg: 0, distanceMeters: 2_000 }],
        10,
        PLANET_RADIUS_METERS,
      ),
    },
  };
  const input = { startSeconds: 0, endSeconds: 200 };
  const detections = findAsymmetricCaravanDetections(first, second, input);

  assert.ok(detections.firstDetectsSecond);
  assert.ok(detections.secondDetectsFirst);
  assert.ok(
    detections.firstDetectsSecond.atWorldTimeSeconds <
      detections.secondDetectsFirst.atWorldTimeSeconds,
  );
  assert.deepEqual(
    detections,
    findAsymmetricCaravanDetections(first, second, input),
  );
});

test("LIVING-002: seeded NPC caravans convert to finite authoritative motions", () => {
  const caravan = generateSeededWorld("living-detection").npcCaravans[0];
  assert.ok(caravan);
  const detectionSubject = createNpcCaravanDetectionSubject(caravan);

  assert.equal(detectionSubject.id, caravan.id);
  assert.equal(detectionSubject.visionRadiusMeters, caravan.visionRadiusMeters);
  assert.equal(detectionSubject.motion.route, caravan.route);
  assert.equal(detectionSubject.motion.startsAtSeconds, caravan.departsAtSeconds);
  assert.equal(detectionSubject.motion.mode, "finite");
});

test("LIVING-002: identities and observer radii are validated", () => {
  const start = createWorldCoordinate(0, 0);
  const first = subject("first", start, 500);
  const second = subject("second", start, 500);
  const window = { startSeconds: 0, endSeconds: 200 };

  assert.throws(
    () => findAsymmetricCaravanDetections({ ...first, id: "" }, second, window),
    /first.id must not be empty/,
  );
  assert.throws(
    () => findAsymmetricCaravanDetections(first, { ...second, id: "first" }, window),
    /unique ids/,
  );
  assert.throws(
    () =>
      findAsymmetricCaravanDetections(
        { ...first, visionRadiusMeters: -1 },
        second,
        window,
      ),
    /first.visionRadiusMeters must be a non-negative finite number/,
  );
});
