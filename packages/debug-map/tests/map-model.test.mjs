import test from "node:test";
import assert from "node:assert/strict";
import {
  DEBUG_MAP_HEIGHT,
  DEBUG_MAP_WIDTH,
  createDebugMapSnapshot,
  projectCoordinate,
  splitPathAtAntimeridian,
} from "../map-model.js";

function approx(actual, expected, tolerance = 1e-9) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );
}

test("UI-001: north-up projection places cardinal bounds and equator exactly", () => {
  assert.deepEqual(projectCoordinate({ latitudeDeg: 90, longitudeDeg: -180 }), {
    x: 0,
    y: 0,
  });
  assert.deepEqual(projectCoordinate({ latitudeDeg: 0, longitudeDeg: 0 }), {
    x: DEBUG_MAP_WIDTH / 2,
    y: DEBUG_MAP_HEIGHT / 2,
  });
  assert.deepEqual(projectCoordinate({ latitudeDeg: -90, longitudeDeg: 180 }), {
    x: DEBUG_MAP_WIDTH,
    y: DEBUG_MAP_HEIGHT,
  });
});

test("UI-001: projection rejects non-finite and out-of-world coordinates", () => {
  assert.throws(
    () => projectCoordinate({ latitudeDeg: 91, longitudeDeg: 0 }),
    /latitudeDeg must be finite and between -90 and 90/,
  );
  assert.throws(
    () => projectCoordinate({ latitudeDeg: 0, longitudeDeg: Number.NaN }),
    /longitudeDeg must be finite and between -180 and 180/,
  );
});

test("UI-001: the default debug snapshot contains every authoritative world layer", () => {
  const snapshot = createDebugMapSnapshot("checkpoint-04");

  assert.equal(snapshot.seed, "checkpoint-04");
  assert.equal(snapshot.elapsedSeconds, 0);
  assert.equal(snapshot.cities.length, 10);
  assert.equal(snapshot.staticObjects.length, 4);
  assert.equal(snapshot.monsters.length, 1);
  assert.deepEqual(
    snapshot.staticObjects.map(({ id, kind }) => ({ id, kind })),
    [
      { id: "oasis-01", kind: "oasis" },
      { id: "mine-01", kind: "mine" },
      { id: "ruins-01", kind: "ruins" },
      { id: "cave-01", kind: "cave" },
    ],
  );
});

test("UI-001: the same seed and time reproduce the complete map snapshot", () => {
  assert.deepEqual(
    createDebugMapSnapshot("repeatable-ui", 1_234),
    createDebugMapSnapshot("repeatable-ui", 1_234),
  );
});

test("UI-001: changing the seed changes projected world positions", () => {
  const first = createDebugMapSnapshot("debug-map-a");
  const second = createDebugMapSnapshot("debug-map-b");

  assert.notDeepEqual(
    first.cities.map(({ point }) => point),
    second.cities.map(({ point }) => point),
  );
  assert.notDeepEqual(first.monsters[0]?.patrolPaths, second.monsters[0]?.patrolPaths);
});

test("UI-001: one exact patrol period returns the monster to the same map point", () => {
  const atStart = createDebugMapSnapshot("cycle-ui", 0);
  const period = atStart.monsters[0]?.periodSeconds;
  assert.ok(period);

  const afterPeriod = createDebugMapSnapshot("cycle-ui", period);
  const firstPoint = atStart.monsters[0]?.point;
  const laterPoint = afterPeriod.monsters[0]?.point;
  assert.ok(firstPoint);
  assert.ok(laterPoint);
  approx(firstPoint.x, laterPoint.x);
  approx(firstPoint.y, laterPoint.y);
  assert.equal(afterPeriod.monsters[0]?.cycleIndex, 1);
});

test("UI-001: an ordinary path remains one continuous projected polyline", () => {
  const paths = splitPathAtAntimeridian([
    { latitudeDeg: 10, longitudeDeg: 20 },
    { latitudeDeg: 15, longitudeDeg: 30 },
    { latitudeDeg: 18, longitudeDeg: 45 },
  ]);

  assert.equal(paths.length, 1);
  assert.equal(paths[0]?.length, 3);
});

test("UI-001: an antimeridian crossing is split at opposite map edges", () => {
  const paths = splitPathAtAntimeridian([
    { latitudeDeg: 10, longitudeDeg: 179 },
    { latitudeDeg: 20, longitudeDeg: -179 },
  ]);

  assert.equal(paths.length, 2);
  assert.equal(paths[0]?.length, 2);
  assert.equal(paths[1]?.length, 2);
  assert.equal(paths[0]?.at(-1)?.x, DEBUG_MAP_WIDTH);
  assert.equal(paths[1]?.[0]?.x, 0);
  approx(paths[0]?.at(-1)?.y ?? Number.NaN, paths[1]?.[0]?.y ?? Number.NaN);
});
