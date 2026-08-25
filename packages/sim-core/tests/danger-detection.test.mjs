import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_DANGER_DETECTION_RADIUS_METERS,
  DEFAULT_FLEE_SAFE_SEPARATION_MULTIPLIER,
  DEFAULT_INTERACTION_RADIUS_METERS,
  createRoutePlan,
  createWorldCoordinate,
  destinationPoint,
  findFirstExpeditionMonsterDangerDetection,
} from "../dist/src/index.js";

const PLANET_RADIUS_METERS = 1_000_000;
const SPEED_METERS_PER_SECOND = 10;

function crossingScenario(crossingOffsetMeters = 0) {
  const crossing = createWorldCoordinate(0, 0);
  const west = destinationPoint(
    crossing,
    270,
    1_000,
    PLANET_RADIUS_METERS,
  );
  const caravanCrossing = destinationPoint(
    crossing,
    90,
    crossingOffsetMeters,
    PLANET_RADIUS_METERS,
  );
  const south = destinationPoint(
    caravanCrossing,
    180,
    1_000,
    PLANET_RADIUS_METERS,
  );
  const patrolRoute = createRoutePlan(
    west,
    [
      { bearingDeg: 90, distanceMeters: 2_000 },
      { bearingDeg: 270, distanceMeters: 2_000 },
    ],
    SPEED_METERS_PER_SECOND,
    PLANET_RADIUS_METERS,
  );
  const expeditionRoute = createRoutePlan(
    south,
    [{ bearingDeg: 0, distanceMeters: 2_000 }],
    SPEED_METERS_PER_SECOND,
    PLANET_RADIUS_METERS,
  );

  return {
    expeditionRoute,
    monster: {
      id: "danger-patrol",
      kind: "wandering-monster",
      power: 110,
      visionRadiusMeters: 300,
      interactionRadiusMeters: DEFAULT_INTERACTION_RADIUS_METERS,
      patrolRoute,
    },
  };
}

test("GAME-019: default danger warning reuses the established safe separation", () => {
  assert.equal(DEFAULT_DANGER_DETECTION_RADIUS_METERS, 1_000);
  assert.equal(
    DEFAULT_DANGER_DETECTION_RADIUS_METERS,
    DEFAULT_INTERACTION_RADIUS_METERS *
      DEFAULT_FLEE_SAFE_SEPARATION_MULTIPLIER,
  );
  assert.ok(
    DEFAULT_DANGER_DETECTION_RADIUS_METERS >
      DEFAULT_INTERACTION_RADIUS_METERS,
  );
});

test("GAME-019: moving danger is detected before the 500 m contact", () => {
  const { expeditionRoute, monster } = crossingScenario();
  const detection = findFirstExpeditionMonsterDangerDetection(
    expeditionRoute,
    monster,
  );

  assert.ok(detection);
  assert.equal(detection.monsterId, monster.id);
  assert.equal(detection.monsterPower, monster.power);
  assert.equal(detection.detectionRadiusMeters, 1_000);
  assert.equal(detection.interactionRadiusMeters, 500);
  assert.ok(Math.abs(detection.separationMeters - 1_000) < 0.0001);
  assert.equal(detection.contactOrder, "before-contact");
  assert.ok(detection.plannedContactAtSeconds > detection.atSeconds);
  assert.ok(detection.secondsUntilContact > 0);
  assert.equal(
    detection.secondsUntilContact,
    detection.plannedContactAtSeconds - detection.atSeconds,
  );
  assert.equal(detection.atSeconds, detection.expeditionElapsedSeconds);
  assert.equal(detection.routeElapsedSeconds, detection.expeditionElapsedSeconds);
});

test("GAME-019: a warning may occur even when the patrol never reaches contact", () => {
  const { expeditionRoute, monster } = crossingScenario(900);
  const detection = findFirstExpeditionMonsterDangerDetection(
    expeditionRoute,
    monster,
  );

  assert.ok(detection);
  assert.equal(detection.contactOrder, "no-contact");
  assert.equal(detection.plannedContactAtSeconds, null);
  assert.equal(detection.secondsUntilContact, null);
  assert.ok(detection.separationMeters <= 1_000.0001);
});

test("GAME-019: starting inside contact gives contact priority at the same instant", () => {
  const { monster } = crossingScenario();
  const expeditionRoute = createRoutePlan(
    monster.patrolRoute.start,
    [{ bearingDeg: 90, distanceMeters: 1_000 }],
    SPEED_METERS_PER_SECOND,
    PLANET_RADIUS_METERS,
  );
  const detection = findFirstExpeditionMonsterDangerDetection(
    expeditionRoute,
    monster,
  );

  assert.ok(detection);
  assert.equal(detection.atSeconds, 0);
  assert.equal(detection.plannedContactAtSeconds, 0);
  assert.equal(detection.secondsUntilContact, 0);
  assert.equal(detection.contactOrder, "at-contact");
});

test("GAME-019: delayed departure preserves world time and warning lead", () => {
  const { expeditionRoute, monster } = crossingScenario();
  const immediate = findFirstExpeditionMonsterDangerDetection(
    expeditionRoute,
    monster,
  );
  const delayed = findFirstExpeditionMonsterDangerDetection(
    expeditionRoute,
    monster,
    monster.patrolRoute.totalDurationSeconds,
  );

  assert.ok(immediate);
  assert.ok(delayed);
  assert.ok(
    Math.abs(
      delayed.atSeconds - immediate.atSeconds -
        monster.patrolRoute.totalDurationSeconds,
    ) < 1e-6,
  );
  assert.ok(
    Math.abs(
      delayed.expeditionElapsedSeconds - immediate.expeditionElapsedSeconds,
    ) < 1e-6,
  );
  assert.ok(
    Math.abs(
      delayed.secondsUntilContact - immediate.secondsUntilContact,
    ) < 1e-6,
  );
});

test("GAME-019: a distant route does not invent danger knowledge", () => {
  const { monster } = crossingScenario();
  const farRoute = createRoutePlan(
    createWorldCoordinate(30, 30),
    [{ bearingDeg: 90, distanceMeters: 2_000 }],
    SPEED_METERS_PER_SECOND,
    PLANET_RADIUS_METERS,
  );

  assert.equal(
    findFirstExpeditionMonsterDangerDetection(farRoute, monster),
    null,
  );
});

test("GAME-019: identical inputs reproduce the complete warning boundary", () => {
  const { expeditionRoute, monster } = crossingScenario();

  assert.deepEqual(
    findFirstExpeditionMonsterDangerDetection(expeditionRoute, monster),
    findFirstExpeditionMonsterDangerDetection(expeditionRoute, monster),
  );
});

test("GAME-019: warning radius and expedition start are validated", () => {
  const { expeditionRoute, monster } = crossingScenario();

  assert.throws(
    () =>
      findFirstExpeditionMonsterDangerDetection(
        expeditionRoute,
        monster,
        0,
        500,
      ),
    /detectionRadiusMeters must be greater than monster.interactionRadiusMeters/,
  );
  assert.throws(
    () =>
      findFirstExpeditionMonsterDangerDetection(
        expeditionRoute,
        monster,
        0,
        Number.NaN,
      ),
    /detectionRadiusMeters must be a positive finite number/,
  );
  assert.throws(
    () =>
      findFirstExpeditionMonsterDangerDetection(
        expeditionRoute,
        monster,
        -1,
      ),
    /expeditionStartsAtSeconds must be a non-negative finite number/,
  );
});
