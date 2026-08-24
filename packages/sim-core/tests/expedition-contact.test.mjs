import test from "node:test";
import assert from "node:assert/strict";
import {
  createRoutePlan,
  createWorldCoordinate,
  destinationPoint,
  findFirstExpeditionMonsterContact,
  findFirstExpeditionMonsterContactWithIdleStop,
} from "../dist/src/index.js";

const PLANET_RADIUS_METERS = 1_000_000;
const SPEED_METERS_PER_SECOND = 10;

function crossingScenario(interactionRadiusMeters = 100) {
  const crossing = createWorldCoordinate(0, 0);
  const west = destinationPoint(crossing, 270, 1_000, PLANET_RADIUS_METERS);
  const south = destinationPoint(crossing, 180, 1_000, PLANET_RADIUS_METERS);
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
      id: "test-monster",
      kind: "wandering-monster",
      power: 90,
      visionRadiusMeters: 300,
      interactionRadiusMeters,
      patrolRoute,
    },
  };
}

test("GAME-004: expedition contact preserves authoritative monster metadata", () => {
  const { expeditionRoute, monster } = crossingScenario();
  const contact = findFirstExpeditionMonsterContact(expeditionRoute, monster);

  assert.ok(contact);
  assert.equal(contact.monsterId, "test-monster");
  assert.equal(contact.monsterPower, 90);
  assert.equal(contact.interactionRadiusMeters, 100);
  assert.ok(Math.abs(contact.separationMeters - 100) < 0.0001);
  assert.equal(contact.atSeconds, contact.expeditionElapsedSeconds);
  assert.equal(contact.routeElapsedSeconds, contact.expeditionElapsedSeconds);
  assert.equal(contact.atSeconds, contact.monsterPatrolElapsedSeconds);
});

test("GAME-009: an idle STOP shifts post-resume contact in world time only", () => {
  const { expeditionRoute, monster } = crossingScenario();
  const uninterrupted = findFirstExpeditionMonsterContact(
    expeditionRoute,
    monster,
  );
  assert.ok(uninterrupted);
  const stopAtSeconds = 50;
  assert.ok(uninterrupted.routeElapsedSeconds > stopAtSeconds);

  const delayed = findFirstExpeditionMonsterContactWithIdleStop(
    expeditionRoute,
    monster,
    stopAtSeconds,
    monster.patrolRoute.totalDurationSeconds,
  );

  assert.ok(delayed);
  assert.ok(
    Math.abs(
      delayed.routeElapsedSeconds - uninterrupted.routeElapsedSeconds,
    ) < 1e-6,
  );
  assert.ok(
    Math.abs(
      delayed.expeditionElapsedSeconds -
        uninterrupted.expeditionElapsedSeconds -
        monster.patrolRoute.totalDurationSeconds,
    ) < 1e-6,
  );
  assert.equal(delayed.atSeconds, delayed.expeditionElapsedSeconds);
});

test("GAME-009: a contact before STOP remains the first world boundary", () => {
  const { expeditionRoute, monster } = crossingScenario();
  const uninterrupted = findFirstExpeditionMonsterContact(
    expeditionRoute,
    monster,
  );
  assert.ok(uninterrupted);

  const withLaterStop = findFirstExpeditionMonsterContactWithIdleStop(
    expeditionRoute,
    monster,
    uninterrupted.routeElapsedSeconds + 1,
    99_999,
  );

  assert.deepEqual(withLaterStop, uninterrupted);
});

test("GAME-004: delayed expedition route uses absolute patrol world time", () => {
  const { expeditionRoute, monster } = crossingScenario();
  const contact = findFirstExpeditionMonsterContact(
    expeditionRoute,
    monster,
    monster.patrolRoute.totalDurationSeconds,
  );

  assert.ok(contact);
  assert.ok(contact.atSeconds > monster.patrolRoute.totalDurationSeconds);
  assert.ok(contact.expeditionElapsedSeconds < expeditionRoute.totalDurationSeconds);
  assert.equal(
    contact.atSeconds - contact.expeditionElapsedSeconds,
    monster.patrolRoute.totalDurationSeconds,
  );
});

test("GAME-004: route outside interaction radius has no contact", () => {
  const { monster } = crossingScenario();
  const farRoute = createRoutePlan(
    createWorldCoordinate(30, 30),
    [{ bearingDeg: 90, distanceMeters: 2_000 }],
    SPEED_METERS_PER_SECOND,
    PLANET_RADIUS_METERS,
  );

  assert.equal(findFirstExpeditionMonsterContact(farRoute, monster), null);
});

test("GAME-004: identical inputs reproduce the complete contact", () => {
  const { expeditionRoute, monster } = crossingScenario(500);

  assert.deepEqual(
    findFirstExpeditionMonsterContact(expeditionRoute, monster),
    findFirstExpeditionMonsterContact(expeditionRoute, monster),
  );
});

test("GAME-004: negative expedition start time is rejected", () => {
  const { expeditionRoute, monster } = crossingScenario();

  assert.throws(
    () => findFirstExpeditionMonsterContact(expeditionRoute, monster, -1),
    /expeditionStartsAtSeconds must be a non-negative finite number/,
  );
});
