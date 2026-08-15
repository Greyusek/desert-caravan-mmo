import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_CONCEALED_DISCOVERY_RADIUS_METERS,
  createRoutePlan,
  createWorldCoordinate,
  destinationPoint,
  discoverStaticObjectsAlongRoute,
  greatCircleDistance,
} from "../dist/src/index.js";

const PLANET_RADIUS_METERS = 1_000_000;
const SPEED_METERS_PER_SECOND = 10;
const EPS_METERS = 1e-4;
const start = createWorldCoordinate(0, 0);

function approx(actual, expected, tolerance = EPS_METERS) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );
}

function objectAt(id, position, kind = "oasis") {
  return { id, kind, position };
}

function eastboundRoute(distanceMeters = 1_000) {
  return createRoutePlan(
    start,
    [{ bearingDeg: 90, distanceMeters }],
    SPEED_METERS_PER_SECOND,
    PLANET_RADIUS_METERS,
  );
}

test("WORLD-003: a direct hit is discovered at the first radius entry", () => {
  const obliqueStart = createWorldCoordinate(55.755864, 37.617698);
  const route = createRoutePlan(
    obliqueStart,
    [{ bearingDeg: 315, distanceMeters: 1_000 }],
    SPEED_METERS_PER_SECOND,
    PLANET_RADIUS_METERS,
  );
  const object = objectAt(
    "oasis-direct",
    destinationPoint(obliqueStart, 315, 600, PLANET_RADIUS_METERS),
  );
  const [discovery] = discoverStaticObjectsAlongRoute(route, [object], 100);

  assert.ok(discovery);
  assert.equal(discovery.object, object);
  assert.equal(discovery.segmentIndex, 0);
  approx(discovery.routeDistanceMeters, 500);
  approx(discovery.elapsedSeconds, 50);
  approx(discovery.distanceToObjectMeters, 100);
  approx(
    greatCircleDistance(
      discovery.caravanPosition,
      destinationPoint(obliqueStart, 315, 500, PLANET_RADIUS_METERS),
      PLANET_RADIUS_METERS,
    ),
    0,
  );
});

test("WORLD-003: concealed objects use the 150 m default radius", () => {
  const object = objectAt(
    "oasis-default",
    destinationPoint(start, 90, 600, PLANET_RADIUS_METERS),
  );
  const [discovery] = discoverStaticObjectsAlongRoute(eastboundRoute(), [object]);

  assert.equal(DEFAULT_CONCEALED_DISCOVERY_RADIUS_METERS, 150);
  assert.ok(discovery);
  approx(discovery.routeDistanceMeters, 450);
  approx(discovery.distanceToObjectMeters, 150);
});

test("WORLD-003: an object already inside the radius is discovered at route start", () => {
  const object = objectAt(
    "oasis-near-start",
    destinationPoint(start, 0, 50, PLANET_RADIUS_METERS),
  );
  const [discovery] = discoverStaticObjectsAlongRoute(eastboundRoute(), [object], 100);

  assert.ok(discovery);
  assert.equal(discovery.routeDistanceMeters, 0);
  assert.equal(discovery.elapsedSeconds, 0);
  approx(discovery.distanceToObjectMeters, 50);
});

test("WORLD-003: a route that misses the radius does not reveal the object", () => {
  const nearestRoutePoint = destinationPoint(start, 90, 600, PLANET_RADIUS_METERS);
  const object = objectAt(
    "ruins-missed",
    destinationPoint(nearestRoutePoint, 0, 101, PLANET_RADIUS_METERS),
    "ruins",
  );

  assert.deepEqual(discoverStaticObjectsAlongRoute(eastboundRoute(), [object], 100), []);
});

test("WORLD-003: touching the radius at one tangent point counts as discovery", () => {
  const nearestRoutePoint = destinationPoint(start, 90, 600, PLANET_RADIUS_METERS);
  const object = objectAt(
    "mine-tangent",
    destinationPoint(nearestRoutePoint, 0, 100, PLANET_RADIUS_METERS),
    "mine",
  );
  const [discovery] = discoverStaticObjectsAlongRoute(eastboundRoute(), [object], 100);

  assert.ok(discovery);
  approx(discovery.routeDistanceMeters, 600, 0.02);
  approx(discovery.distanceToObjectMeters, 100, 0.02);
});

