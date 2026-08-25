import test from "node:test";
import assert from "node:assert/strict";
import {
  createRoutePlan,
  createWorldCoordinate,
  destinationPoint,
  findFirstExpeditionMonsterContact,
  findFirstExpeditionMonsterDangerDetectionDuringIdleStop,
  greatCircleDistance,
  planExpeditionMonsterDangerResponseDuringIdleStop,
} from "../dist/src/index.js";

const PLANET_RADIUS_METERS = 1_000_000;
const SPEED_METERS_PER_SECOND = 10;

function idleWarningScenario() {
  const stop = createWorldCoordinate(0, 0);
  const south = destinationPoint(
    stop,
    180,
    1_000,
    PLANET_RADIUS_METERS,
  );
  const west = destinationPoint(
    stop,
    270,
    2_400,
    PLANET_RADIUS_METERS,
  );
  const expeditionRoute = createRoutePlan(
    south,
    [{ bearingDeg: 0, distanceMeters: 2_000 }],
    SPEED_METERS_PER_SECOND,
    PLANET_RADIUS_METERS,
  );
  const patrolRoute = createRoutePlan(
    west,
    [
      { bearingDeg: 90, distanceMeters: 4_800 },
      { bearingDeg: 270, distanceMeters: 4_800 },
    ],
    SPEED_METERS_PER_SECOND,
    PLANET_RADIUS_METERS,
  );

  return {
    stop,
    stopAtRouteSeconds: 100,
    idleDurationSeconds: 200,
    expeditionRoute,
    monster: {
      id: "idle-danger-patrol",
      kind: "wandering-monster",
      power: 110,
      visionRadiusMeters: 300,
      interactionRadiusMeters: 500,
      patrolRoute,
    },
  };
}

test("GAME-021: warning world time advances while route time stays pinned at STOP", () => {
  const scenario = idleWarningScenario();
  const detection =
    findFirstExpeditionMonsterDangerDetectionDuringIdleStop(
      scenario.expeditionRoute,
      scenario.monster,
      scenario.stopAtRouteSeconds,
      scenario.idleDurationSeconds,
    );

  assert.ok(detection);
  assert.equal(detection.caravanActivity, "idle");
  approx(detection.expeditionElapsedSeconds, 140, 1e-5);
  assert.equal(detection.routeElapsedSeconds, 100);
  approx(detection.separationMeters, 1_000, 1e-5);
  assert.equal(detection.contactOrder, "before-contact");
  approx(detection.plannedContactAtSeconds, 190, 1e-5);
  approx(detection.secondsUntilContact, 50, 1e-5);
  approx(
    greatCircleDistance(
      detection.caravanPosition,
      scenario.stop,
      PLANET_RADIUS_METERS,
    ),
    0,
    1e-7,
  );
});

test("GAME-021: CONTINUE keeps the original route, full wait and idle contact", () => {
  const scenario = idleWarningScenario();
  const plan = planExpeditionMonsterDangerResponseDuringIdleStop(
    scenario.expeditionRoute,
    scenario.monster,
    "CONTINUE",
    scenario.stopAtRouteSeconds,
    scenario.idleDurationSeconds,
  );

  assert.equal(plan.status, "continued");
  assert.equal(plan.triggersDuringIdleStop, true);
  assert.equal(plan.originalRoute, scenario.expeditionRoute);
  assert.equal(plan.effectiveRoute, scenario.expeditionRoute);
  assert.equal(plan.routeChanged, false);
  assert.equal(plan.scheduledIdleDurationSeconds, 200);
  assert.equal(plan.effectiveIdleDurationSeconds, 200);
  assert.equal(plan.interruptsIdleStop, false);
  assert.equal(plan.effectiveContact, plan.originalContact);
  assert.equal(plan.originalContact?.caravanActivity, "idle");
  approx(plan.originalContact?.expeditionElapsedSeconds, 190, 1e-5);
});

test("GAME-021: AVOID cancels only the remaining wait and leaves the exact STOP coordinate", () => {
  const scenario = idleWarningScenario();
  const plan = planExpeditionMonsterDangerResponseDuringIdleStop(
    scenario.expeditionRoute,
    scenario.monster,
    "AVOID",
    scenario.stopAtRouteSeconds,
    scenario.idleDurationSeconds,
  );

  assert.equal(plan.status, "avoided");
  assert.equal(plan.routeChanged, true);
  assert.equal(plan.interruptsIdleStop, true);
  assert.equal(plan.scheduledIdleDurationSeconds, 200);
  approx(plan.effectiveIdleDurationSeconds, 40, 1e-5);
  assert.deepEqual(plan.detourSegmentIndexes, [1, 2]);
  assert.equal(plan.effectiveRoute.segments.length, 3);
  assert.equal(plan.effectiveRoute.segments[0]?.distanceMeters, 1_000);
  approx(
    greatCircleDistance(
      plan.effectiveRoute.segments[0].end,
      scenario.stop,
      PLANET_RADIUS_METERS,
    ),
    0,
    1e-7,
  );
  approx(
    greatCircleDistance(
      plan.decisionPosition,
      scenario.stop,
      PLANET_RADIUS_METERS,
    ),
    0,
    1e-7,
  );
  approx(
    plan.completionAtExpeditionSeconds,
    plan.effectiveRoute.totalDurationSeconds + 40,
    1e-5,
  );
});

