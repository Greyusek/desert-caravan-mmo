import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_CITY_ARRIVAL_RADIUS_METERS,
  createRoutePlan,
  createWorldCoordinate,
  destinationPoint,
  findFirstCityArrival,
  greatCircleDistance,
} from "../dist/src/index.js";

const PLANET_RADIUS_METERS = 1_000_000;
const SPEED_METERS_PER_SECOND = 10;
const EPSILON_METERS = 1e-4;
const originPosition = createWorldCoordinate(0, 0);
const originCity = {
  id: "city-origin",
  name: "Origin",
  position: originPosition,
};

function approx(actual, expected, tolerance = EPSILON_METERS) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );
}

test("GAME-007: a route from outside arrives at the first city-radius entry", () => {
  const start = destinationPoint(
    originPosition,
    270,
    2_000,
    PLANET_RADIUS_METERS,
  );
  const route = createRoutePlan(
    start,
    [{ bearingDeg: 90, distanceMeters: 3_000 }],
    SPEED_METERS_PER_SECOND,
    PLANET_RADIUS_METERS,
  );
  const arrival = findFirstCityArrival(route, originCity);

  assert.ok(arrival);
  assert.equal(DEFAULT_CITY_ARRIVAL_RADIUS_METERS, 500);
  assert.equal(arrival.city, originCity);
  assert.equal(arrival.kind, "entry");
  assert.equal(arrival.segmentIndex, 0);
  approx(arrival.routeDistanceMeters, 1_500);
  approx(arrival.elapsedSeconds, 150);
  approx(arrival.distanceToCityMeters, 500);
});

test("GAME-007: starting inside requires a real exit and re-entry", () => {
  const route = createRoutePlan(
    originPosition,
    [
      { bearingDeg: 90, distanceMeters: 2_000 },
      { bearingDeg: 270, distanceMeters: 2_000 },
    ],
    SPEED_METERS_PER_SECOND,
    PLANET_RADIUS_METERS,
  );
  const arrival = findFirstCityArrival(route, originCity);

  assert.ok(arrival);
  assert.equal(arrival.kind, "reentry");
  assert.equal(arrival.segmentIndex, 1);
  approx(arrival.routeDistanceMeters, 3_500);
  approx(arrival.elapsedSeconds, 350);
  approx(arrival.distanceToCityMeters, 500);
});

test("GAME-007: movement entirely inside the start city is not a return", () => {
  const route = createRoutePlan(
    originPosition,
    [
      { bearingDeg: 90, distanceMeters: 200 },
      { bearingDeg: 270, distanceMeters: 200 },
    ],
    SPEED_METERS_PER_SECOND,
    PLANET_RADIUS_METERS,
  );

  assert.equal(findFirstCityArrival(route, originCity), null);
});

test("GAME-007: a route ending outside the selected city has no arrival", () => {
  const route = createRoutePlan(
    originPosition,
    [{ bearingDeg: 90, distanceMeters: 2_000 }],
    SPEED_METERS_PER_SECOND,
    PLANET_RADIUS_METERS,
  );
  const distantCity = {
    id: "city-distant",
    name: "Distant",
    position: destinationPoint(
      originPosition,
      0,
      5_000,
      PLANET_RADIUS_METERS,
    ),
  };

  assert.equal(findFirstCityArrival(route, distantCity), null);
});

test("GAME-007: a tangent touch counts as city arrival", () => {
  const route = createRoutePlan(
    originPosition,
    [{ bearingDeg: 90, distanceMeters: 2_000 }],
    SPEED_METERS_PER_SECOND,
    PLANET_RADIUS_METERS,
  );
  const nearestPoint = destinationPoint(
    originPosition,
    90,
    1_000,
    PLANET_RADIUS_METERS,
  );
  const tangentCity = {
    id: "city-tangent",
    name: "Tangent",
    position: destinationPoint(
      nearestPoint,
      0,
      100,
      PLANET_RADIUS_METERS,
    ),
  };
  const arrival = findFirstCityArrival(route, tangentCity, 100);

  assert.ok(arrival);
  approx(arrival.routeDistanceMeters, 1_000, 0.02);
  approx(arrival.distanceToCityMeters, 100, 0.02);
});

test("GAME-007: city arrival remains continuous across the antimeridian", () => {
  const start = createWorldCoordinate(0, 179.99);
  const route = createRoutePlan(
    start,
    [{ bearingDeg: 90, distanceMeters: 3_000 }],
    SPEED_METERS_PER_SECOND,
    PLANET_RADIUS_METERS,
  );
  const city = {
    id: "city-antimeridian",
    name: "Antimeridian",
    position: destinationPoint(start, 90, 2_000, PLANET_RADIUS_METERS),
  };
  const arrival = findFirstCityArrival(route, city, 100);

  assert.ok(arrival);
  approx(arrival.routeDistanceMeters, 1_900);
  assert.ok(arrival.caravanPosition.longitudeDeg < 0);
});

test("GAME-007: invalid city radii are rejected", () => {
  const route = createRoutePlan(
    originPosition,
    [{ bearingDeg: 90, distanceMeters: 2_000 }],
    SPEED_METERS_PER_SECOND,
    PLANET_RADIUS_METERS,
  );

  for (const radius of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(
      () => findFirstCityArrival(route, originCity, radius),
      /cityArrivalRadiusMeters must be a non-negative finite number/,
    );
  }

  assert.ok(
    greatCircleDistance(
      originPosition,
      originCity.position,
      PLANET_RADIUS_METERS,
    ) === 0,
  );
});
