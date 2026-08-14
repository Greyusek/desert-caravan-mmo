import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_TEST_PLANET_RADIUS_METERS,
  createWorldCoordinate,
  destinationPoint,
  greatCircleDistance,
  kilometers,
} from "../dist/src/index.js";

const EPS_METERS = 1e-6;

function approx(actual, expected, tolerance, message) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    message ?? `expected ${actual} to be within ${tolerance} of ${expected}`,
  );
}

test("SIM-002: 100 km north from equator changes latitude predictably", () => {
  const start = createWorldCoordinate(0, 0);
  const result = destinationPoint(start, 0, kilometers(100));
  const expectedLatitude =
    (kilometers(100) / DEFAULT_TEST_PLANET_RADIUS_METERS) * (180 / Math.PI);

  approx(result.latitudeDeg, expectedLatitude, 1e-12);
  approx(result.longitudeDeg, 0, 1e-12);
});

test("SIM-002: moving east across +180° wraps longitude", () => {
  const start = createWorldCoordinate(0, 179.8);
  const result = destinationPoint(start, 90, kilometers(50));

  assert.ok(result.longitudeDeg < 0, `expected wrapped longitude, got ${result.longitudeDeg}`);
  approx(greatCircleDistance(start, result), kilometers(50), EPS_METERS);
});

test("SIM-002: custom planet radius works", () => {
  const radius = 1_000;
  const quarterCircumference = (Math.PI * radius) / 2;
  const result = destinationPoint(createWorldCoordinate(0, 0), 90, quarterCircumference, radius);

  approx(result.latitudeDeg, 0, 1e-10);
  approx(result.longitudeDeg, 90, 1e-10);
});

test("SIM-003: distance from a point to itself is zero", () => {
  const point = createWorldCoordinate(55.755864, 37.617698);
  assert.equal(greatCircleDistance(point, point), 0);
});

test("SIM-003: great-circle distance is symmetric", () => {
  const a = createWorldCoordinate(10, 20);
  const b = createWorldCoordinate(-15, 170);
  approx(greatCircleDistance(a, b), greatCircleDistance(b, a), EPS_METERS);
});

test("SIM-003: one degree of latitude equals R*pi/180", () => {
  const a = createWorldCoordinate(0, 0);
  const b = createWorldCoordinate(1, 0);
  const expected = DEFAULT_TEST_PLANET_RADIUS_METERS * (Math.PI / 180);
  approx(greatCircleDistance(a, b), expected, EPS_METERS);
});

test("SIM-003: shortest path across antimeridian stays short", () => {
  const a = createWorldCoordinate(0, 179.9);
  const b = createWorldCoordinate(0, -179.9);
  const expected = DEFAULT_TEST_PLANET_RADIUS_METERS * (0.2 * Math.PI / 180);
  approx(greatCircleDistance(a, b), expected, 1e-5);
});

test("SIM-002 + SIM-003: planned distance survives destination calculation", () => {
  const start = createWorldCoordinate(55.755864, 37.617698);
  const plannedDistance = kilometers(100);
  const destination = destinationPoint(start, 315, plannedDistance);
  approx(greatCircleDistance(start, destination), plannedDistance, EPS_METERS);
});
