import test from "node:test";
import assert from "node:assert/strict";
import {
  NPC_CARAVAN_TRACK_SPACING_METERS,
  approximateTrackAge,
  approximateTravelDirection,
  createRoutePlan,
  createWorldCoordinate,
  deriveNpcCaravanTrackMarks,
  observeCaravanTrack,
} from "../dist/src/index.js";

const PLANET_RADIUS_METERS = 1_000_000;

function caravan({ departsAtSeconds = 100, distanceMeters = 3_000 } = {}) {
  const route = createRoutePlan(
    createWorldCoordinate(0, 0),
    [{ bearingDeg: 90, distanceMeters }],
    10,
    PLANET_RADIUS_METERS,
  );
  return {
    id: "npc-caravan-test",
    kind: "npc-caravan",
    originCityId: "city-a",
    destinationCityId: "city-b",
    departsAtSeconds,
    visionRadiusMeters: 300,
    interactionRadiusMeters: 500,
    route,
  };
}

test("LIVING-003: only actually travelled distance leaves physical marks", () => {
  const marks = deriveNpcCaravanTrackMarks(caravan(), 225);

  assert.equal(marks.length, 2);
  assert.deepEqual(
    marks.map((mark) => mark.routeDistanceMeters),
    [500, 1_000],
  );
  assert.deepEqual(
    marks.map((mark) => mark.passedAtWorldTimeSeconds),
    [150, 200],
  );
  assert.ok(
    marks.every(
      (mark) =>
        mark.routeDistanceMeters % NPC_CARAVAN_TRACK_SPACING_METERS === 0,
    ),
  );
});

test("LIVING-003: scheduled and stationary zero-progress caravans leave no track", () => {
  const input = caravan();
  assert.deepEqual(deriveNpcCaravanTrackMarks(input, 99), []);
  assert.deepEqual(deriveNpcCaravanTrackMarks(input, 100), []);
});

test("LIVING-003: advancing world time preserves the deterministic track prefix", () => {
  const input = caravan();
  const early = deriveNpcCaravanTrackMarks(input, 200);
  const later = deriveNpcCaravanTrackMarks(input, 350);

  assert.deepEqual(later.slice(0, early.length), early);
  assert.equal(later.length, 5);
  assert.deepEqual(later, deriveNpcCaravanTrackMarks(input, 350));
});

test("LIVING-003: player clue exposes coarse age and direction without coordinates", () => {
  const [mark] = deriveNpcCaravanTrackMarks(caravan(), 150);
  assert.ok(mark);
  const clue = observeCaravanTrack(mark, mark.passedAtWorldTimeSeconds + 3_600);

  assert.deepEqual(clue, {
    trackId: mark.id,
    kind: "caravan-track",
    observedAtWorldTimeSeconds: 3_750,
    approximateAge: "recent",
    approximateDirection: "east",
  });
  const serialized = JSON.stringify(clue);
  assert.equal(serialized.includes("latitude"), false);
  assert.equal(serialized.includes("longitude"), false);
  assert.equal(serialized.includes("sourceCaravanId"), false);
  assert.equal(serialized.includes("passedAtWorldTimeSeconds"), false);
});

test("LIVING-003: age and eight-way direction buckets have exact boundaries", () => {
  assert.equal(approximateTrackAge(0), "fresh");
  assert.equal(approximateTrackAge(3_599.999), "fresh");
  assert.equal(approximateTrackAge(3_600), "recent");
  assert.equal(approximateTrackAge(21_600), "old");
  assert.equal(approximateTrackAge(86_400), "weathered");
  assert.equal(approximateTravelDirection(337.5), "north");
  assert.equal(approximateTravelDirection(22.5), "northeast");
  assert.equal(approximateTravelDirection(225), "southwest");
});

test("LIVING-003: observation time and track inputs are validated", () => {
  const [mark] = deriveNpcCaravanTrackMarks(caravan(), 150);
  assert.ok(mark);
  assert.throws(
    () => observeCaravanTrack(mark, mark.passedAtWorldTimeSeconds - 1),
    /must not precede the track/,
  );
  assert.throws(() => approximateTrackAge(-1), /non-negative finite number/);
  assert.throws(() => approximateTravelDirection(Number.NaN), /finite number/);
  assert.throws(
    () => deriveNpcCaravanTrackMarks({ ...caravan(), id: "" }, 200),
    /caravan.id must not be empty/,
  );
});
