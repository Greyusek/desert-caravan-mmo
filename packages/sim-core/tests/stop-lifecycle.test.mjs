import test from "node:test";
import assert from "node:assert/strict";
import {
  createRoutePlan,
  createWorldCoordinate,
  evaluateDiscoveryStopLifecycle,
  expeditionTimeToRouteTime,
  routeTimeToExpeditionTime,
} from "../dist/src/index.js";

const route = createRoutePlan(
  createWorldCoordinate(0, 0),
  [{ bearingDeg: 90, distanceMeters: 100_000 }],
  10,
);
const consumption = {
  moving: { foodUnitsPerHour: 10, waterUnitsPerHour: 20 },
  idle: { foodUnitsPerHour: 1, waterUnitsPerHour: 2 },
};
const safeSupplies = { foodUnits: 100, waterUnits: 100 };
const stopAtSeconds = 2_000;
const idleDurationSeconds = 3_600;

function approx(actual, expected, tolerance = 1e-9) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );
}

test("GAME-009: expedition time advances while route time is pinned at STOP", () => {
  const result = evaluateDiscoveryStopLifecycle(
    route,
    safeSupplies,
    consumption,
    stopAtSeconds + 1_800,
    stopAtSeconds,
    idleDurationSeconds,
  );

  assert.equal(result.status, "in-progress");
  assert.equal(result.phase, "idle-at-stop");
  assert.equal(result.movementElapsedSeconds, stopAtSeconds);
  assert.equal(result.idleElapsedSeconds, 1_800);
  assert.equal(result.resumeAtSeconds, stopAtSeconds + idleDurationSeconds);
  approx(result.supplies.foodRemaining, 100 - (10 * 2_000) / 3_600 - 0.5);
  approx(result.supplies.waterRemaining, 100 - (20 * 2_000) / 3_600 - 1);
});

test("GAME-009: resume preserves route time and shifts completion by idle duration", () => {
  const atResume = evaluateDiscoveryStopLifecycle(
    route,
    safeSupplies,
    consumption,
    stopAtSeconds + idleDurationSeconds,
    stopAtSeconds,
    idleDurationSeconds,
  );
  const completed = evaluateDiscoveryStopLifecycle(
    route,
    safeSupplies,
    consumption,
    route.totalDurationSeconds + idleDurationSeconds,
    stopAtSeconds,
    idleDurationSeconds,
  );

  assert.equal(atResume.phase, "moving-after-stop");
  assert.equal(atResume.movementElapsedSeconds, stopAtSeconds);
  assert.equal(completed.status, "completed");
  assert.equal(completed.movementElapsedSeconds, route.totalDurationSeconds);
  assert.equal(
    completed.planned.atSeconds,
    route.totalDurationSeconds + idleDurationSeconds,
  );
  assert.equal(
    completed.planned.movementElapsedSeconds,
    route.totalDurationSeconds,
  );
});

test("GAME-009: fatal idle depletion freezes the caravan at the STOP coordinate", () => {
  const waterAtStop = (consumption.moving.waterUnitsPerHour * stopAtSeconds) / 3_600;
  const result = evaluateDiscoveryStopLifecycle(
    route,
    { foodUnits: 100, waterUnits: waterAtStop + 1 },
    consumption,
    route.totalDurationSeconds + idleDurationSeconds,
    stopAtSeconds,
    idleDurationSeconds,
  );

  assert.equal(result.status, "failed");
  assert.equal(result.failureActivity, "idle");
  assert.equal(result.failureCause, "water");
  assert.equal(result.endedAtSeconds, stopAtSeconds + 1_800);
  assert.equal(result.movementElapsedSeconds, stopAtSeconds);
  assert.equal(result.supplies.waterRemaining, 0);
});

