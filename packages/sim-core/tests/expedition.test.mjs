import test from "node:test";
import assert from "node:assert/strict";
import {
  createRoutePlan,
  createWorldCoordinate,
  evaluateExpeditionOutcome,
} from "../dist/src/index.js";

const route = createRoutePlan(
  createWorldCoordinate(0, 0),
  [{ bearingDeg: 90, distanceMeters: 100_000 }],
  10,
);
const safeSupplies = { foodUnits: 100, waterUnits: 100 };
const consumption = {
  moving: { foodUnitsPerHour: 10, waterUnitsPerHour: 20 },
  idle: { foodUnitsPerHour: 1, waterUnitsPerHour: 2 },
};

test("GAME-003: expedition remains in progress before its first boundary", () => {
  const result = evaluateExpeditionOutcome(
    route,
    safeSupplies,
    consumption,
    1_000,
  );

  assert.equal(result.status, "in-progress");
  assert.equal(result.movementElapsedSeconds, 1_000);
  assert.equal(result.endedAtSeconds, null);
  assert.equal(result.terminal, false);
  assert.deepEqual(result.planned, {
    status: "completed",
    atSeconds: 10_000,
    failureCause: null,
  });
});

test("GAME-003: arrival completes the expedition and caps later evaluation", () => {
  const result = evaluateExpeditionOutcome(
    route,
    safeSupplies,
    consumption,
    99_000,
  );

  assert.equal(result.status, "completed");
  assert.equal(result.movementElapsedSeconds, route.totalDurationSeconds);
  assert.equal(result.endedAtSeconds, route.totalDurationSeconds);
  assert.equal(result.failureCause, null);
  assert.equal(result.terminal, true);
});

test("GAME-003: fatal depletion before arrival fails and freezes movement", () => {
  const result = evaluateExpeditionOutcome(
    route,
    { foodUnits: 100, waterUnits: 20 },
    consumption,
    9_000,
  );

  assert.equal(result.status, "failed");
  assert.equal(result.movementElapsedSeconds, 3_600);
  assert.equal(result.endedAtSeconds, 3_600);
  assert.equal(result.failureCause, "water");
  assert.deepEqual(result.planned, {
    status: "failed",
    atSeconds: 3_600,
    failureCause: "water",
  });
});

test("GAME-003: exact depletion at arrival is fatal for MVP", () => {
  const exactHours = route.totalDurationSeconds / 3_600;
  const result = evaluateExpeditionOutcome(
    route,
    {
      foodUnits: exactHours * consumption.moving.foodUnitsPerHour,
      waterUnits: exactHours * consumption.moving.waterUnitsPerHour,
    },
    consumption,
    route.totalDurationSeconds,
  );

  assert.equal(result.status, "failed");
  assert.equal(result.endedAtSeconds, route.totalDurationSeconds);
  assert.equal(result.failureCause, "both");
});

test("GAME-003: an earlier doctrine pause prevents later route outcomes", () => {
  const result = evaluateExpeditionOutcome(
    route,
    { foodUnits: 100, waterUnits: 20 },
    consumption,
    9_000,
    2_000,
  );

  assert.equal(result.status, "paused");
  assert.equal(result.movementElapsedSeconds, 2_000);
  assert.equal(result.endedAtSeconds, 2_000);
  assert.equal(result.failureCause, null);
  assert.equal(result.terminal, false);
});

test("GAME-003: fatal depletion wins an exact tie with doctrine STOP", () => {
  const result = evaluateExpeditionOutcome(
    route,
    { foodUnits: 100, waterUnits: 20 },
    consumption,
    3_600,
    3_600,
  );

  assert.equal(result.status, "failed");
  assert.equal(result.failureCause, "water");
});

test("GAME-003: zero consumption always reaches completion", () => {
  const result = evaluateExpeditionOutcome(
    route,
    { foodUnits: 1, waterUnits: 1 },
    {
      moving: { foodUnitsPerHour: 0, waterUnitsPerHour: 0 },
      idle: { foodUnitsPerHour: 0, waterUnitsPerHour: 0 },
    },
    route.totalDurationSeconds,
  );

  assert.equal(result.status, "completed");
  assert.equal(result.failureCause, null);
});

test("GAME-003: invalid evaluation and pause times are rejected", () => {
  assert.throws(
    () =>
      evaluateExpeditionOutcome(
        route,
        safeSupplies,
        consumption,
        -1,
      ),
    /elapsedSeconds must be a non-negative finite number/,
  );
  assert.throws(
    () =>
      evaluateExpeditionOutcome(
        route,
        safeSupplies,
        consumption,
        0,
        Number.NaN,
      ),
    /pausedAtSeconds must be a non-negative finite number/,
  );
});
