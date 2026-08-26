import test from "node:test";
import assert from "node:assert/strict";
import {
  createRoutePlan,
  createWorldCoordinate,
  destinationPoint,
  findFirstExpeditionMonsterContact,
  planExpeditionMonsterDangerResponseDuringIdleStop,
  planExpeditionMonsterDangerResponseDuringIdleStopAmongPatrols,
} from "../dist/src/index.js";

const PLANET_RADIUS_METERS = 1_000_000;
const SPEED_METERS_PER_SECOND = 10;

function idleWarningScenario() {
  const stop = createWorldCoordinate(0, 0);
  const south = destinationPoint(stop, 180, 1_000, PLANET_RADIUS_METERS);
  const west = destinationPoint(stop, 270, 2_400, PLANET_RADIUS_METERS);
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
    monster: createMonster("idle-trigger", patrolRoute),
  };
}

function createMonster(id, patrolRoute, interactionRadiusMeters = 500) {
  return {
    id,
    kind: "wandering-monster",
    power: 110,
    visionRadiusMeters: 300,
    interactionRadiusMeters,
    patrolRoute,
  };
}

function distantMonster(id = "distant-patrol") {
  const start = createWorldCoordinate(30, 30);
  const patrolRoute = createRoutePlan(
    start,
    [
      { bearingDeg: 0, distanceMeters: 2_000 },
      { bearingDeg: 180, distanceMeters: 2_000 },
    ],
    SPEED_METERS_PER_SECOND,
    PLANET_RADIUS_METERS,
  );
  return createMonster(id, patrolRoute);
}

function continuationAfterDecision(plan) {
  assert.ok(plan.decisionPosition);
  assert.ok(plan.detourSegmentIndexes);
  return createRoutePlan(
    plan.decisionPosition,
    plan.effectiveRoute.segments
      .slice(plan.detourSegmentIndexes[0])
      .map((segment) => ({
        bearingDeg: segment.bearingDeg,
        distanceMeters: segment.distanceMeters,
      })),
    plan.effectiveRoute.speedMetersPerSecond,
    plan.effectiveRoute.planetRadiusMeters,
  );
}

test("GAME-024: CONTINUE preserves the full STOP and stable first contact", () => {
  const scenario = idleWarningScenario();
  const alpha = { ...scenario.monster, id: "idle-a" };
  const beta = { ...scenario.monster, id: "idle-b" };
  const plan =
    planExpeditionMonsterDangerResponseDuringIdleStopAmongPatrols(
      scenario.expeditionRoute,
      [beta, alpha],
      "CONTINUE",
      scenario.stopAtRouteSeconds,
      scenario.idleDurationSeconds,
    );

  assert.equal(plan.status, "continued");
  assert.equal(plan.detection?.monsterId, "idle-a");
  assert.equal(plan.originalContact?.monsterId, "idle-a");
  assert.equal(plan.originalContact?.caravanActivity, "idle");
  assert.equal(plan.effectiveRoute, scenario.expeditionRoute);
  assert.equal(plan.effectiveContact, plan.originalContact);
  assert.equal(plan.effectiveIdleDurationSeconds, 200);
  assert.equal(plan.interruptsIdleStop, false);
  assert.deepEqual(plan.clearanceMonsterIds, ["idle-a", "idle-b"]);
});

test("GAME-024: AVOID leaves the exact STOP time and clears every patrol", () => {
  const scenario = idleWarningScenario();
  const patrols = [distantMonster(), scenario.monster];
  const plan =
    planExpeditionMonsterDangerResponseDuringIdleStopAmongPatrols(
      scenario.expeditionRoute,
      patrols,
      "AVOID",
      scenario.stopAtRouteSeconds,
      scenario.idleDurationSeconds,
    );

  assert.equal(plan.status, "avoided");
  assert.equal(plan.triggersDuringIdleStop, true);
  assert.equal(plan.interruptsIdleStop, true);
  approx(plan.decisionRouteElapsedSeconds, 100);
  approx(plan.effectiveIdleDurationSeconds, 40, 1e-5);
  approx(
    plan.completionAtExpeditionSeconds,
    plan.effectiveRoute.totalDurationSeconds +
      plan.effectiveIdleDurationSeconds,
    1e-5,
  );
  const continuation = continuationAfterDecision(plan);
  for (const patrol of patrols) {
    assert.equal(
      findFirstExpeditionMonsterContact(
        continuation,
        patrol,
        plan.decisionAtSeconds,
      ),
      null,
    );
  }
});

