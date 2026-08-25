import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_INTERACTION_RADIUS_METERS,
  createRoutePlan,
  createWorldCoordinate,
  destinationPoint,
  findFirstExpeditionMonsterContact,
  greatCircleDistance,
  planExpeditionMonsterDangerResponse,
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
    monster: {
      id: "avoidance-patrol",
      kind: "wandering-monster",
      power: 110,
      visionRadiusMeters: 300,
      interactionRadiusMeters: DEFAULT_INTERACTION_RADIUS_METERS,
      patrolRoute,
    },
  };
}

test("GAME-020: CONTINUE preserves the original route object and contact", () => {
  const { expeditionRoute, monster } = crossingScenario();
  const plan = planExpeditionMonsterDangerResponse(
    expeditionRoute,
    monster,
    "CONTINUE",
  );

  assert.equal(plan.status, "continued");
  assert.equal(plan.routeChanged, false);
  assert.equal(plan.originalRoute, expeditionRoute);
  assert.equal(plan.effectiveRoute, expeditionRoute);
  assert.equal(plan.effectiveContact, plan.originalContact);
  assert.ok(plan.originalContact);
  assert.equal(plan.detourWaypoint, null);
  assert.equal(plan.detourSegmentIndexes, null);
});

test("GAME-020: AVOID preserves the executed prefix and one later route suffix", () => {
  const { expeditionRoute, monster } = crossingScenario();
  const plan = planExpeditionMonsterDangerResponse(
    expeditionRoute,
    monster,
    "AVOID",
  );

  assert.equal(plan.status, "avoided");
  assert.equal(plan.routeChanged, true);
  assert.notEqual(plan.effectiveRoute, expeditionRoute);
  assert.deepEqual(plan.detourSegmentIndexes, [1, 2]);
  assert.equal(plan.effectiveRoute.segments.length, 4);
  assert.equal(plan.effectiveRoute.segments[0]?.bearingDeg, 0);
  assert.ok(plan.decisionRouteDistanceMeters);
  assert.ok(
    Math.abs(
      plan.effectiveRoute.segments[0].distanceMeters -
        plan.decisionRouteDistanceMeters,
    ) < 1e-7,
  );
  assert.ok(
    greatCircleDistance(
      plan.effectiveRoute.segments[0].end,
      plan.decisionPosition,
      PLANET_RADIUS_METERS,
    ) < 1e-7,
  );
  assert.ok(
    greatCircleDistance(
      plan.effectiveRoute.segments[2].end,
      expeditionRoute.segments[0].end,
      PLANET_RADIUS_METERS,
    ) < 1e-7,
  );
  assert.equal(plan.effectiveRoute.segments[3]?.bearingDeg, 90);
  assert.equal(plan.effectiveRoute.segments[3]?.distanceMeters, 1_000);
  assert.ok(
    greatCircleDistance(
      plan.effectiveRoute.end,
      expeditionRoute.end,
      PLANET_RADIUS_METERS,
    ) < 1e-7,
  );
});

test("GAME-020: accepted detour continuously clears the 500 m patrol contact", () => {
  const { expeditionRoute, monster } = crossingScenario();
  const plan = planExpeditionMonsterDangerResponse(
    expeditionRoute,
    monster,
    "AVOID",
  );

  assert.equal(plan.status, "avoided");
  assert.ok(plan.originalContact);
  assert.equal(plan.effectiveContact, null);
  assert.equal(
    findFirstExpeditionMonsterContact(plan.effectiveRoute, monster),
    null,
  );
  assert.ok(plan.detourWaypoint);
  assert.ok(plan.detection);
  assert.ok(plan.detourWaypointRadiusMeters);
  assert.ok(
    Math.abs(
      greatCircleDistance(
        plan.detection.monsterPosition,
        plan.detourWaypoint,
        PLANET_RADIUS_METERS,
      ) - plan.detourWaypointRadiusMeters,
    ) < 1e-7,
  );
  assert.ok(plan.addedDistanceMeters > 0);
});

