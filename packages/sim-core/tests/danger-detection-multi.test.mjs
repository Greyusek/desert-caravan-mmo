import test from "node:test";
import assert from "node:assert/strict";
import {
  createRoutePlan,
  createWorldCoordinate,
  destinationPoint,
  findFirstExpeditionMonsterDangerDetectionAmongPatrols,
  findFirstExpeditionMonsterDangerDetectionDuringIdleStopAmongPatrols,
} from "../dist/src/index.js";

const PLANET_RADIUS_METERS = 1_000_000;
const SPEED_METERS_PER_SECOND = 10;

function createMonster(id, patrolRoute) {
  return {
    id,
    kind: "wandering-monster",
    power: 110,
    visionRadiusMeters: 300,
    interactionRadiusMeters: 500,
    patrolRoute,
  };
}

function movingScenario() {
  const crossing = createWorldCoordinate(0, 0);
  const south = destinationPoint(
    crossing,
    180,
    1_000,
    PLANET_RADIUS_METERS,
  );
  const west = destinationPoint(
    crossing,
    270,
    1_000,
    PLANET_RADIUS_METERS,
  );
  const expeditionRoute = createRoutePlan(
    south,
    [{ bearingDeg: 0, distanceMeters: 2_000 }],
    SPEED_METERS_PER_SECOND,
    PLANET_RADIUS_METERS,
  );
  const crossingPatrol = createRoutePlan(
    west,
    [
      { bearingDeg: 90, distanceMeters: 2_000 },
      { bearingDeg: 270, distanceMeters: 2_000 },
    ],
    SPEED_METERS_PER_SECOND,
    PLANET_RADIUS_METERS,
  );
  const immediatePatrol = createRoutePlan(
    south,
    [
      { bearingDeg: 0, distanceMeters: 2_000 },
      { bearingDeg: 180, distanceMeters: 2_000 },
    ],
    SPEED_METERS_PER_SECOND,
    PLANET_RADIUS_METERS,
  );

  return { expeditionRoute, crossingPatrol, immediatePatrol };
}

function idleScenario() {
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
  return {
    expeditionRoute: createRoutePlan(
      south,
      [{ bearingDeg: 0, distanceMeters: 2_000 }],
      SPEED_METERS_PER_SECOND,
      PLANET_RADIUS_METERS,
    ),
    patrolRoute: createRoutePlan(
      west,
      [
        { bearingDeg: 90, distanceMeters: 4_800 },
        { bearingDeg: 270, distanceMeters: 4_800 },
      ],
      SPEED_METERS_PER_SECOND,
      PLANET_RADIUS_METERS,
    ),
    stopAtRouteSeconds: 100,
    idleDurationSeconds: 200,
  };
}

test("GAME-022: the earliest moving warning wins independently of patrol order", () => {
  const scenario = movingScenario();
  const early = createMonster("patrol-z", scenario.immediatePatrol);
  const later = createMonster("patrol-a", scenario.crossingPatrol);

  const forward = findFirstExpeditionMonsterDangerDetectionAmongPatrols(
    scenario.expeditionRoute,
    [later, early],
  );
  const reverse = findFirstExpeditionMonsterDangerDetectionAmongPatrols(
    scenario.expeditionRoute,
    [early, later],
  );

  assert.equal(forward?.monsterId, "patrol-z");
  assert.equal(forward?.atSeconds, 0);
  assert.deepEqual(reverse, forward);
});

test("GAME-022: simultaneous moving warnings use raw monster-id ordering", () => {
  const scenario = movingScenario();
  const alpha = createMonster("patrol-02", scenario.crossingPatrol);
  const beta = createMonster("patrol-10", scenario.crossingPatrol);

  const forward = findFirstExpeditionMonsterDangerDetectionAmongPatrols(
    scenario.expeditionRoute,
    [beta, alpha],
  );
  const reverse = findFirstExpeditionMonsterDangerDetectionAmongPatrols(
    scenario.expeditionRoute,
    [alpha, beta],
  );

  assert.equal(forward?.monsterId, "patrol-02");
  assert.deepEqual(reverse, forward);
});

