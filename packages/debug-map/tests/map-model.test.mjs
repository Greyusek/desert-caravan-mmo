import test from "node:test";
import assert from "node:assert/strict";
import {
  DEBUG_MAP_HEIGHT,
  DEBUG_MAP_WIDTH,
  createCaravanStatusSnapshot,
  createDebugMapSnapshot,
  createExpeditionEventLogSnapshot,
  createFourSegmentRouteSnapshot,
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

const fourSegments = [
  { bearingDeg: 315, distanceKilometers: 200 },
  { bearingDeg: 270, distanceKilometers: 120 },
  { bearingDeg: 225, distanceKilometers: 200 },
  { bearingDeg: 90, distanceKilometers: 350 },
];

test("UI-002: the editor resolves exactly four chained spherical segments", () => {
  const route = createFourSegmentRouteSnapshot(
    { latitudeDeg: 0, longitudeDeg: 0 },
    fourSegments,
    5,
  );

  assert.equal(route.segments.length, 4);
  assert.equal(route.totalDistanceKilometers, 870);
  assert.equal(route.totalDurationSeconds, 174 * 3_600);
  assert.deepEqual(route.segments[0]?.start, route.start);
  assert.deepEqual(route.segments[1]?.start, route.segments[0]?.end);
  assert.deepEqual(route.segments[2]?.start, route.segments[1]?.end);
  assert.deepEqual(route.segments[3]?.start, route.segments[2]?.end);
  assert.deepEqual(route.end, route.segments[3]?.end);
  assert.ok(
    route.routePaths.flat().length > route.segments.length + 1,
    "long spherical legs should be sampled instead of drawn as endpoint chords",
  );
});

test("UI-002: route overlay is reproducible for the same editor values and time", () => {
  const start = { latitudeDeg: -4.988644, longitudeDeg: -112.712295 };

  assert.deepEqual(
    createFourSegmentRouteSnapshot(start, fourSegments, 5, 12_345),
    createFourSegmentRouteSnapshot(start, fourSegments, 5, 12_345),
  );
});

test("UI-002: elapsed time evaluates the caravan through SIM-005", () => {
  const route = createFourSegmentRouteSnapshot(
    { latitudeDeg: 0, longitudeDeg: 0 },
    fourSegments,
    5,
    20 * 3_600,
  );

  assert.equal(route.position.status, "moving");
  assert.equal(route.position.segmentIndex, 0);
  approx(route.position.segmentProgress, 0.5);
  approx(route.position.traveledDistanceMeters, 100_000);

  const arrived = createFourSegmentRouteSnapshot(
    route.start,
    fourSegments,
    5,
    route.totalDurationSeconds,
  );
  assert.equal(arrived.position.status, "arrived");
  assert.equal(arrived.position.segmentIndex, null);
  assert.deepEqual(arrived.position.coordinate, arrived.end);
});

test("UI-002: a route crossing the antimeridian uses separate map paths", () => {
  const route = createFourSegmentRouteSnapshot(
    { latitudeDeg: 0, longitudeDeg: 179 },
    [
      { bearingDeg: 90, distanceKilometers: 500 },
      { bearingDeg: 0, distanceKilometers: 0 },
      { bearingDeg: 0, distanceKilometers: 0 },
      { bearingDeg: 0, distanceKilometers: 0 },
    ],
    5,
  );

  assert.equal(route.routePaths.length, 2);
  assert.equal(route.routePaths[0]?.at(-1)?.x, DEBUG_MAP_WIDTH);
  assert.equal(route.routePaths[1]?.[0]?.x, 0);
});

test("UI-002: editor values are validated before route rendering", () => {
  const start = { latitudeDeg: 0, longitudeDeg: 0 };

  assert.throws(
    () => createFourSegmentRouteSnapshot(start, fourSegments.slice(0, 3), 5),
    /exactly four segments/,
  );
  assert.throws(
    () => createFourSegmentRouteSnapshot(start, fourSegments, 0),
    /speedKilometersPerHour must be a positive finite number/,
  );
  assert.throws(
    () =>
      createFourSegmentRouteSnapshot(
        start,
        [
          ...fourSegments.slice(0, 3),
          { bearingDeg: 90, distanceKilometers: -1 },
        ],
        5,
      ),
    /distanceKilometers must be a non-negative finite number/,
  );
});

const supplies = { foodUnits: 100, waterUnits: 200 };
const consumption = {
  moving: { foodUnitsPerHour: 10, waterUnitsPerHour: 20 },
  idle: { foodUnitsPerHour: 2, waterUnitsPerHour: 4 },
};

function caravanStatusAt(elapsedSeconds, initial = supplies, profile = consumption) {
  const route = createFourSegmentRouteSnapshot(
    { latitudeDeg: 0, longitudeDeg: 0 },
    fourSegments,
    5,
    elapsedSeconds,
  );
  return createCaravanStatusSnapshot(route, initial, profile);
}

test("UI-003: expedition starts with full supplies and zero route progress", () => {
  const status = caravanStatusAt(0);

  assert.equal(status.route.status, "moving");
  assert.equal(status.route.progress, 0);
  assert.equal(status.supplies.foodRemaining, 100);
  assert.equal(status.supplies.waterRemaining, 200);
  assert.equal(status.supplies.foodFraction, 1);
  assert.equal(status.supplies.waterFraction, 1);
  assert.equal(status.supplies.depleted, false);
});

test("UI-003: moving consumption follows SIM-006 at the selected time", () => {
  const status = caravanStatusAt(5 * 3_600);

  assert.equal(status.route.segmentIndex, 0);
  assert.equal(status.route.traveledDistanceKilometers, 25);
  assert.equal(status.supplies.foodConsumed, 50);
  assert.equal(status.supplies.waterConsumed, 100);
  assert.equal(status.supplies.foodRemaining, 50);
  assert.equal(status.supplies.waterRemaining, 100);
});

test("UI-003: forecast reports whether supplies last through route ETA", () => {
  const unsafe = caravanStatusAt(0);
  const safe = caravanStatusAt(
    0,
    { foodUnits: 2_000, waterUnits: 4_000 },
  );

  assert.equal(unsafe.forecast.canFinish, false);
  assert.equal(unsafe.forecast.depletionBeforeOrAtArrival, true);
  assert.equal(unsafe.forecast.firstDepletionAtSeconds, 10 * 3_600);
  assert.equal(unsafe.forecast.depletionCause, "both");
  assert.equal(safe.forecast.canFinish, true);
  assert.equal(safe.forecast.depletionBeforeOrAtArrival, false);
  assert.equal(safe.forecast.foodAtArrival, 260);
  assert.equal(safe.forecast.waterAtArrival, 520);
});

test("UI-003: exact depletion is critical and preserves its cause", () => {
  const status = caravanStatusAt(10 * 3_600);

  assert.equal(status.supplies.depleted, true);
  assert.equal(status.supplies.depletionCause, "both");
  assert.equal(status.supplies.foodRemaining, 0);
  assert.equal(status.supplies.waterRemaining, 0);
});

test("UI-003: supply projection stops at arrival instead of inventing idle time", () => {
  const initial = { foodUnits: 1_000, waterUnits: 2_000 };
  const profile = {
    moving: { foodUnitsPerHour: 1, waterUnitsPerHour: 2 },
    idle: { foodUnitsPerHour: 100, waterUnitsPerHour: 200 },
  };
  const status = caravanStatusAt(200 * 3_600, initial, profile);

  assert.equal(status.route.status, "arrived");
  assert.equal(status.route.evaluatedAtSeconds, 174 * 3_600);
  assert.equal(status.supplies.foodRemaining, 826);
  assert.equal(status.supplies.waterRemaining, 1_652);
});

test("UI-003: invalid stock and consumption values are rejected by SIM-006", () => {
  assert.throws(
    () => caravanStatusAt(0, { foodUnits: -1, waterUnits: 1 }),
    /foodUnits must be a non-negative finite number/,
  );
  assert.throws(
    () =>
      caravanStatusAt(0, supplies, {
        moving: { foodUnitsPerHour: -1, waterUnitsPerHour: 1 },
        idle: consumption.idle,
      }),
    /moving.foodUnitsPerHour must be a non-negative finite number/,
  );
});

const timelineSegments = [
  { bearingDeg: 315, distanceKilometers: 2_000 },
  { bearingDeg: 270, distanceKilometers: 1_200 },
  { bearingDeg: 225, distanceKilometers: 2_000 },
  { bearingDeg: 90, distanceKilometers: 3_500 },
];
const timelineSupplies = { foodUnits: 1_000, waterUnits: 2_000 };
const timelineConsumption = {
  moving: { foodUnitsPerHour: 0.5, waterUnitsPerHour: 1 },
  idle: { foodUnitsPerHour: 0.25, waterUnitsPerHour: 0.4 },
};

function eventLogAt(
  elapsedSeconds,
  commands = timelineSegments,
  initial = timelineSupplies,
  profile = timelineConsumption,
) {
  const route = createFourSegmentRouteSnapshot(
    { latitudeDeg: 0, longitudeDeg: 0 },
    commands,
    5,
    elapsedSeconds,
  );
  return createExpeditionEventLogSnapshot(route, initial, profile);
}

test("UI-004: identical route, supplies and time reproduce the complete log", () => {
  assert.deepEqual(eventLogAt(700 * 3_600), eventLogAt(700 * 3_600));
});

test("UI-004: safe expedition milestones are ordered by authoritative ETA", () => {
  const log = eventLogAt(0);

  assert.deepEqual(
    log.events.map(({ id, atSeconds }) => ({ id, atHours: atSeconds / 3_600 })),
    [
      { id: "departure", atHours: 0 },
      { id: "segment-01", atHours: 400 },
      { id: "segment-02", atHours: 640 },
      { id: "segment-03", atHours: 1_040 },
      { id: "supplies-low-both", atHours: 1_500 },
      { id: "arrival", atHours: 1_740 },
    ],
  );
});

test("UI-004: selected time marks occurred, active and next events", () => {
  const log = eventLogAt(700 * 3_600);

  assert.equal(log.occurredCount, 3);
  assert.equal(log.totalCount, 6);
  assert.equal(log.events[2]?.id, "segment-02");
  assert.equal(log.events[2]?.active, true);
  assert.equal(log.events[3]?.occurred, false);
  assert.equal(log.nextEventId, "segment-03");
});

test("UI-004: simultaneous low food and water become one warning", () => {
  const log = eventLogAt(0);
  const warnings = log.events.filter((event) => event.kind === "supplies-low");

  assert.equal(warnings.length, 1);
  assert.equal(warnings[0]?.cause, "both");
  assert.equal(warnings[0]?.atSeconds, 1_500 * 3_600);
});

test("UI-004: different supply ratios produce separate ordered warnings", () => {
  const longRoute = [
    { bearingDeg: 0, distanceKilometers: 2_000 },
    { bearingDeg: 90, distanceKilometers: 2_000 },
    { bearingDeg: 180, distanceKilometers: 2_000 },
    { bearingDeg: 270, distanceKilometers: 5_000 },
  ];
  const profile = {
    moving: { foodUnitsPerHour: 0.5, waterUnitsPerHour: 0.8 },
    idle: timelineConsumption.idle,
  };
  const log = eventLogAt(0, longRoute, timelineSupplies, profile);
  const warnings = log.events.filter((event) => event.kind === "supplies-low");

  assert.deepEqual(
    warnings.map(({ cause, atSeconds }) => ({ cause, atHours: atSeconds / 3_600 })),
    [
      { cause: "food", atHours: 1_500 },
      { cause: "water", atHours: 1_875 },
    ],
  );
});

test("UI-004: exact depletion at ETA is critical before arrival", () => {
  const exactSupplies = { foodUnits: 870, waterUnits: 1_740 };
  const log = eventLogAt(
    1_740 * 3_600,
    timelineSegments,
    exactSupplies,
  );
  const lastTwo = log.events.slice(-2);

  assert.deepEqual(
    lastTwo.map(({ kind, atSeconds }) => ({ kind, atHours: atSeconds / 3_600 })),
    [
      { kind: "supplies-depleted", atHours: 1_740 },
      { kind: "arrival", atHours: 1_740 },
    ],
  );
  assert.equal(lastTwo[0]?.cause, "both");
  assert.equal(lastTwo[1]?.active, true);
});

test("UI-004: evaluation clamps at arrival after the route has ended", () => {
  const log = eventLogAt(2_000 * 3_600);

  assert.equal(log.evaluatedAtSeconds, 1_740 * 3_600);
  assert.equal(log.occurredCount, log.totalCount);
  assert.equal(log.events.at(-1)?.id, "arrival");
  assert.equal(log.events.at(-1)?.active, true);
  assert.equal(log.nextEventId, null);
});

test("UI-004: invalid supply inputs are still rejected by SIM-006", () => {
  assert.throws(
    () => eventLogAt(0, timelineSegments, { foodUnits: -1, waterUnits: 1 }),
    /foodUnits must be a non-negative finite number/,
  );
  assert.throws(
    () =>
      eventLogAt(0, timelineSegments, timelineSupplies, {
        moving: { foodUnitsPerHour: 1, waterUnitsPerHour: -1 },
        idle: timelineConsumption.idle,
      }),
    /moving.waterUnitsPerHour must be a non-negative finite number/,
  );
});