test("GAME-020: the same warning selects the same complete detour", () => {
  const { expeditionRoute, monster } = crossingScenario();

  assert.deepEqual(
    planExpeditionMonsterDangerResponse(expeditionRoute, monster, "AVOID"),
    planExpeditionMonsterDangerResponse(expeditionRoute, monster, "AVOID"),
  );
});

test("GAME-020: a near-pass warning still executes AVOID without inventing contact", () => {
  const { expeditionRoute, monster } = crossingScenario(900);
  const plan = planExpeditionMonsterDangerResponse(
    expeditionRoute,
    monster,
    "AVOID",
  );

  assert.equal(plan.detection?.contactOrder, "no-contact");
  assert.equal(plan.originalContact, null);
  assert.equal(plan.status, "avoided");
  assert.equal(plan.routeChanged, true);
  assert.equal(plan.effectiveContact, null);
});

test("GAME-020: no warning leaves both doctrines dormant", () => {
  const { monster } = crossingScenario();
  const distantRoute = createRoutePlan(
    createWorldCoordinate(30, 30),
    [{ bearingDeg: 90, distanceMeters: 2_000 }],
    SPEED_METERS_PER_SECOND,
    PLANET_RADIUS_METERS,
  );

  for (const doctrine of ["AVOID", "CONTINUE"]) {
    const plan = planExpeditionMonsterDangerResponse(
      distantRoute,
      monster,
      doctrine,
    );
    assert.equal(plan.status, "not-triggered");
    assert.equal(plan.detection, null);
    assert.equal(plan.effectiveRoute, distantRoute);
    assert.equal(plan.routeChanged, false);
  }
});

test("GAME-020: contact wins a warning tie before AVOID can replan", () => {
  const { monster } = crossingScenario();
  const unsafeRoute = createRoutePlan(
    monster.patrolRoute.start,
    [{ bearingDeg: 90, distanceMeters: 1_000 }],
    SPEED_METERS_PER_SECOND,
    PLANET_RADIUS_METERS,
  );
  const plan = planExpeditionMonsterDangerResponse(
    unsafeRoute,
    monster,
    "AVOID",
  );

  assert.equal(plan.detection?.contactOrder, "at-contact");
  assert.equal(plan.status, "blocked-by-contact");
  assert.equal(plan.effectiveRoute, unsafeRoute);
  assert.equal(plan.routeChanged, false);
  assert.equal(plan.decisionAtSeconds, 0);
  assert.equal(plan.originalContact?.atSeconds, 0);
});

test("GAME-020: patrol-period delay shifts time but preserves detour geometry", () => {
  const { expeditionRoute, monster } = crossingScenario();
  const immediate = planExpeditionMonsterDangerResponse(
    expeditionRoute,
    monster,
    "AVOID",
  );
  const delayed = planExpeditionMonsterDangerResponse(
    expeditionRoute,
    monster,
    "AVOID",
    monster.patrolRoute.totalDurationSeconds,
  );

  assert.equal(delayed.status, "avoided");
  assert.deepEqual(delayed.effectiveRoute, immediate.effectiveRoute);
  assert.equal(delayed.detourSide, immediate.detourSide);
  assert.ok(
    Math.abs(
      delayed.decisionAtSeconds - immediate.decisionAtSeconds -
        monster.patrolRoute.totalDurationSeconds,
    ) < 1e-6,
  );
  assert.ok(
    Math.abs(
      delayed.decisionRouteElapsedSeconds -
        immediate.decisionRouteElapsedSeconds,
    ) < 1e-6,
  );
});

test("GAME-020: doctrine and inherited warning radius are validated", () => {
  const { expeditionRoute, monster } = crossingScenario();

  assert.throws(
    () =>
      planExpeditionMonsterDangerResponse(
        expeditionRoute,
        monster,
        "HIDE",
      ),
    /doctrine must be AVOID or CONTINUE/,
  );
  assert.throws(
    () =>
      planExpeditionMonsterDangerResponse(
        expeditionRoute,
        monster,
        "AVOID",
        0,
        500,
      ),
    /detectionRadiusMeters must be greater than monster.interactionRadiusMeters/,
  );
});