test("GAME-022: patrols without a warning do not hide an authoritative winner", () => {
  const scenario = movingScenario();
  const distantStart = createWorldCoordinate(30, 30);
  const distantPatrol = createRoutePlan(
    distantStart,
    [
      { bearingDeg: 0, distanceMeters: 2_000 },
      { bearingDeg: 180, distanceMeters: 2_000 },
    ],
    SPEED_METERS_PER_SECOND,
    PLANET_RADIUS_METERS,
  );
  const winner = createMonster("winner", scenario.crossingPatrol);

  const detection = findFirstExpeditionMonsterDangerDetectionAmongPatrols(
    scenario.expeditionRoute,
    [createMonster("distant", distantPatrol), winner],
  );

  assert.equal(detection?.monsterId, "winner");
});

test("GAME-022: delayed departure preserves selected identity and shifts world time", () => {
  const scenario = movingScenario();
  const monsters = [
    createMonster("patrol-b", scenario.crossingPatrol),
    createMonster("patrol-a", scenario.crossingPatrol),
  ];
  const immediate = findFirstExpeditionMonsterDangerDetectionAmongPatrols(
    scenario.expeditionRoute,
    monsters,
  );
  const delayed = findFirstExpeditionMonsterDangerDetectionAmongPatrols(
    scenario.expeditionRoute,
    monsters,
    scenario.crossingPatrol.totalDurationSeconds,
  );

  assert.equal(immediate?.monsterId, "patrol-a");
  assert.equal(delayed?.monsterId, "patrol-a");
  assert.ok(immediate && delayed);
  assert.ok(
    Math.abs(
      delayed.atSeconds - immediate.atSeconds -
        scenario.crossingPatrol.totalDurationSeconds,
    ) < 1e-6,
  );
});

test("GAME-022: the first idle-STOP warning is stable across patrol order", () => {
  const scenario = idleScenario();
  const alpha = createMonster("idle-a", scenario.patrolRoute);
  const beta = createMonster("idle-b", scenario.patrolRoute);

  const forward =
    findFirstExpeditionMonsterDangerDetectionDuringIdleStopAmongPatrols(
      scenario.expeditionRoute,
      [beta, alpha],
      scenario.stopAtRouteSeconds,
      scenario.idleDurationSeconds,
    );
  const reverse =
    findFirstExpeditionMonsterDangerDetectionDuringIdleStopAmongPatrols(
      scenario.expeditionRoute,
      [alpha, beta],
      scenario.stopAtRouteSeconds,
      scenario.idleDurationSeconds,
    );

  assert.equal(forward?.monsterId, "idle-a");
  assert.equal(forward?.caravanActivity, "idle");
  assert.deepEqual(reverse, forward);
});

test("GAME-022: an empty patrol set returns no warning", () => {
  const moving = movingScenario();
  const idle = idleScenario();

  assert.equal(
    findFirstExpeditionMonsterDangerDetectionAmongPatrols(
      moving.expeditionRoute,
      [],
    ),
    null,
  );
  assert.equal(
    findFirstExpeditionMonsterDangerDetectionDuringIdleStopAmongPatrols(
      idle.expeditionRoute,
      [],
      idle.stopAtRouteSeconds,
      idle.idleDurationSeconds,
    ),
    null,
  );
});

test("GAME-022: duplicate identities and shared scalar inputs are rejected", () => {
  const moving = movingScenario();
  const duplicate = createMonster("duplicate", moving.crossingPatrol);

  assert.throws(
    () =>
      findFirstExpeditionMonsterDangerDetectionAmongPatrols(
        moving.expeditionRoute,
        [duplicate, duplicate],
      ),
    /monster ids must be unique: duplicate/,
  );
  assert.throws(
    () =>
      findFirstExpeditionMonsterDangerDetectionAmongPatrols(
        moving.expeditionRoute,
        [],
        -1,
      ),
    /expeditionStartsAtSeconds must be a non-negative finite number/,
  );
  assert.throws(
    () =>
      findFirstExpeditionMonsterDangerDetectionAmongPatrols(
        moving.expeditionRoute,
        [],
        0,
        Number.NaN,
      ),
    /detectionRadiusMeters must be a positive finite number/,
  );
});