test("WORLD-003: the infinite great circle outside segment endpoints is ignored", () => {
  const route = eastboundRoute();
  const endpoint = objectAt("oasis-endpoint", route.end);
  const behind = objectAt(
    "cave-behind",
    destinationPoint(start, 270, 50, PLANET_RADIUS_METERS),
    "cave",
  );
  const ahead = objectAt(
    "cave-ahead",
    destinationPoint(route.end, 90, 50, PLANET_RADIUS_METERS),
    "cave",
  );

  const [endpointDiscovery] = discoverStaticObjectsAlongRoute(route, [endpoint], 25);
  assert.ok(endpointDiscovery);
  approx(endpointDiscovery.routeDistanceMeters, 975);

  assert.deepEqual(
    discoverStaticObjectsAlongRoute(route, [behind, ahead], 25),
    [],
  );
});

test("WORLD-003: discovery on a later segment preserves cumulative distance and ETA", () => {
  const route = createRoutePlan(
    start,
    [
      { bearingDeg: 90, distanceMeters: 1_000 },
      { bearingDeg: 0, distanceMeters: 1_000 },
    ],
    SPEED_METERS_PER_SECOND,
    PLANET_RADIUS_METERS,
  );
  const object = objectAt(
    "ruins-second-segment",
    destinationPoint(route.segments[1].start, 0, 600, PLANET_RADIUS_METERS),
    "ruins",
  );
  const [discovery] = discoverStaticObjectsAlongRoute(route, [object], 100);

  assert.ok(discovery);
  assert.equal(discovery.segmentIndex, 1);
  approx(discovery.routeDistanceMeters, 1_500);
  approx(discovery.elapsedSeconds, 150);
});

test("WORLD-003: spherical discovery remains continuous across the antimeridian", () => {
  const crossingStart = createWorldCoordinate(0, 179.99);
  const route = createRoutePlan(
    crossingStart,
    [{ bearingDeg: 90, distanceMeters: 3_000 }],
    SPEED_METERS_PER_SECOND,
    PLANET_RADIUS_METERS,
  );
  const object = objectAt(
    "oasis-antimeridian",
    destinationPoint(crossingStart, 90, 1_500, PLANET_RADIUS_METERS),
  );
  const [discovery] = discoverStaticObjectsAlongRoute(route, [object], 100);

  assert.ok(discovery);
  approx(discovery.routeDistanceMeters, 1_400);
  assert.ok(discovery.caravanPosition.longitudeDeg < 0);
});

test("WORLD-003: discoveries are ordered by travel time, not object input order", () => {
  const late = objectAt(
    "mine-late",
    destinationPoint(start, 90, 800, PLANET_RADIUS_METERS),
    "mine",
  );
  const early = objectAt(
    "oasis-early",
    destinationPoint(start, 90, 300, PLANET_RADIUS_METERS),
  );
  const discoveries = discoverStaticObjectsAlongRoute(
    eastboundRoute(),
    [late, early],
    50,
  );

  assert.deepEqual(discoveries.map(({ object }) => object.id), ["oasis-early", "mine-late"]);
  approx(discoveries[0].routeDistanceMeters, 250);
  approx(discoveries[1].routeDistanceMeters, 750);
});

test("WORLD-003: zero radius is valid and invalid radii are rejected", () => {
  const exactObject = objectAt(
    "oasis-exact",
    destinationPoint(start, 90, 600, PLANET_RADIUS_METERS),
  );
  const exactDiscoveries = discoverStaticObjectsAlongRoute(
    eastboundRoute(),
    [exactObject],
    0,
  );
  assert.equal(exactDiscoveries.length, 1);
  approx(exactDiscoveries[0].routeDistanceMeters, 600, 0.02);

  for (const radius of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(
      () => discoverStaticObjectsAlongRoute(eastboundRoute(), [exactObject], radius),
      /detectionRadiusMeters must be a non-negative finite number/,
    );
  }
});
