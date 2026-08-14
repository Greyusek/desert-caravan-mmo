import test from "node:test";
import assert from "node:assert/strict";
import {
  createRoutePlan,
  createWorldCoordinate,
  destinationPoint,
  greatCircleDistance,
  kilometers,
  positionAtTime,
} from "../dist/src/index.js";

const EPS_METERS = 1e-6;
const EPS_COORD_METERS = 1e-5;

function approx(actual, expected, tolerance, message) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    message ?? `expected ${actual} to be within ${tolerance} of ${expected}`,
  );
}

const start = createWorldCoordinate(55.755864, 37.617698);
const commands = [
  { bearingDeg: 315, distanceMeters: kilometers(20) },
  { bearingDeg: 270, distanceMeters: kilometers(12) },
  { bearingDeg: 225, distanceMeters: kilometers(20) },
  { bearingDeg: 90, distanceMeters: kilometers(35) },
];
const speedMetersPerSecond = 5_000 / 3_600; // 5 km/h

test("SIM-004: route resolves every command into a chained segment", () => {
  const route = createRoutePlan(start, commands, speedMetersPerSecond);

  assert.equal(route.segments.length, 4);
  assert.deepEqual(route.segments[0].start, start);
  assert.deepEqual(route.segments[1].start, route.segments[0].end);
  assert.deepEqual(route.segments[2].start, route.segments[1].end);
  assert.deepEqual(route.segments[3].start, route.segments[2].end);
  assert.deepEqual(route.end, route.segments[3].end);
});

test("SIM-004: route total distance is the sum of planned segments", () => {
  const route = createRoutePlan(start, commands, speedMetersPerSecond);
  approx(route.totalDistanceMeters, kilometers(87), EPS_METERS);
});

test("SIM-004: ETA is accumulated from speed and distance", () => {
  const route = createRoutePlan(start, commands, speedMetersPerSecond);

  approx(route.segments[0].etaEndSeconds, 4 * 3_600, 1e-9);
  approx(route.segments[1].etaEndSeconds, 6.4 * 3_600, 1e-9);
  approx(route.totalDurationSeconds, 17.4 * 3_600, 1e-9);
});

test("SIM-004: every resolved segment preserves its planned surface distance", () => {
  const route = createRoutePlan(start, commands, speedMetersPerSecond);

  for (const segment of route.segments) {
    approx(
      greatCircleDistance(segment.start, segment.end),
      segment.distanceMeters,
      EPS_COORD_METERS,
      `segment ${segment.index} changed its planned distance`,
    );
  }
});

test("SIM-004: invalid empty route and non-positive speed are rejected", () => {
  assert.throws(() => createRoutePlan(start, [], speedMetersPerSecond), /at least one segment/);
  assert.throws(() => createRoutePlan(start, commands, 0), /positive finite/);
});

test("SIM-005: at T=0 caravan is exactly at route start", () => {
  const route = createRoutePlan(start, commands, speedMetersPerSecond);
  const position = positionAtTime(route, 0);

  assert.equal(position.status, "moving");
  assert.equal(position.segmentIndex, 0);
  assert.equal(position.segmentProgress, 0);
  approx(greatCircleDistance(position.coordinate, start), 0, EPS_METERS);
  approx(position.traveledDistanceMeters, 0, EPS_METERS);
});

test("SIM-005: position halfway through first segment is halfway along it", () => {
  const route = createRoutePlan(start, commands, speedMetersPerSecond);
  const position = positionAtTime(route, 2 * 3_600); // 10 km at 5 km/h
  const expected = destinationPoint(start, 315, kilometers(10));

  assert.equal(position.segmentIndex, 0);
  approx(position.segmentProgress, 0.5, 1e-12);
  approx(greatCircleDistance(position.coordinate, expected), 0, EPS_COORD_METERS);
  approx(position.traveledDistanceMeters, kilometers(10), EPS_METERS);
});

test("SIM-005: exact segment boundary starts the next segment", () => {
  const route = createRoutePlan(start, commands, speedMetersPerSecond);
  const position = positionAtTime(route, 4 * 3_600);

  assert.equal(position.segmentIndex, 1);
  approx(position.segmentProgress, 0, 1e-12);
  approx(greatCircleDistance(position.coordinate, route.segments[0].end), 0, EPS_METERS);
  approx(position.traveledDistanceMeters, kilometers(20), EPS_METERS);
});

test("SIM-005: after total ETA caravan remains at final destination", () => {
  const route = createRoutePlan(start, commands, speedMetersPerSecond);
  const position = positionAtTime(route, route.totalDurationSeconds + 99_999);

  assert.equal(position.status, "arrived");
  assert.equal(position.segmentIndex, null);
  assert.equal(position.segmentProgress, 1);
  approx(greatCircleDistance(position.coordinate, route.end), 0, EPS_METERS);
  approx(position.traveledDistanceMeters, route.totalDistanceMeters, EPS_METERS);
  assert.equal(position.remainingDistanceMeters, 0);
});

test("SIM-005: negative elapsed time is rejected", () => {
  const route = createRoutePlan(start, commands, speedMetersPerSecond);
  assert.throws(() => positionAtTime(route, -1), /non-negative finite/);
});