test("GAME-009: depletion exactly when waiting ends defeats resume", () => {
  const waterAtStop = (consumption.moving.waterUnitsPerHour * stopAtSeconds) / 3_600;
  const result = evaluateDiscoveryStopLifecycle(
    route,
    {
      foodUnits: 100,
      waterUnits:
        waterAtStop +
        consumption.idle.waterUnitsPerHour * (idleDurationSeconds / 3_600),
    },
    consumption,
    stopAtSeconds + idleDurationSeconds,
    stopAtSeconds,
    idleDurationSeconds,
  );

  assert.equal(result.status, "failed");
  assert.equal(result.failureActivity, "idle");
  assert.equal(result.endedAtSeconds, stopAtSeconds + idleDurationSeconds);
  assert.equal(result.movementElapsedSeconds, stopAtSeconds);
  assert.equal(result.terminal, true);
});

test("GAME-009: post-resume depletion includes both consumption phases", () => {
  const result = evaluateDiscoveryStopLifecycle(
    route,
    { foodUnits: 100, waterUnits: 50 },
    consumption,
    route.totalDurationSeconds + idleDurationSeconds,
    stopAtSeconds,
    idleDurationSeconds,
  );

  const waterAfterIdle =
    50 -
    (consumption.moving.waterUnitsPerHour * stopAtSeconds) / 3_600 -
    consumption.idle.waterUnitsPerHour * (idleDurationSeconds / 3_600);
  const postResumeSeconds =
    (waterAfterIdle / consumption.moving.waterUnitsPerHour) * 3_600;
  assert.equal(result.status, "failed");
  assert.equal(result.failureActivity, "moving");
  approx(
    result.endedAtSeconds ?? 0,
    stopAtSeconds + idleDurationSeconds + postResumeSeconds,
  );
  approx(
    result.movementElapsedSeconds,
    stopAtSeconds + postResumeSeconds,
  );
});

test("GAME-009: city entry and route-end pause use shifted world time", () => {
  const cityEntry = evaluateDiscoveryStopLifecycle(
    route,
    safeSupplies,
    consumption,
    8_600,
    stopAtSeconds,
    idleDurationSeconds,
    5_000,
  );
  const routeEnd = evaluateDiscoveryStopLifecycle(
    route,
    safeSupplies,
    consumption,
    13_600,
    stopAtSeconds,
    idleDurationSeconds,
    null,
  );

  assert.equal(cityEntry.status, "completed");
  assert.equal(cityEntry.endedAtSeconds, 8_600);
  assert.equal(cityEntry.movementElapsedSeconds, 5_000);
  assert.equal(routeEnd.status, "paused");
  assert.equal(routeEnd.endedAtSeconds, 13_600);
  assert.equal(routeEnd.terminal, false);
});

test("GAME-009: route/world mapping is exact across the idle interval", () => {
  assert.equal(
    expeditionTimeToRouteTime(3_000, stopAtSeconds, idleDurationSeconds),
    stopAtSeconds,
  );
  assert.equal(
    expeditionTimeToRouteTime(6_100, stopAtSeconds, idleDurationSeconds),
    2_500,
  );
  assert.equal(
    routeTimeToExpeditionTime(2_500, stopAtSeconds, idleDurationSeconds),
    6_100,
  );
  assert.equal(
    routeTimeToExpeditionTime(stopAtSeconds, stopAtSeconds, idleDurationSeconds),
    stopAtSeconds,
  );
});

test("GAME-009: invalid stop duration and route boundary are rejected", () => {
  assert.throws(
    () =>
      evaluateDiscoveryStopLifecycle(
        route,
        safeSupplies,
        consumption,
        0,
        route.totalDurationSeconds + 1,
        idleDurationSeconds,
      ),
    /stopAtRouteSeconds must not exceed route total duration/,
  );
  assert.throws(
    () =>
      evaluateDiscoveryStopLifecycle(
        route,
        safeSupplies,
        consumption,
        0,
        stopAtSeconds,
        -1,
      ),
    /idleDurationSeconds must be a non-negative finite number/,
  );
});
