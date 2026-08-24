import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_INTERACTION_RADIUS_METERS,
  ENCOUNTER_TIME_TOLERANCE_SECONDS,
  createRoutePlan,
  createWorldCoordinate,
  destinationPoint,
  findFirstMovingEncounter,
  greatCircleDistance,
} from "../dist/src/index.js";

const PLANET_RADIUS_METERS = 1_000_000;
const SPEED_METERS_PER_SECOND = 10;
const EPS_SECONDS = ENCOUNTER_TIME_TOLERANCE_SECONDS * 2;

function approx(actual, expected, tolerance) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );
}

function finite(route, startsAtSeconds = 0) {
  return { route, startsAtSeconds, mode: "finite" };
}

function cyclic(route, startsAtSeconds = 0) {
  return { route, startsAtSeconds, mode: "cyclic" };
}

function stationary(route, startsAtSeconds = 0) {
  return { route, startsAtSeconds, mode: "stationary" };
}

function crossingRoutes(crossing = createWorldCoordinate(0, 0)) {
  const west = destinationPoint(
    crossing,
    270,
    1_000,
    PLANET_RADIUS_METERS,
  );
  const south = destinationPoint(
    crossing,
    180,
    1_000,
    PLANET_RADIUS_METERS,
  );
  return {
    eastbound: createRoutePlan(
      west,
      [{ bearingDeg: 90, distanceMeters: 2_000 }],
      SPEED_METERS_PER_SECOND,
      PLANET_RADIUS_METERS,
    ),
    northbound: createRoutePlan(
      south,
      [{ bearingDeg: 0, distanceMeters: 2_000 }],
      SPEED_METERS_PER_SECOND,
      PLANET_RADIUS_METERS,
    ),
  };
}

function expectedPerpendicularEntrySeconds(radiusMeters) {
  const timeFromCrossing =
    (PLANET_RADIUS_METERS / SPEED_METERS_PER_SECOND) *
    Math.acos(Math.sqrt(Math.cos(radiusMeters / PLANET_RADIUS_METERS)));
  return 100 - timeFromCrossing;
}

test("SIM-008: synchronized routes meet at their first 500 m radius entry", () => {
  const { eastbound, northbound } = crossingRoutes();
  const encounter = findFirstMovingEncounter(
    finite(eastbound),
    finite(northbound),
    { startSeconds: 0, endSeconds: 200 },
  );

  assert.ok(encounter);
  assert.equal(DEFAULT_INTERACTION_RADIUS_METERS, 500);
  approx(
    encounter.atSeconds,
    expectedPerpendicularEntrySeconds(DEFAULT_INTERACTION_RADIUS_METERS),
    EPS_SECONDS,
  );
  approx(encounter.separationMeters, DEFAULT_INTERACTION_RADIUS_METERS, 0.0001);
  approx(encounter.firstRouteElapsedSeconds, encounter.atSeconds, 1e-12);
  approx(encounter.secondRouteElapsedSeconds, encounter.atSeconds, 1e-12);
});

test("SIM-008: crossing the same point at different times is not an encounter", () => {
  const { eastbound, northbound } = crossingRoutes();

  assert.equal(
    findFirstMovingEncounter(
      finite(eastbound),
      finite(northbound, 50),
      { startSeconds: 0, endSeconds: 300 },
      100,
    ),
    null,
  );
});

test("SIM-008: an overlapping window that starts inside the radius fires immediately", () => {
  const { eastbound } = crossingRoutes();
  const encounter = findFirstMovingEncounter(
    finite(eastbound, 20),
    finite(eastbound, 20),
    { startSeconds: 0, endSeconds: 300 },
    0,
  );

  assert.ok(encounter);
  assert.equal(encounter.atSeconds, 20);
  assert.equal(encounter.firstRouteElapsedSeconds, 0);
  assert.equal(encounter.secondRouteElapsedSeconds, 0);
  approx(encounter.separationMeters, 0, 1e-9);
});

test("SIM-008: the caller's search window clips otherwise valid encounters", () => {
  const { eastbound, northbound } = crossingRoutes();
  const clippedStart = findFirstMovingEncounter(
    finite(eastbound),
    finite(northbound),
    { startSeconds: 95, endSeconds: 200 },
    100,
  );
  const clippedEnd = findFirstMovingEncounter(
    finite(eastbound),
    finite(northbound),
    { startSeconds: 0, endSeconds: 90 },
    100,
  );

  assert.ok(clippedStart);
  assert.equal(clippedStart.atSeconds, 95);
  assert.equal(clippedEnd, null);
});

test("SIM-008: a finite caravan can meet a patrol during a later cycle", () => {
  const crossing = createWorldCoordinate(0, 0);
  const { eastbound, northbound } = crossingRoutes(crossing);
  const closedPatrol = createRoutePlan(
    eastbound.start,
    [
      { bearingDeg: 90, distanceMeters: 2_000 },
      { bearingDeg: 270, distanceMeters: 2_000 },
    ],
    SPEED_METERS_PER_SECOND,
    PLANET_RADIUS_METERS,
  );
  const encounter = findFirstMovingEncounter(
    cyclic(closedPatrol),
    finite(northbound, 400),
    { startSeconds: 400, endSeconds: 600 },
    100,
  );

  assert.ok(encounter);
  approx(encounter.atSeconds, 400 + expectedPerpendicularEntrySeconds(100), EPS_SECONDS);
  assert.ok(encounter.firstRouteElapsedSeconds > closedPatrol.totalDurationSeconds);
  approx(encounter.secondRouteElapsedSeconds, encounter.atSeconds - 400, 1e-12);
});

