import test from "node:test";
import assert from "node:assert/strict";
import {
  canSurviveDuration,
  projectSupplies,
  timeToFirstDepletion,
} from "../dist/src/index.js";

const profile = {
  moving: { foodUnitsPerHour: 0.5, waterUnitsPerHour: 1.0 },
  idle: { foodUnitsPerHour: 0.25, waterUnitsPerHour: 0.4 },
};

function approx(actual, expected, tolerance = 1e-12) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );
}

test("SIM-006: T=0 preserves all supplies", () => {
  const state = projectSupplies({ foodUnits: 12, waterUnits: 10 }, profile, "moving", 0);

  assert.equal(state.foodRemaining, 12);
  assert.equal(state.waterRemaining, 10);
  assert.equal(state.depleted, false);
});

test("SIM-006: moving consumption is proportional to elapsed simulation time", () => {
  const state = projectSupplies(
    { foodUnits: 12, waterUnits: 10 },
    profile,
    "moving",
    4 * 3_600,
  );

  approx(state.foodRemaining, 10);
  approx(state.waterRemaining, 6);
  approx(state.foodConsumed, 2);
  approx(state.waterConsumed, 4);
});

test("SIM-006: idle mode consumes less than moving mode", () => {
  const initial = { foodUnits: 12, waterUnits: 10 };
  const moving = projectSupplies(initial, profile, "moving", 4 * 3_600);
  const idle = projectSupplies(initial, profile, "idle", 4 * 3_600);

  assert.ok(idle.foodRemaining > moving.foodRemaining);
  assert.ok(idle.waterRemaining > moving.waterRemaining);
  approx(idle.foodRemaining, 11);
  approx(idle.waterRemaining, 8.4);
});

test("SIM-006: water can be the first depleted resource", () => {
  const result = timeToFirstDepletion(
    { foodUnits: 12, waterUnits: 10 },
    profile,
    "moving",
  );

  assert.equal(result.cause, "water");
  approx(result.atSeconds, 10 * 3_600);
});

test("SIM-006: food can be the first depleted resource", () => {
  const result = timeToFirstDepletion(
    { foodUnits: 2, waterUnits: 100 },
    profile,
    "moving",
  );

  assert.equal(result.cause, "food");
  approx(result.atSeconds, 4 * 3_600);
});

test("SIM-006: simultaneous depletion is reported as both", () => {
  const result = timeToFirstDepletion(
    { foodUnits: 5, waterUnits: 10 },
    profile,
    "moving",
  );

  assert.equal(result.cause, "both");
  approx(result.atSeconds, 10 * 3_600);
});

test("SIM-006: zero consumption means no depletion", () => {
  const zeroProfile = {
    moving: { foodUnitsPerHour: 0, waterUnitsPerHour: 0 },
    idle: { foodUnitsPerHour: 0, waterUnitsPerHour: 0 },
  };
  const result = timeToFirstDepletion(
    { foodUnits: 1, waterUnits: 1 },
    zeroProfile,
    "moving",
  );

  assert.deepEqual(result, { atSeconds: null, cause: null });
  assert.equal(canSurviveDuration({ foodUnits: 1, waterUnits: 1 }, zeroProfile, "moving", 999_999), true);
});

test("SIM-006: depleted stocks are clamped to zero and marked fatal for MVP", () => {
  const state = projectSupplies(
    { foodUnits: 12, waterUnits: 10 },
    profile,
    "moving",
    20 * 3_600,
  );

  assert.equal(state.waterRemaining, 0);
  approx(state.foodRemaining, 2);
  assert.equal(state.depleted, true);
  assert.equal(state.depletionCause, "water");
  approx(state.firstDepletionAtSeconds, 10 * 3_600);
});

test("SIM-006: exact depletion moment is not survivable in MVP", () => {
  const initial = { foodUnits: 12, waterUnits: 10 };

  assert.equal(canSurviveDuration(initial, profile, "moving", 9.999 * 3_600), true);
  assert.equal(canSurviveDuration(initial, profile, "moving", 10 * 3_600), false);
});

test("SIM-006: invalid negative stocks, rates and time are rejected", () => {
  assert.throws(
    () => projectSupplies({ foodUnits: -1, waterUnits: 10 }, profile, "moving", 0),
    /foodUnits must be a non-negative finite number/,
  );

  assert.throws(
    () => projectSupplies(
      { foodUnits: 1, waterUnits: 1 },
      { moving: { foodUnitsPerHour: -1, waterUnitsPerHour: 1 }, idle: profile.idle },
      "moving",
      0,
    ),
    /moving.foodUnitsPerHour must be a non-negative finite number/,
  );

  assert.throws(
    () => projectSupplies({ foodUnits: 1, waterUnits: 1 }, profile, "moving", -1),
    /elapsedSeconds must be a non-negative finite number/,
  );
});
