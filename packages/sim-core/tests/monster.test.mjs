import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_INTERACTION_RADIUS_METERS,
  DEFAULT_VISIBLE_TARGET_RADIUS_METERS,
  DEFAULT_WANDERING_MONSTER_SPEED_METERS_PER_SECOND,
  createRoutePlan,
  createWorldCoordinate,
  generateSeededWorld,
  greatCircleDistance,
  positionAtTime,
  wanderingMonsterPositionAtTime,
} from "../dist/src/index.js";

const EPS_METERS = 0.001;

function approx(actual, expected, tolerance = EPS_METERS) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );
}

test("WORLD-004: the default world contains one fully configured wandering monster", () => {
  const monsters = generateSeededWorld("mvp-world").wanderingMonsters;

  assert.equal(monsters.length, 1);
  assert.equal(monsters[0].id, "wandering-monster-01");
  assert.equal(monsters[0].kind, "wandering-monster");
  assert.equal(monsters[0].power, 90);
  assert.equal(
    monsters[0].patrolRoute.speedMetersPerSecond,
    DEFAULT_WANDERING_MONSTER_SPEED_METERS_PER_SECOND,
  );
  assert.equal(monsters[0].visionRadiusMeters, DEFAULT_VISIBLE_TARGET_RADIUS_METERS);
  assert.equal(monsters[0].interactionRadiusMeters, DEFAULT_INTERACTION_RADIUS_METERS);
});

test("WORLD-004: the same seed reproduces the complete monster patrol", () => {
  assert.deepEqual(
    generateSeededWorld("repeatable-monster").wanderingMonsters,
    generateSeededWorld("repeatable-monster").wanderingMonsters,
  );
});

test("WORLD-004: different seeds change the wandering patrol", () => {
  assert.notDeepEqual(
    generateSeededWorld("monster-a").wanderingMonsters,
    generateSeededWorld("monster-b").wanderingMonsters,
  );
});

test("WORLD-004: monster count is configurable, stable, and validated", () => {
  const monsters = generateSeededWorld("monster-count", {
    wanderingMonsterCount: 3,
  }).wanderingMonsters;
  assert.deepEqual(
    monsters.map(({ id, power }) => ({ id, power })),
    [
      { id: "wandering-monster-01", power: 90 },
      { id: "wandering-monster-02", power: 110 },
      { id: "wandering-monster-03", power: 90 },
    ],
  );
  assert.deepEqual(
    generateSeededWorld("monster-count", { wanderingMonsterCount: 0 })
      .wanderingMonsters,
    [],
  );

  for (const count of [
    -1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.MAX_SAFE_INTEGER + 1,
  ]) {
    assert.throws(
      () => generateSeededWorld("monster-count", { wanderingMonsterCount: count }),
      /wanderingMonsterCount must be a non-negative safe integer/,
    );
  }
});

test("WORLD-004: monster PRNG streams do not perturb cities or static objects", () => {
  const baseline = generateSeededWorld("independent-monsters", {
    wanderingMonsterCount: 0,
  });
  const expanded = generateSeededWorld("independent-monsters", {
    cityCount: 20,
    staticObjectCounts: { oasis: 5 },
    wanderingMonsterCount: 3,
  });

  assert.deepEqual(baseline.cities, expanded.cities.slice(0, baseline.cities.length));
  assert.deepEqual(
    baseline.staticObjects.filter(({ kind }) => kind !== "oasis"),
    expanded.staticObjects.filter(({ kind }) => kind !== "oasis"),
  );
  assert.deepEqual(
    generateSeededWorld("independent-monsters", { wanderingMonsterCount: 1 })
      .wanderingMonsters,
    expanded.wanderingMonsters.slice(0, 1),
  );
});

test("WORLD-004: every generated patrol has three physical legs and closes", () => {
  const monsters = generateSeededWorld("closed-patrols", {
    wanderingMonsterCount: 5,
  }).wanderingMonsters;

  for (const monster of monsters) {
    assert.equal(monster.patrolRoute.segments.length, 3);
    assert.ok(monster.patrolRoute.totalDistanceMeters > 0);
    assert.ok(monster.patrolRoute.totalDurationSeconds > 0);
    approx(
      greatCircleDistance(
        monster.patrolRoute.start,
        monster.patrolRoute.end,
        monster.patrolRoute.planetRadiusMeters,
      ),
      0,
    );
  }
});