test("GAME-021: accepted detour is contact-free from its real world departure", () => {
  const scenario = idleWarningScenario();
  const plan = planExpeditionMonsterDangerResponseDuringIdleStop(
    scenario.expeditionRoute,
    scenario.monster,
    "AVOID",
    scenario.stopAtRouteSeconds,
    scenario.idleDurationSeconds,
  );

  assert.equal(plan.status, "avoided");
  assert.ok(plan.decisionPosition);
  const continuation = createRoutePlan(
    plan.decisionPosition,
    plan.effectiveRoute.segments.slice(1).map((segment) => ({
      bearingDeg: segment.bearingDeg,
      distanceMeters: segment.distanceMeters,
    })),
    plan.effectiveRoute.speedMetersPerSecond,
    plan.effectiveRoute.planetRadiusMeters,
  );
  assert.equal(
    findFirstExpeditionMonsterContact(
      continuation,
      scenario.monster,
      plan.decisionAtSeconds,
    ),
    null,
  );
  assert.ok(plan.originalContact);
  assert.equal(plan.effectiveContact, null);
});

test("GAME-021: contact wins a warning tie at the start of STOP", () => {
  const stop = createWorldCoordinate(0, 0);
  const route = createRoutePlan(
    stop,
    [{ bearingDeg: 0, distanceMeters: 2_000 }],
    SPEED_METERS_PER_SECOND,
    PLANET_RADIUS_METERS,
  );
  const patrolRoute = createRoutePlan(
    stop,
    [
      { bearingDeg: 90, distanceMeters: 2_000 },
      { bearingDeg: 270, distanceMeters: 2_000 },
    ],
    SPEED_METERS_PER_SECOND,
    PLANET_RADIUS_METERS,
  );
  const monster = {
    id: "unsafe-idle-patrol",
    kind: "wandering-monster",
    power: 110,
    visionRadiusMeters: 300,
    interactionRadiusMeters: 500,
    patrolRoute,
  };
  const plan = planExpeditionMonsterDangerResponseDuringIdleStop(
    route,
    monster,
    "AVOID",
    0,
    100,
  );

  assert.equal(plan.detection?.contactOrder, "at-contact");
  assert.equal(plan.status, "blocked-by-contact");
  assert.equal(plan.effectiveRoute, route);
  assert.equal(plan.interruptsIdleStop, false);
  assert.equal(plan.originalContact?.expeditionElapsedSeconds, 0);
});

test("GAME-021: an earlier or tied authoritative boundary blocks doctrine execution", () => {
  const scenario = idleWarningScenario();
  const probe = planExpeditionMonsterDangerResponseDuringIdleStop(
    scenario.expeditionRoute,
    scenario.monster,
    "AVOID",
    scenario.stopAtRouteSeconds,
    scenario.idleDurationSeconds,
  );
  assert.ok(probe.detection);

  for (const blocker of [
    probe.detection.expeditionElapsedSeconds - 1,
    probe.detection.expeditionElapsedSeconds,
  ]) {
    const blocked = planExpeditionMonsterDangerResponseDuringIdleStop(
      scenario.expeditionRoute,
      scenario.monster,
      "AVOID",
      scenario.stopAtRouteSeconds,
      scenario.idleDurationSeconds,
      0,
      1_000,
      blocker,
    );
    assert.equal(blocked.status, "blocked-by-earlier-boundary");
    assert.equal(blocked.effectiveRoute, scenario.expeditionRoute);
    assert.equal(blocked.effectiveIdleDurationSeconds, 200);
  }
});

test("GAME-021: a pre-STOP warning is not emitted again and cycle delay stays deterministic", () => {
  const scenario = idleWarningScenario();
  assert.equal(
    findFirstExpeditionMonsterDangerDetectionDuringIdleStop(
      scenario.expeditionRoute,
      scenario.monster,
      170,
      100,
    ),
    null,
  );

  const immediate = planExpeditionMonsterDangerResponseDuringIdleStop(
    scenario.expeditionRoute,
    scenario.monster,
    "AVOID",
    scenario.stopAtRouteSeconds,
    scenario.idleDurationSeconds,
  );
  const delayed = planExpeditionMonsterDangerResponseDuringIdleStop(
    scenario.expeditionRoute,
    scenario.monster,
    "AVOID",
    scenario.stopAtRouteSeconds,
    scenario.idleDurationSeconds,
    scenario.monster.patrolRoute.totalDurationSeconds,
  );
  assert.equal(delayed.status, "avoided");
  assert.deepEqual(delayed.effectiveRoute, immediate.effectiveRoute);
  assert.equal(delayed.detourSide, immediate.detourSide);
  approx(
    delayed.decisionAtSeconds - immediate.decisionAtSeconds,
    scenario.monster.patrolRoute.totalDurationSeconds,
    1e-5,
  );
  approx(
    delayed.effectiveIdleDurationSeconds,
    immediate.effectiveIdleDurationSeconds,
    1e-5,
  );
});

test("GAME-021: STOP timing and blocker inputs are validated", () => {
  const scenario = idleWarningScenario();

  assert.throws(
    () =>
      planExpeditionMonsterDangerResponseDuringIdleStop(
        scenario.expeditionRoute,
        scenario.monster,
        "AVOID",
        scenario.expeditionRoute.totalDurationSeconds + 1,
        100,
      ),
    /stopAtRouteSeconds must not exceed route total duration/,
  );
  assert.throws(
    () =>
      planExpeditionMonsterDangerResponseDuringIdleStop(
        scenario.expeditionRoute,
        scenario.monster,
        "AVOID",
        100,
        -1,
      ),
    /idleDurationSeconds must be a non-negative finite number/,
  );
  assert.throws(
    () =>
      planExpeditionMonsterDangerResponseDuringIdleStop(
        scenario.expeditionRoute,
        scenario.monster,
        "AVOID",
        100,
        200,
        0,
        1_000,
        -1,
      ),
    /blockingExpeditionAtSeconds must be a non-negative finite number/,
  );
});

function approx(actual, expected, tolerance = 1e-6) {
  assert.ok(actual !== null && actual !== undefined);
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );
}