test("GAME-024: a second patrol rejects a single-patrol unsafe STOP detour", () => {
  const scenario = idleWarningScenario();
  const single = planExpeditionMonsterDangerResponseDuringIdleStop(
    scenario.expeditionRoute,
    scenario.monster,
    "AVOID",
    scenario.stopAtRouteSeconds,
    scenario.idleDurationSeconds,
  );
  assert.equal(single.status, "avoided");
  assert.ok(single.detourWaypoint);
  const blockerRoute = createRoutePlan(
    single.detourWaypoint,
    [
      { bearingDeg: 0, distanceMeters: 2 },
      { bearingDeg: 180, distanceMeters: 2 },
    ],
    0.1,
    PLANET_RADIUS_METERS,
  );
  const blocker = createMonster("detour-blocker", blockerRoute);
  const singleContinuation = continuationAfterDecision(single);
  assert.ok(
    findFirstExpeditionMonsterContact(
      singleContinuation,
      blocker,
      single.decisionAtSeconds,
    ),
  );

  const plan =
    planExpeditionMonsterDangerResponseDuringIdleStopAmongPatrols(
      scenario.expeditionRoute,
      [blocker, scenario.monster],
      "AVOID",
      scenario.stopAtRouteSeconds,
      scenario.idleDurationSeconds,
    );

  assert.notDeepEqual(plan.effectiveRoute, single.effectiveRoute);
  if (plan.status === "avoided") {
    const continuation = continuationAfterDecision(plan);
    for (const patrol of [blocker, scenario.monster]) {
      assert.equal(
        findFirstExpeditionMonsterContact(
          continuation,
          patrol,
          plan.decisionAtSeconds,
        ),
        null,
      );
    }
  } else {
    assert.equal(plan.status, "detour-unavailable");
    assert.equal(plan.effectiveRoute, scenario.expeditionRoute);
  }
});

test("GAME-024: contact from any patrol keeps priority during STOP", () => {
  const scenario = idleWarningScenario();
  const west = destinationPoint(
    scenario.stop,
    270,
    1_000,
    PLANET_RADIUS_METERS,
  );
  const contactRoute = createRoutePlan(
    west,
    [
      { bearingDeg: 90, distanceMeters: 1_000 },
      { bearingDeg: 270, distanceMeters: 1_000 },
    ],
    SPEED_METERS_PER_SECOND,
    PLANET_RADIUS_METERS,
  );
  const unsafe = createMonster("contact-now", contactRoute);
  const plan =
    planExpeditionMonsterDangerResponseDuringIdleStopAmongPatrols(
      scenario.expeditionRoute,
      [scenario.monster, unsafe],
      "AVOID",
      scenario.stopAtRouteSeconds,
      scenario.idleDurationSeconds,
    );

  assert.equal(plan.status, "blocked-by-contact");
  assert.equal(plan.originalContact?.monsterId, "contact-now");
  assert.ok(plan.originalContact);
  assert.ok(plan.detection);
  assert.ok(
    plan.originalContact.expeditionElapsedSeconds <=
      plan.detection.expeditionElapsedSeconds,
  );
  assert.equal(plan.effectiveRoute, scenario.expeditionRoute);
  assert.equal(plan.interruptsIdleStop, false);
});

