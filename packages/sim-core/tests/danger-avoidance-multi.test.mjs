import test from "node:test";
import assert from "node:assert/strict";
import {
  createRoutePlan,
  createWorldCoordinate,
  destinationPoint,
  findFirstExpeditionMonsterContact,
  planExpeditionMonsterDangerResponse,
  planExpeditionMonsterDangerResponseAmongPatrols,
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
    [
      { bearingDeg: 0, distanceMeters: 2_000 },
      { bearingDeg: 90, distanceMeters: 1_000 },
    ],
    SPEED_METERS_PER_SECOND,
    PLANET_RADIUS_METERS,
  );

  return {
    expeditionRoute,
    monster: createMonster("trigger-patrol", patrolRoute),
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

test("GAME-023: CONTINUE executes the stable first warning across patrols", () => {
  const { expeditionRoute, monster } = crossingScenario();
  const alpha = { ...monster, id: "patrol-a" };
  const beta = { ...monster, id: "patrol-b" };
  const plan = planExpeditionMonsterDangerResponseAmongPatrols(
    expeditionRoute,
    [beta, alpha],
    "CONTINUE",
  );

  assert.equal(plan.status, "continued");
  assert.equal(plan.detection?.monsterId, "patrol-a");
  assert.equal(plan.originalContact?.monsterId, "patrol-a");
  assert.equal(plan.effectiveRoute, expeditionRoute);
  assert.equal(plan.effectiveContact, plan.originalContact);
  assert.equal(plan.patrolCount, 2);
  assert.deepEqual(plan.clearanceMonsterIds, ["patrol-a", "patrol-b"]);
});

test("GAME-023: accepted AVOID route is continuously clear of every patrol", () => {
  const { expeditionRoute, monster } = crossingScenario();
  const patrols = [distantMonster(), monster];
  const plan = planExpeditionMonsterDangerResponseAmongPatrols(
    expeditionRoute,
    patrols,
    "AVOID",
  );

  assert.equal(plan.status, "avoided");
  assert.equal(plan.routeChanged, true);
  assert.equal(plan.detection?.monsterId, monster.id);
  assert.equal(plan.effectiveContact, null);
  for (const patrol of patrols) {
    assert.equal(
      findFirstExpeditionMonsterContact(plan.effectiveRoute, patrol),
      null,
    );
  }
});

test("GAME-023: another patrol rejects an otherwise accepted unsafe detour", () => {
  const { expeditionRoute, monster } = crossingScenario();
  const single = planExpeditionMonsterDangerResponse(
    expeditionRoute,
    monster,
    "AVOID",
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
  assert.ok(
    findFirstExpeditionMonsterContact(single.effectiveRoute, blocker),
  );
  const plan = planExpeditionMonsterDangerResponseAmongPatrols(
    expeditionRoute,
    [blocker, monster],
    "AVOID",
  );

  assert.equal(plan.detection?.monsterId, monster.id);
  assert.equal(plan.status, "detour-unavailable");
  assert.equal(plan.routeChanged, false);
  assert.equal(plan.effectiveRoute, expeditionRoute);
  assert.notDeepEqual(plan.effectiveRoute, single.effectiveRoute);
});

test("GAME-023: contact from any patrol keeps priority over AVOID", () => {
  const { expeditionRoute, monster } = crossingScenario();
  const contactStart = expeditionRoute.start;
  const contactPatrol = createRoutePlan(
    contactStart,
    [
      { bearingDeg: 0, distanceMeters: 2_000 },
      { bearingDeg: 180, distanceMeters: 2_000 },
    ],
    SPEED_METERS_PER_SECOND,
    PLANET_RADIUS_METERS,
  );
  const unsafe = createMonster("contact-now", contactPatrol);
  const plan = planExpeditionMonsterDangerResponseAmongPatrols(
    expeditionRoute,
    [monster, unsafe],
    "AVOID",
  );

  assert.equal(plan.status, "blocked-by-contact");
  assert.equal(plan.originalContact?.monsterId, "contact-now");
  assert.equal(plan.originalContact?.atSeconds, 0);
  assert.equal(plan.effectiveRoute, expeditionRoute);
  assert.equal(plan.routeChanged, false);
});

test("GAME-023: patrol input order cannot change the complete plan", () => {
  const { expeditionRoute, monster } = crossingScenario();
  const other = distantMonster();

  const forward = planExpeditionMonsterDangerResponseAmongPatrols(
    expeditionRoute,
    [monster, other],
    "AVOID",
  );
  const reverse = planExpeditionMonsterDangerResponseAmongPatrols(
    expeditionRoute,
    [other, monster],
    "AVOID",
  );

  assert.deepEqual(reverse, forward);
});

test("GAME-023: a full patrol-cycle delay preserves selected detour geometry", () => {
  const { expeditionRoute, monster } = crossingScenario();
  const alpha = { ...monster, id: "patrol-a" };
  const beta = { ...monster, id: "patrol-b" };
  const patrols = [beta, alpha];
  const immediate = planExpeditionMonsterDangerResponseAmongPatrols(
    expeditionRoute,
    patrols,
    "AVOID",
  );
  const delayed = planExpeditionMonsterDangerResponseAmongPatrols(
    expeditionRoute,
    patrols,
    "AVOID",
    monster.patrolRoute.totalDurationSeconds,
  );

  assert.equal(delayed.status, "avoided");
  assert.equal(delayed.detection?.monsterId, "patrol-a");
  assert.deepEqual(delayed.effectiveRoute, immediate.effectiveRoute);
  assert.equal(delayed.detourSide, immediate.detourSide);
  assert.ok(
    Math.abs(
      delayed.decisionAtSeconds - immediate.decisionAtSeconds -
        monster.patrolRoute.totalDurationSeconds,
    ) < 1e-6,
  );
});

test("GAME-023: warning-only near pass still replans safely across patrols", () => {
  const { expeditionRoute, monster } = crossingScenario(900);
  const plan = planExpeditionMonsterDangerResponseAmongPatrols(
    expeditionRoute,
    [distantMonster(), monster],
    "AVOID",
  );

  assert.equal(plan.detection?.contactOrder, "no-contact");
  assert.equal(plan.originalContact, null);
  assert.equal(plan.status, "avoided");
  assert.equal(plan.effectiveContact, null);
});

test("GAME-023: empty patrols and duplicate identities remain deterministic", () => {
  const { expeditionRoute, monster } = crossingScenario();
  const empty = planExpeditionMonsterDangerResponseAmongPatrols(
    expeditionRoute,
    [],
    "AVOID",
  );

  assert.equal(empty.status, "not-triggered");
  assert.equal(empty.patrolCount, 0);
  assert.deepEqual(empty.clearanceMonsterIds, []);
  assert.equal(empty.effectiveRoute, expeditionRoute);
  assert.throws(
    () =>
      planExpeditionMonsterDangerResponseAmongPatrols(
        expeditionRoute,
        [monster, { ...monster }],
        "AVOID",
      ),
    /monster ids must be unique: trigger-patrol/,
  );
});
