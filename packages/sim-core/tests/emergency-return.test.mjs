import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_EMERGENCY_SUPPLY_FRACTION,
  createRoutePlan,
  createWorldCoordinate,
  findFirstCityArrival,
  greatCircleDistance,
  planEmergencySupplyReturn,
  projectSupplies,
  timeToSupplyEmergencyThreshold,
} from "../dist/src/index.js";

const start = createWorldCoordinate(0, 0);
const profile = {
  moving: { foodUnitsPerHour: 10, waterUnitsPerHour: 10 },
  idle: { foodUnitsPerHour: 2, waterUnitsPerHour: 3 },
};

function approx(actual, expected, tolerance = 1e-7) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );
}

test("GAME-017: first 50% supply threshold is exact and identifies food", () => {
  const threshold = timeToSupplyEmergencyThreshold(
    { foodUnits: 100, waterUnits: 200 },
    profile,
    "moving",
  );

  assert.deepEqual(threshold, {
    atSeconds: 5 * 3_600,
    cause: "food",
    remainingFraction: 0.5,
    foodRemaining: 50,
    waterRemaining: 150,
  });
  assert.equal(DEFAULT_EMERGENCY_SUPPLY_FRACTION, 0.5);
});

test("GAME-017: simultaneous critical supplies produce one both boundary", () => {
  const threshold = timeToSupplyEmergencyThreshold(
    { foodUnits: 100, waterUnits: 200 },
    {
      moving: { foodUnitsPerHour: 10, waterUnitsPerHour: 20 },
      idle: profile.idle,
    },
    "moving",
  );

  assert.equal(threshold?.atSeconds, 5 * 3_600);
  assert.equal(threshold?.cause, "both");
  assert.equal(threshold?.foodRemaining, 50);
  assert.equal(threshold?.waterRemaining, 100);
});

test("GAME-017: zero consumption never triggers an emergency threshold", () => {
  assert.equal(
    timeToSupplyEmergencyThreshold(
      { foodUnits: 100, waterUnits: 200 },
      {
        moving: { foodUnitsPerHour: 0, waterUnitsPerHour: 0 },
        idle: profile.idle,
      },
      "moving",
    ),
    null,
  );
});

test("GAME-017: RETURN replaces the future route with a direct origin leg", () => {
  const route = createRoutePlan(
    start,
    [
      { bearingDeg: 90, distanceMeters: 20_000 },
      { bearingDeg: 0, distanceMeters: 20_000 },
    ],
    10,
  );
  const plan = planEmergencySupplyReturn(
    route,
    { foodUnits: 100, waterUnits: 1_000 },
    {
      moving: { foodUnitsPerHour: 72, waterUnitsPerHour: 1 },
      idle: profile.idle,
    },
    "RETURN_TO_ORIGIN",
  );

  assert.equal(plan.threshold?.atSeconds, 2_500);
  assert.equal(plan.triggersBeforeRouteEnd, true);
  assert.equal(plan.effectiveRoute.segments.length, 3);
  assert.equal(plan.effectiveRoute.segments[0]?.distanceMeters, 20_000);
  assert.equal(plan.effectiveRoute.segments[1]?.distanceMeters, 5_000);
  assert.equal(plan.returnSegmentIndex, 2);
  assert.ok((plan.returnDistanceMeters ?? 0) > 20_000);
  approx(
    greatCircleDistance(plan.effectiveRoute.end, start),
    0,
    1e-6,
  );
});

test("GAME-017: emergency return reaches the origin radius before depletion", () => {
  const route = createRoutePlan(
    start,
    [{ bearingDeg: 90, distanceMeters: 40_000 }],
    5,
  );
  const supplies = { foodUnits: 100, waterUnits: 100 };
  const consumption = {
    moving: { foodUnitsPerHour: 45, waterUnitsPerHour: 45 },
    idle: { foodUnitsPerHour: 0, waterUnitsPerHour: 0 },
  };
  const plan = planEmergencySupplyReturn(
    route,
    supplies,
    consumption,
    "RETURN_TO_ORIGIN",
  );
  const origin = { id: "city-origin", name: "Origin", position: start };
  const arrival = findFirstCityArrival(plan.effectiveRoute, origin);

  assert.equal(plan.threshold?.atSeconds, 4_000);
  assert.ok(arrival);
  assert.equal(arrival.kind, "reentry");
  assert.ok(arrival.elapsedSeconds < (plan.returnToOriginAtSeconds ?? 0));
  assert.equal(
    projectSupplies(
      supplies,
      consumption,
      "moving",
      arrival.elapsedSeconds,
    ).depleted,
    false,
  );
});

test("GAME-017: CONTINUE records the boundary without changing the route", () => {
  const route = createRoutePlan(
    start,
    [{ bearingDeg: 90, distanceMeters: 200_000 }],
    10,
  );
  const plan = planEmergencySupplyReturn(
    route,
    { foodUnits: 100, waterUnits: 200 },
    profile,
    "CONTINUE",
  );

  assert.equal(plan.triggersBeforeRouteEnd, true);
  assert.equal(plan.effectiveRoute, route);
  assert.equal(plan.returnDistanceMeters, null);
});

test("GAME-017: a threshold after arrival does not rewrite the route", () => {
  const route = createRoutePlan(
    start,
    [{ bearingDeg: 90, distanceMeters: 1_000 }],
    10,
  );
  const plan = planEmergencySupplyReturn(
    route,
    { foodUnits: 100, waterUnits: 200 },
    profile,
    "RETURN_TO_ORIGIN",
  );

  assert.equal(plan.triggersBeforeRouteEnd, false);
  assert.equal(plan.effectiveRoute, route);
});

test("GAME-017: doctrine and threshold fraction are validated", () => {
  const route = createRoutePlan(
    start,
    [{ bearingDeg: 90, distanceMeters: 1_000 }],
    10,
  );

  assert.throws(
    () =>
      planEmergencySupplyReturn(
        route,
        { foodUnits: 100, waterUnits: 200 },
        profile,
        "STOP",
      ),
    /RETURN_TO_ORIGIN or CONTINUE/,
  );
  for (const fraction of [0, 1, -0.1, Number.NaN]) {
    assert.throws(
      () =>
        timeToSupplyEmergencyThreshold(
          { foodUnits: 100, waterUnits: 200 },
          profile,
          "moving",
          fraction,
        ),
      /remainingFraction/,
    );
  }
});