test("GAME-024: an earlier or tied expedition boundary blocks aggregate doctrine", () => {
  const scenario = idleWarningScenario();
  const probe =
    planExpeditionMonsterDangerResponseDuringIdleStopAmongPatrols(
      scenario.expeditionRoute,
      [distantMonster(), scenario.monster],
      "AVOID",
      scenario.stopAtRouteSeconds,
      scenario.idleDurationSeconds,
    );
  assert.ok(probe.detection);

  for (const blocker of [
    probe.detection.expeditionElapsedSeconds - 1,
    probe.detection.expeditionElapsedSeconds,
  ]) {
    const plan =
      planExpeditionMonsterDangerResponseDuringIdleStopAmongPatrols(
        scenario.expeditionRoute,
        [distantMonster(), scenario.monster],
        "AVOID",
        scenario.stopAtRouteSeconds,
        scenario.idleDurationSeconds,
        0,
        1_000,
        blocker,
      );
    assert.equal(plan.status, "blocked-by-earlier-boundary");
    assert.equal(plan.effectiveRoute, scenario.expeditionRoute);
    assert.equal(plan.effectiveIdleDurationSeconds, 200);
  }
});

test("GAME-024: patrol order cannot change the complete STOP plan", () => {
  const scenario = idleWarningScenario();
  const other = distantMonster();
  const forward =
    planExpeditionMonsterDangerResponseDuringIdleStopAmongPatrols(
      scenario.expeditionRoute,
      [scenario.monster, other],
      "AVOID",
      scenario.stopAtRouteSeconds,
      scenario.idleDurationSeconds,
    );
  const reverse =
    planExpeditionMonsterDangerResponseDuringIdleStopAmongPatrols(
      scenario.expeditionRoute,
      [other, scenario.monster],
      "AVOID",
      scenario.stopAtRouteSeconds,
      scenario.idleDurationSeconds,
    );

  assert.deepEqual(reverse, forward);
});

test("GAME-024: a full patrol-cycle delay preserves STOP detour geometry", () => {
  const scenario = idleWarningScenario();
  const alpha = { ...scenario.monster, id: "idle-a" };
  const beta = { ...scenario.monster, id: "idle-b" };
  const patrols = [beta, alpha];
  const immediate =
    planExpeditionMonsterDangerResponseDuringIdleStopAmongPatrols(
      scenario.expeditionRoute,
      patrols,
      "AVOID",
      scenario.stopAtRouteSeconds,
      scenario.idleDurationSeconds,
    );
  const delayed =
    planExpeditionMonsterDangerResponseDuringIdleStopAmongPatrols(
      scenario.expeditionRoute,
      patrols,
      "AVOID",
      scenario.stopAtRouteSeconds,
      scenario.idleDurationSeconds,
      scenario.monster.patrolRoute.totalDurationSeconds,
    );

  assert.equal(delayed.status, "avoided");
  assert.equal(delayed.detection?.monsterId, "idle-a");
  assert.deepEqual(delayed.effectiveRoute, immediate.effectiveRoute);
  assert.equal(delayed.detourSide, immediate.detourSide);
  approx(
    delayed.decisionAtSeconds - immediate.decisionAtSeconds,
    scenario.monster.patrolRoute.totalDurationSeconds,
    1e-6,
  );
  approx(
    delayed.effectiveIdleDurationSeconds,
    immediate.effectiveIdleDurationSeconds,
    1e-6,
  );
});

test("GAME-024: empty patrols and duplicate identities remain deterministic", () => {
  const scenario = idleWarningScenario();
  const empty =
    planExpeditionMonsterDangerResponseDuringIdleStopAmongPatrols(
      scenario.expeditionRoute,
      [],
      "AVOID",
      scenario.stopAtRouteSeconds,
      scenario.idleDurationSeconds,
    );

  assert.equal(empty.status, "not-triggered");
  assert.equal(empty.patrolCount, 0);
  assert.deepEqual(empty.clearanceMonsterIds, []);
  assert.equal(empty.effectiveIdleDurationSeconds, 200);
  assert.throws(
    () =>
      planExpeditionMonsterDangerResponseDuringIdleStopAmongPatrols(
        scenario.expeditionRoute,
        [scenario.monster, { ...scenario.monster }],
        "AVOID",
        scenario.stopAtRouteSeconds,
        scenario.idleDurationSeconds,
      ),
    /monster ids must be unique: idle-trigger/,
  );
});

function approx(actual, expected, tolerance = 1e-6) {
  assert.ok(actual !== null && actual !== undefined);
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );
}