test("WORLD-004: time zero and an exact full period are the same position", () => {
  const monster = generateSeededWorld("cycle-boundary").wanderingMonsters[0];
  const atStart = wanderingMonsterPositionAtTime(monster, 0);
  const afterOneCycle = wanderingMonsterPositionAtTime(
    monster,
    monster.patrolRoute.totalDurationSeconds,
  );

  assert.equal(atStart.cycleIndex, 0);
  assert.equal(afterOneCycle.cycleIndex, 1);
  assert.equal(afterOneCycle.cycleElapsedSeconds, 0);
  assert.equal(afterOneCycle.segmentIndex, 0);
  approx(greatCircleDistance(atStart.coordinate, afterOneCycle.coordinate), 0);
});

test("WORLD-004: cyclic movement preserves segment progress and boundaries", () => {
  const monster = generateSeededWorld("segment-progress").wanderingMonsters[0];
  const firstSegment = monster.patrolRoute.segments[0];
  const halfwaySeconds = firstSegment.durationSeconds / 2;
  const halfway = wanderingMonsterPositionAtTime(monster, halfwaySeconds);
  const expectedHalfway = positionAtTime(monster.patrolRoute, halfwaySeconds);
  const atBoundary = wanderingMonsterPositionAtTime(
    monster,
    firstSegment.etaEndSeconds,
  );

  assert.equal(halfway.segmentIndex, 0);
  approx(halfway.segmentProgress, 0.5, 1e-12);
  approx(greatCircleDistance(halfway.coordinate, expectedHalfway.coordinate), 0);
  assert.equal(atBoundary.segmentIndex, 1);
  assert.equal(atBoundary.segmentProgress, 0);
});

test("WORLD-004: later cycles expose stable metadata and reject invalid input", () => {
  const monster = generateSeededWorld("cycle-metadata").wanderingMonsters[0];
  const period = monster.patrolRoute.totalDurationSeconds;
  const offset = period / 4;
  const firstCycle = wanderingMonsterPositionAtTime(monster, offset);
  const laterCycle = wanderingMonsterPositionAtTime(monster, 3 * period + offset);

  assert.equal(laterCycle.cycleIndex, 3);
  approx(laterCycle.cycleElapsedSeconds, offset, 1e-9);
  approx(greatCircleDistance(firstCycle.coordinate, laterCycle.coordinate), 0);

  for (const elapsed of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(
      () => wanderingMonsterPositionAtTime(monster, elapsed),
      /elapsedSeconds must be a non-negative finite number/,
    );
  }

  const openRouteMonster = {
    ...monster,
    patrolRoute: createRoutePlan(
      createWorldCoordinate(0, 0),
      [{ bearingDeg: 90, distanceMeters: 1_000 }],
      1,
    ),
  };
  assert.throws(
    () => wanderingMonsterPositionAtTime(openRouteMonster, 0),
    /patrolRoute must be a closed cyclic route/,
  );
});

test("WORLD-004 regression: checkpoint-04 monster patrol has golden values", () => {
  const monster = generateSeededWorld("checkpoint-04").wanderingMonsters[0];
  assert.deepEqual(
    {
      id: monster.id,
      kind: monster.kind,
      power: monster.power,
      speedMetersPerSecond: monster.patrolRoute.speedMetersPerSecond,
      visionRadiusMeters: monster.visionRadiusMeters,
      interactionRadiusMeters: monster.interactionRadiusMeters,
      start: monster.patrolRoute.start,
      bearings: monster.patrolRoute.segments.map(({ bearingDeg }) => bearingDeg),
      distances: monster.patrolRoute.segments.map(({ distanceMeters }) => distanceMeters),
    },
    {
      id: "wandering-monster-01",
      kind: "wandering-monster",
      power: 90,
      speedMetersPerSecond: 1.5,
      visionRadiusMeters: 300,
      interactionRadiusMeters: 500,
      start: {
        latitudeDeg: 8.461637673899531,
        longitudeDeg: 115.29294040985405,
      },
      bearings: [
        108.2794454600662,
        203.30375926336274,
        345.1233943140753,
      ],
      distances: [
        7317.988190799952,
        9911.89780086279,
        11794.787363410835,
      ],
    },
  );
});