test("GAME-010: a cyclic patrol enters a stationary motion radius continuously", () => {
  const stop = createWorldCoordinate(0, 0);
  const stationaryRoute = createRoutePlan(
    stop,
    [{ bearingDeg: 0, distanceMeters: 0 }],
    SPEED_METERS_PER_SECOND,
    PLANET_RADIUS_METERS,
  );
  const west = destinationPoint(stop, 270, 1_500, PLANET_RADIUS_METERS);
  const patrol = createRoutePlan(
    west,
    [
      { bearingDeg: 90, distanceMeters: 3_000 },
      { bearingDeg: 270, distanceMeters: 3_000 },
    ],
    SPEED_METERS_PER_SECOND,
    PLANET_RADIUS_METERS,
  );
  const encounter = findFirstMovingEncounter(
    stationary(stationaryRoute, 100),
    cyclic(patrol),
    { startSeconds: 100, endSeconds: 200 },
    100,
  );

  assert.ok(encounter);
  approx(encounter.atSeconds, 140, EPS_SECONDS);
  approx(encounter.firstRouteElapsedSeconds, 40, EPS_SECONDS);
  approx(encounter.separationMeters, 100, 0.0001);
  approx(
    greatCircleDistance(
      encounter.firstPosition,
      stop,
      PLANET_RADIUS_METERS,
    ),
    0,
    0.000001,
  );
});

test("SIM-008: moving encounters remain continuous across the antimeridian", () => {
  const crossing = createWorldCoordinate(0, 180);
  const { eastbound, northbound } = crossingRoutes(crossing);
  const encounter = findFirstMovingEncounter(
    finite(eastbound),
    finite(northbound),
    { startSeconds: 0, endSeconds: 200 },
    100,
  );

  assert.ok(encounter);
  approx(encounter.atSeconds, expectedPerpendicularEntrySeconds(100), EPS_SECONDS);
  assert.ok(encounter.firstPosition.longitudeDeg > 179);
  assert.equal(encounter.secondPosition.longitudeDeg, -180);
});

test("SIM-008: a single tangent instant counts as an encounter", () => {
  const { eastbound, northbound } = crossingRoutes();
  const tangentRadius =
    PLANET_RADIUS_METERS *
    Math.acos(Math.cos(250 / PLANET_RADIUS_METERS) ** 2);
  const encounter = findFirstMovingEncounter(
    finite(eastbound),
    finite(northbound, 50),
    { startSeconds: 0, endSeconds: 300 },
    tangentRadius,
  );

  assert.ok(encounter);
  approx(encounter.atSeconds, 125, 0.002);
  approx(encounter.separationMeters, tangentRadius, 0.000002);
});

test("SIM-008: swapping entity order preserves time and swaps positions", () => {
  const { eastbound, northbound } = crossingRoutes();
  const firstOrder = findFirstMovingEncounter(
    finite(eastbound),
    finite(northbound),
    { startSeconds: 0, endSeconds: 200 },
    100,
  );
  const secondOrder = findFirstMovingEncounter(
    finite(northbound),
    finite(eastbound),
    { startSeconds: 0, endSeconds: 200 },
    100,
  );

  assert.ok(firstOrder);
  assert.ok(secondOrder);
  approx(firstOrder.atSeconds, secondOrder.atSeconds, EPS_SECONDS);
  approx(
    greatCircleDistance(
      firstOrder.firstPosition,
      secondOrder.secondPosition,
      PLANET_RADIUS_METERS,
    ),
    0,
    0.000001,
  );
  approx(
    greatCircleDistance(
      firstOrder.secondPosition,
      secondOrder.firstPosition,
      PLANET_RADIUS_METERS,
    ),
    0,
    0.000001,
  );
});

test("SIM-008: finite routes with no active-time overlap cannot meet", () => {
  const { eastbound } = crossingRoutes();

  assert.equal(
    findFirstMovingEncounter(
      finite(eastbound),
      finite(eastbound, 300),
      { startSeconds: 0, endSeconds: 500 },
      10_000,
    ),
    null,
  );
});

test("SIM-008: invalid windows, motions, radii, and planet combinations are rejected", () => {
  const { eastbound, northbound } = crossingRoutes();
  const anotherPlanetRoute = createRoutePlan(
    createWorldCoordinate(0, 0),
    [{ bearingDeg: 90, distanceMeters: 1_000 }],
    10,
    PLANET_RADIUS_METERS + 1,
  );

  assert.throws(
    () =>
      findFirstMovingEncounter(
        finite(eastbound),
        finite(northbound),
        { startSeconds: 10, endSeconds: 9 },
      ),
    /endSeconds must not precede startSeconds/,
  );
  assert.throws(
    () =>
      findFirstMovingEncounter(
        finite(eastbound),
        finite(northbound),
        { startSeconds: 0, endSeconds: 200 },
        -1,
      ),
    /encounterRadiusMeters must be a non-negative finite number/,
  );
  assert.throws(
    () =>
      findFirstMovingEncounter(
        finite(eastbound, Number.NaN),
        finite(northbound),
        { startSeconds: 0, endSeconds: 200 },
      ),
    /first.startsAtSeconds must be a non-negative finite number/,
  );
  assert.throws(
    () =>
      findFirstMovingEncounter(
        cyclic(eastbound),
        finite(northbound),
        { startSeconds: 0, endSeconds: 200 },
      ),
    /first.route must be closed when cyclic/,
  );
  assert.throws(
    () =>
      findFirstMovingEncounter(
        finite(eastbound),
        finite(anotherPlanetRoute),
        { startSeconds: 0, endSeconds: 100 },
      ),
    /same planetRadiusMeters/,
  );
});
