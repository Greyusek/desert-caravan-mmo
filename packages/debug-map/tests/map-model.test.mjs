import test from "node:test";
import assert from "node:assert/strict";
import {
  CONTACT_ZOOM_HEIGHT,
  CONTACT_ZOOM_SPATIAL_RADII_METERS,
  CONTACT_ZOOM_TIME_RADII_SECONDS,
  CONTACT_ZOOM_WIDTH,
  DEBUG_MAP_HEIGHT,
  DEBUG_MAP_WIDTH,
  KNOWLEDGE_MAP_HEIGHT,
  KNOWLEDGE_MAP_WIDTH,
  SIMULATION_CLOCK_SPEED_MULTIPLIERS,
  advanceSimulationClock,
  applyDiscoveryDoctrineToRoute,
  applyExpeditionOutcomeToRoute,
  createCaravanStatusSnapshot,
  createCityArrivalRoutePreset,
  createCityArrivalSnapshot,
  createContactZoomSnapshot,
  createDebugMapSnapshot,
  createDangerAvoidanceDoctrineSnapshot,
  createDangerDetectionSnapshot,
  createMultiPatrolDangerAvoidanceDoctrineSnapshot,
  createMultiPatrolDangerDetectionSnapshot,
  createDiscoveryDoctrineSnapshot,
  createDiscoveryResumeSnapshot,
  createDiscoveryStopLifecycleSnapshot,
  createEmergencySupplyDoctrineSnapshot,
  createExpeditionEventLogSnapshot,
  createExpeditionOutcomeSnapshot,
  createFourSegmentRouteSnapshot,
  createMonsterContactSnapshot,
  createMonsterInterceptRoutePreset,
  createKnownObjectReturnRoutePreset,
  createRumorSearchSnapshot,
  createSessionKnowledgeMapSnapshot,
  createStationaryStopPatrolPreset,
  projectCoordinate,
  splitPathAtAntimeridian,
} from "../map-model.js";
import {
  createRoutePlan,
  createPlayerDiscoveryLedger,
  createPlayerTravelLedger,
  evaluateDiscoveryStopLifecycle,
  findFirstExpeditionMonsterContact,
  recordDirectDiscoveryObservation,
  recordExpeditionTravelProgress,
  recordReachedCityLandmark,
} from "../../sim-core/dist/src/index.js";

function approx(actual, expected, tolerance = 1e-9) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );
}

test("UI-005: simulation clock exposes exactly the four development speeds", () => {
  assert.deepEqual([...SIMULATION_CLOCK_SPEED_MULTIPLIERS], [1, 10, 100, 1_000]);
  assert.equal(Object.isFrozen(SIMULATION_CLOCK_SPEED_MULTIPLIERS), true);
});

test("UI-005: every speed maps wall time to simulation time transparently", () => {
  for (const speedMultiplier of SIMULATION_CLOCK_SPEED_MULTIPLIERS) {
    const advanced = advanceSimulationClock(
      120,
      2.5,
      speedMultiplier,
      10_000,
    );
    assert.equal(advanced.elapsedSeconds, 120 + 2.5 * speedMultiplier);
    assert.equal(advanced.reachedBoundary, false);
  }
});

test("UI-005: one stable play anchor is independent from frame sampling", () => {
  const sparseFrame = advanceSimulationClock(400, 1.75, 100, 10_000);
  const denseFrame = advanceSimulationClock(
    400,
    0.25 + 0.5 + 1,
    100,
    10_000,
  );

  assert.deepEqual(sparseFrame, denseFrame);
  assert.equal(sparseFrame.elapsedSeconds, 575);
});

test("UI-005: playback clamps exactly to the first expedition boundary", () => {
  const advanced = advanceSimulationClock(300, 1, 1_000, 712.345);

  assert.equal(advanced.elapsedSeconds, 712.345);
  assert.equal(advanced.reachedBoundary, true);
});

test("UI-005: playback remains active before the expedition boundary", () => {
  assert.deepEqual(advanceSimulationClock(300, 0.4, 1_000, 712.345), {
    elapsedSeconds: 700,
    reachedBoundary: false,
  });
});

test("UI-005: zero wall time preserves the paused simulation instant", () => {
  assert.deepEqual(advanceSimulationClock(123.456, 0, 10, 500), {
    elapsedSeconds: 123.456,
    reachedBoundary: false,
  });
});

test("GAME-017: DEV snapshot replaces future legs with an emergency return", () => {
  const route = createFourSegmentRouteSnapshot(
    { latitudeDeg: 0, longitudeDeg: 0 },
    [
      { bearingDeg: 90, distanceKilometers: 100 },
      { bearingDeg: 0, distanceKilometers: 0 },
      { bearingDeg: 0, distanceKilometers: 0 },
      { bearingDeg: 0, distanceKilometers: 0 },
    ],
    36,
    3_000,
  );
  const emergency = createEmergencySupplyDoctrineSnapshot(
    route,
    { foodUnits: 100, waterUnits: 1_000 },
    {
      moving: { foodUnitsPerHour: 72, waterUnitsPerHour: 1 },
      idle: { foodUnitsPerHour: 1, waterUnitsPerHour: 1 },
    },
    "RETURN_TO_ORIGIN",
  );

  assert.equal(emergency.triggerAtSeconds, 2_500);
  assert.equal(emergency.status, "returning");
  assert.equal(emergency.appliesReturn, true);
  assert.equal(emergency.effectiveRoute.segments.length, 2);
  approx(emergency.returnDistanceKilometers, 25, 1e-7);
  approx(
    emergency.effectiveRoute.position.traveledDistanceMeters,
    30_000,
    1e-7,
  );
  const log = createExpeditionEventLogSnapshot(
    emergency.effectiveRoute,
    { foodUnits: 100, waterUnits: 1_000 },
    {
      moving: { foodUnitsPerHour: 72, waterUnitsPerHour: 1 },
      idle: { foodUnitsPerHour: 1, waterUnitsPerHour: 1 },
    },
    null,
    null,
    null,
    null,
    null,
    emergency,
  );
  const decision = log.events.find(
    (event) => event.kind === "supplies-emergency-doctrine",
  );
  assert.equal(decision?.atSeconds, 2_500);
  assert.equal(decision?.supplyEmergencyDoctrine, "RETURN_TO_ORIGIN");
  assert.equal(decision?.remainingFraction, 0.5);
  approx(decision?.returnDistanceKilometers, 25, 1e-7);
});

test("GAME-017: an earlier discovery pause keeps priority over emergency return", () => {
  const route = createFourSegmentRouteSnapshot(
    { latitudeDeg: 0, longitudeDeg: 0 },
    [
      { bearingDeg: 90, distanceKilometers: 100 },
      { bearingDeg: 0, distanceKilometers: 0 },
      { bearingDeg: 0, distanceKilometers: 0 },
      { bearingDeg: 0, distanceKilometers: 0 },
    ],
    36,
    3_000,
  );
  const emergency = createEmergencySupplyDoctrineSnapshot(
    route,
    { foodUnits: 100, waterUnits: 1_000 },
    {
      moving: { foodUnitsPerHour: 72, waterUnitsPerHour: 1 },
      idle: { foodUnitsPerHour: 1, waterUnitsPerHour: 1 },
    },
    "RETURN_TO_ORIGIN",
    2_000,
  );

  assert.equal(emergency.status, "blocked-by-earlier-pause");
  assert.equal(emergency.appliesReturn, false);
  assert.equal(emergency.effectiveRoute, route);
});

test("GAME-018: DEV snapshot leaves STOP at the exact idle 50% boundary", () => {
  const initialSupplies = { foodUnits: 100, waterUnits: 1_000 };
  const profile = {
    moving: { foodUnitsPerHour: 18, waterUnitsPerHour: 0 },
    idle: { foodUnitsPerHour: 20, waterUnitsPerHour: 0 },
  };
  const stopAtSeconds = 2_000;
  const idleDurationSeconds = 3 * 3_600;
  const triggerAtSeconds = stopAtSeconds + 2 * 3_600;
  const evaluatedAtSeconds = triggerAtSeconds + 1_000;
  const plannedRoute = createFourSegmentRouteSnapshot(
    { latitudeDeg: 0, longitudeDeg: 0 },
    [
      { bearingDeg: 90, distanceKilometers: 100 },
      { bearingDeg: 0, distanceKilometers: 0 },
      { bearingDeg: 0, distanceKilometers: 0 },
      { bearingDeg: 0, distanceKilometers: 0 },
    ],
    36,
    stopAtSeconds,
  );
  const stopLifecycle = evaluateDiscoveryStopLifecycle(
    plannedRoute.authoritativeRoute,
    initialSupplies,
    profile,
    evaluatedAtSeconds,
    stopAtSeconds,
    idleDurationSeconds,
  );
  const emergency = createEmergencySupplyDoctrineSnapshot(
    plannedRoute,
    initialSupplies,
    profile,
    "RETURN_TO_ORIGIN",
    stopAtSeconds,
    stopLifecycle,
  );

  assert.equal(emergency.triggerActivity, "idle");
  assert.equal(emergency.triggerAtSeconds, triggerAtSeconds);
  assert.equal(emergency.triggerAtRouteSeconds, stopAtSeconds);
  assert.equal(emergency.effectiveIdleDurationSeconds, 2 * 3_600);
  assert.equal(emergency.interruptsIdleStop, true);
  assert.equal(emergency.status, "returning");
  assert.equal(emergency.effectiveRoute.segments.length, 2);
  approx(emergency.triggerRouteDistanceKilometers, 20, 1e-7);
  approx(emergency.returnDistanceKilometers, 20, 1e-7);
  approx(emergency.effectiveRoute.position.elapsedSeconds, 3_000, 1e-7);
  approx(
    emergency.effectiveRoute.position.traveledDistanceMeters,
    30_000,
    1e-7,
  );
});

test("GAME-018: effective outcome and log preserve the truncated STOP", () => {
  const seed = "checkpoint-04";
  const world = createDebugMapSnapshot(seed, 0, 2);
  const origin = world.cities[0];
  assert.ok(origin);
  const initialSupplies = { foodUnits: 100, waterUnits: 100 };
  const profile = {
    moving: { foodUnitsPerHour: 0, waterUnitsPerHour: 0 },
    idle: { foodUnitsPerHour: 25, waterUnitsPerHour: 25 },
  };
  const probeRoute = createFourSegmentRouteSnapshot(
    origin.position,
    [
      { bearingDeg: 0, distanceKilometers: 0 },
      { bearingDeg: 0, distanceKilometers: 0 },
      { bearingDeg: 0, distanceKilometers: 0 },
      { bearingDeg: 0, distanceKilometers: 0 },
    ],
    5,
  );
  const probeSearch = createRumorSearchSnapshot(seed, origin, probeRoute);
  const commands = [
    {
      bearingDeg: probeSearch.serverTruth.exactBearingDeg,
      distanceKilometers: probeSearch.serverTruth.exactDistanceKilometers,
    },
    { bearingDeg: 0, distanceKilometers: 0 },
    { bearingDeg: 0, distanceKilometers: 0 },
    { bearingDeg: 0, distanceKilometers: 0 },
  ];
  const baseRoute = createFourSegmentRouteSnapshot(
    origin.position,
    commands,
    5,
  );
  const baseSearch = createRumorSearchSnapshot(seed, origin, baseRoute);
  const stopAtSeconds = baseSearch.serverTruth.plannedDiscoveryAtSeconds;
  assert.notEqual(stopAtSeconds, null);
  const idleDurationSeconds = 6 * 3_600;
  const triggerAtSeconds = (stopAtSeconds ?? 0) + 2 * 3_600;
  const evaluatedAtSeconds = triggerAtSeconds + 60;
  const stopRoute = createFourSegmentRouteSnapshot(
    origin.position,
    commands,
    5,
    stopAtSeconds ?? 0,
  );
  const stopSearch = createRumorSearchSnapshot(seed, origin, stopRoute);
  const stoppedDoctrine = createDiscoveryDoctrineSnapshot(
    stopRoute,
    stopSearch,
    "STOP",
  );
  const scheduledResume = createDiscoveryResumeSnapshot(
    stoppedDoctrine,
    stopSearch.serverTruth.target.id,
  );
  assert.ok(scheduledResume);
  const scheduledLifecycle = createDiscoveryStopLifecycleSnapshot(
    baseRoute,
    initialSupplies,
    profile,
    scheduledResume,
    idleDurationSeconds,
    evaluatedAtSeconds,
  );
  assert.ok(scheduledLifecycle);
  const plannedRoute = createFourSegmentRouteSnapshot(
    origin.position,
    commands,
    5,
    scheduledLifecycle.movementElapsedSeconds,
  );
  const emergency = createEmergencySupplyDoctrineSnapshot(
    plannedRoute,
    initialSupplies,
    profile,
    "RETURN_TO_ORIGIN",
    stopAtSeconds,
    scheduledLifecycle,
  );
  const executionSearch = createRumorSearchSnapshot(
    seed,
    origin,
    emergency.effectiveRoute,
  );
  const executionDoctrine = createDiscoveryDoctrineSnapshot(
    emergency.effectiveRoute,
    executionSearch,
    "STOP",
  );
  const executionResume = createDiscoveryResumeSnapshot(
    executionDoctrine,
    executionSearch.serverTruth.target.id,
  );
  assert.ok(executionResume);
  const destination = createCityArrivalSnapshot(
    emergency.effectiveRoute,
    origin,
  );
  const effectiveLifecycle = createDiscoveryStopLifecycleSnapshot(
    emergency.effectiveRoute,
    initialSupplies,
    profile,
    executionResume,
    emergency.effectiveIdleDurationSeconds,
    evaluatedAtSeconds,
    destination,
  );
  assert.ok(effectiveLifecycle);
  const outcome = createExpeditionOutcomeSnapshot(
    emergency.effectiveRoute,
    initialSupplies,
    profile,
    executionResume,
    null,
    "FLEE",
    5 / 3.6,
    destination,
    effectiveLifecycle,
    emergency,
  );
  const route = applyExpeditionOutcomeToRoute(
    emergency.effectiveRoute,
    outcome,
  );
  const log = createExpeditionEventLogSnapshot(
    route,
    initialSupplies,
    profile,
    executionSearch,
    executionDoctrine,
    outcome,
    executionResume,
    effectiveLifecycle,
    emergency,
  );

  assert.equal(outcome.stopInterruptedBySupplyEmergency, true);
  assert.equal(outcome.scheduledIdleDurationSeconds, idleDurationSeconds);
  assert.equal(outcome.idleDurationSeconds, 2 * 3_600);
  assert.equal(outcome.resumeAtSeconds, triggerAtSeconds);
  const emergencyIndex = log.events.findIndex(
    (event) => event.kind === "supplies-emergency-doctrine",
  );
  const resumeIndex = log.events.findIndex(
    (event) => event.kind === "route-resumed",
  );
  assert.ok(emergencyIndex >= 0);
  assert.ok(resumeIndex > emergencyIndex);
  assert.equal(log.events[emergencyIndex]?.supplyEmergencyActivity, "idle");
  assert.equal(log.events[resumeIndex]?.resumeReason, "supply-emergency");
  assert.equal(
    log.events[resumeIndex]?.idleDurationSeconds,
    2 * 3_600,
  );
});

test("GAME-018: an earlier route-changing contact blocks idle return", () => {
  const initialSupplies = { foodUnits: 100, waterUnits: 1_000 };
  const profile = {
    moving: { foodUnitsPerHour: 18, waterUnitsPerHour: 0 },
    idle: { foodUnitsPerHour: 20, waterUnitsPerHour: 0 },
  };
  const stopAtSeconds = 2_000;
  const idleDurationSeconds = 3 * 3_600;
  const plannedRoute = createFourSegmentRouteSnapshot(
    { latitudeDeg: 0, longitudeDeg: 0 },
    [
      { bearingDeg: 90, distanceKilometers: 100 },
      { bearingDeg: 0, distanceKilometers: 0 },
      { bearingDeg: 0, distanceKilometers: 0 },
      { bearingDeg: 0, distanceKilometers: 0 },
    ],
    36,
    stopAtSeconds,
  );
  const stopLifecycle = evaluateDiscoveryStopLifecycle(
    plannedRoute.authoritativeRoute,
    initialSupplies,
    profile,
    stopAtSeconds + idleDurationSeconds,
    stopAtSeconds,
    idleDurationSeconds,
  );
  const emergency = createEmergencySupplyDoctrineSnapshot(
    plannedRoute,
    initialSupplies,
    profile,
    "RETURN_TO_ORIGIN",
    stopAtSeconds,
    stopLifecycle,
    stopAtSeconds + 2 * 3_600 - 1,
  );

  assert.equal(emergency.triggerActivity, "idle");
  assert.equal(emergency.status, "blocked-by-earlier-boundary");
  assert.equal(emergency.blockedByEarlierBoundary, true);
  assert.equal(emergency.appliesReturn, false);
  assert.equal(emergency.effectiveRoute, plannedRoute);
});

test("UI-005: clock inputs and speed choices are validated", () => {
  assert.throws(
    () => advanceSimulationClock(-1, 1, 1, 10),
    /elapsedSeconds must be a non-negative finite number/,
  );
  assert.throws(
    () => advanceSimulationClock(0, Number.NaN, 1, 10),
    /realElapsedSeconds must be a non-negative finite number/,
  );
  assert.throws(
    () => advanceSimulationClock(0, 1, 5, 10),
    /speedMultiplier must be one of 1, 10, 100 or 1000/,
  );
  assert.throws(
    () => advanceSimulationClock(11, 1, 10, 10),
    /stopAtSeconds must be greater than or equal to elapsedSeconds/,
  );
});

test("UI-006: contact zoom exposes only the three spatial and time windows", () => {
  assert.equal(CONTACT_ZOOM_WIDTH, 480);
  assert.equal(CONTACT_ZOOM_HEIGHT, 260);
  assert.deepEqual([...CONTACT_ZOOM_SPATIAL_RADII_METERS], [1_000, 5_000, 25_000]);
  assert.deepEqual([...CONTACT_ZOOM_TIME_RADII_SECONDS], [300, 1_800, 10_800]);
  assert.equal(Object.isFrozen(CONTACT_ZOOM_SPATIAL_RADII_METERS), true);
  assert.equal(Object.isFrozen(CONTACT_ZOOM_TIME_RADII_SECONDS), true);
});

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
  assert.equal(snapshot.cities.every((city) => city.stocks), true);
  assert.ok((snapshot.cities[0]?.stocks?.foodUnits ?? 0) >= 10_000);
  assert.ok((snapshot.cities[0]?.stocks?.waterUnits ?? 0) >= 10_000);
  assert.equal(snapshot.staticObjects.length, 4);
  assert.equal(snapshot.monsters.length, 1);
  assert.equal(snapshot.monsters[0]?.visionRadiusMeters, 300);
  assert.equal(snapshot.monsters[0]?.dangerDetectionRadiusMeters, 1_000);
  assert.equal(snapshot.monsters[0]?.interactionRadiusMeters, 500);
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

test("CITY-002: debug world time projects aggregate city consumption", () => {
  const atStart = createDebugMapSnapshot("city-consumption", 0);
  const afterOneDay = createDebugMapSnapshot("city-consumption", 86_400);
  const initial = atStart.cities[0];
  const later = afterOneDay.cities[0];
  assert.ok(initial);
  assert.ok(later);

  assert.equal(later.population.inhabitants, initial.population.inhabitants);
  assert.equal(
    later.stocks.foodUnits,
    initial.initialStocks.foodUnits - initial.population.inhabitants,
  );
  assert.equal(
    later.stocks.waterUnits,
    initial.initialStocks.waterUnits - initial.population.inhabitants * 2,
  );
});

test("CITY-003: debug world time exposes population loss after shortage", () => {
  const atStart = createDebugMapSnapshot("city-shortage", 0);
  const initial = atStart.cities[0];
  assert.ok(initial);
  const shortageAt = initial.stocks.firstDepletionAtSeconds;
  assert.ok(shortageAt !== null);

  const afterShortage = createDebugMapSnapshot(
    "city-shortage",
    shortageAt + 10 * 86_400,
  ).cities[0];
  assert.ok(afterShortage);
  assert.ok(
    afterShortage.stocks.inhabitants <
      afterShortage.population.inhabitants,
  );
  assert.ok(afterShortage.stocks.populationLost > 0);
  assert.equal(afterShortage.stocks.shortageElapsedSeconds, 10 * 86_400);
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

const searchSupplies = { foodUnits: 1_000, waterUnits: 2_000 };
const searchConsumption = {
  moving: { foodUnitsPerHour: 0, waterUnitsPerHour: 0 },
  idle: { foodUnitsPerHour: 0, waterUnitsPerHour: 0 },
};

function rumorOrigin() {
  const origin = createDebugMapSnapshot("checkpoint-04").cities[0];
  assert.ok(origin);
  return origin;
}

function directRumorCommands() {
  const origin = rumorOrigin();
  const probeRoute = createFourSegmentRouteSnapshot(
    origin.position,
    [
      { bearingDeg: 315, distanceKilometers: 30 },
      { bearingDeg: 0, distanceKilometers: 0 },
      { bearingDeg: 0, distanceKilometers: 0 },
      { bearingDeg: 0, distanceKilometers: 0 },
    ],
    5,
  );
  const probe = createRumorSearchSnapshot("checkpoint-04", origin, probeRoute);
  return [
    {
      bearingDeg: probe.serverTruth.exactBearingDeg,
      distanceKilometers: probe.serverTruth.exactDistanceKilometers,
    },
    { bearingDeg: 0, distanceKilometers: 0 },
    { bearingDeg: 0, distanceKilometers: 0 },
    { bearingDeg: 0, distanceKilometers: 0 },
  ];
}

test("GAME-001: local rumor map is deterministic and keeps the target inside the clue rings", () => {
  const origin = rumorOrigin();
  const route = createFourSegmentRouteSnapshot(
    origin.position,
    directRumorCommands(),
    5,
  );
  const first = createRumorSearchSnapshot("checkpoint-04", origin, route);
  const second = createRumorSearchSnapshot("checkpoint-04", origin, route);

  assert.deepEqual(first, second);
  assert.equal(first.localMap.width, 400);
  assert.equal(first.localMap.height, 220);
  assert.ok(first.localMap.routePoints.length > 4);
  const targetRadius = Math.hypot(
    first.localMap.targetPoint.x - first.localMap.originPoint.x,
    first.localMap.targetPoint.y - first.localMap.originPoint.y,
  );
  assert.ok(targetRadius >= first.localMap.minimumRangePixels);
  assert.ok(targetRadius <= first.localMap.maximumRangePixels);
});

test("GAME-001: a search in progress exposes neither discovery nor miss in the timeline", () => {
  const origin = rumorOrigin();
  const route = createFourSegmentRouteSnapshot(
    origin.position,
    directRumorCommands(),
    5,
    0,
  );
  const search = createRumorSearchSnapshot("checkpoint-04", origin, route);
  const log = createExpeditionEventLogSnapshot(
    route,
    searchSupplies,
    searchConsumption,
    search,
  );

  assert.equal(search.status, "searching");
  assert.equal(search.discovery, null);
  assert.equal(
    log.events.some(
      (event) =>
        event.kind === "target-discovered" || event.kind === "search-missed",
    ),
    false,
  );
});

test("GAME-001: the exact route discovers the mine at the authoritative 150 m radius", () => {
  const origin = rumorOrigin();
  const commands = directRumorCommands();
  const plannedRoute = createFourSegmentRouteSnapshot(
    origin.position,
    commands,
    5,
    0,
  );
  const planned = createRumorSearchSnapshot(
    "checkpoint-04",
    origin,
    plannedRoute,
  );
  const discoveryAtSeconds = planned.serverTruth.plannedDiscoveryAtSeconds;
  assert.ok(discoveryAtSeconds);

  const beforeRoute = createFourSegmentRouteSnapshot(
    origin.position,
    commands,
    5,
    discoveryAtSeconds - 1,
  );
  const atRoute = createFourSegmentRouteSnapshot(
    origin.position,
    commands,
    5,
    discoveryAtSeconds,
  );
  const before = createRumorSearchSnapshot("checkpoint-04", origin, beforeRoute);
  const found = createRumorSearchSnapshot("checkpoint-04", origin, atRoute);

  assert.equal(before.status, "searching");
  assert.equal(found.status, "found");
  assert.ok(found.discovery);
  approx(
    found.discovery.routeDistanceKilometers,
    found.serverTruth.exactDistanceKilometers - 0.15,
    1e-6,
  );
});

test("GAME-001: a route outside the clue target becomes missed only at arrival", () => {
  const origin = rumorOrigin();
  const direct = directRumorCommands();
  const awayCommands = [
    {
      bearingDeg: (direct[0].bearingDeg + 90) % 360,
      distanceKilometers: direct[0].distanceKilometers,
    },
    ...direct.slice(1),
  ];
  const plannedRoute = createFourSegmentRouteSnapshot(
    origin.position,
    awayCommands,
    5,
  );
  const beforeRoute = createFourSegmentRouteSnapshot(
    origin.position,
    awayCommands,
    5,
    plannedRoute.totalDurationSeconds - 1,
  );
  const arrivedRoute = createFourSegmentRouteSnapshot(
    origin.position,
    awayCommands,
    5,
    plannedRoute.totalDurationSeconds,
  );

  assert.equal(
    createRumorSearchSnapshot("checkpoint-04", origin, beforeRoute).status,
    "searching",
  );
  assert.equal(
    createRumorSearchSnapshot("checkpoint-04", origin, arrivedRoute).status,
    "missed",
  );
});

test("GAME-001: revealed discovery and miss events keep deterministic timeline order", () => {
  const origin = rumorOrigin();
  const direct = directRumorCommands();
  const plannedDirectRoute = createFourSegmentRouteSnapshot(
    origin.position,
    direct,
    5,
  );
  const plannedDirectSearch = createRumorSearchSnapshot(
    "checkpoint-04",
    origin,
    plannedDirectRoute,
  );
  const discoveryAtSeconds = plannedDirectSearch.serverTruth.plannedDiscoveryAtSeconds;
  assert.ok(discoveryAtSeconds);
  const foundRoute = createFourSegmentRouteSnapshot(
    origin.position,
    direct,
    5,
    discoveryAtSeconds,
  );
  const foundSearch = createRumorSearchSnapshot(
    "checkpoint-04",
    origin,
    foundRoute,
  );
  const foundLog = createExpeditionEventLogSnapshot(
    foundRoute,
    searchSupplies,
    searchConsumption,
    foundSearch,
  );
  const foundEvent = foundLog.events.find(
    (event) => event.kind === "target-discovered",
  );
  assert.equal(foundEvent?.active, true);
  assert.equal(foundEvent?.objectKind, "mine");

  const away = [
    {
      bearingDeg: (direct[0].bearingDeg + 90) % 360,
      distanceKilometers: direct[0].distanceKilometers,
    },
    ...direct.slice(1),
  ];
  const awayPlan = createFourSegmentRouteSnapshot(origin.position, away, 5);
  const missedRoute = createFourSegmentRouteSnapshot(
    origin.position,
    away,
    5,
    awayPlan.totalDurationSeconds,
  );
  const missedSearch = createRumorSearchSnapshot(
    "checkpoint-04",
    origin,
    missedRoute,
  );
  const missedLog = createExpeditionEventLogSnapshot(
    missedRoute,
    searchSupplies,
    searchConsumption,
    missedSearch,
  );
  const missedIndex = missedLog.events.findIndex(
    (event) => event.kind === "search-missed",
  );
  const arrivalIndex = missedLog.events.findIndex(
    (event) => event.kind === "arrival",
  );

  assert.ok(missedIndex >= 0);
  assert.ok(missedIndex < arrivalIndex);
  assert.equal(missedLog.events[missedIndex]?.atSeconds, awayPlan.totalDurationSeconds);
  assert.equal(missedLog.events[arrivalIndex]?.active, true);
});

test("GAME-002: doctrine remains pending and movement stays unchanged before discovery", () => {
  const origin = rumorOrigin();
  const commands = directRumorCommands();
  const plan = createFourSegmentRouteSnapshot(origin.position, commands, 5, 0);
  const searchPlan = createRumorSearchSnapshot("checkpoint-04", origin, plan);
  const discoveryAtSeconds = searchPlan.serverTruth.plannedDiscoveryAtSeconds;
  assert.ok(discoveryAtSeconds);

  const beforeRoute = createFourSegmentRouteSnapshot(
    origin.position,
    commands,
    5,
    discoveryAtSeconds - 1,
  );
  const beforeSearch = createRumorSearchSnapshot(
    "checkpoint-04",
    origin,
    beforeRoute,
  );
  const doctrine = createDiscoveryDoctrineSnapshot(
    beforeRoute,
    beforeSearch,
    "STOP",
  );
  const executedRoute = applyDiscoveryDoctrineToRoute(beforeRoute, doctrine);

  assert.equal(doctrine.status, "pending");
  assert.equal(doctrine.decision, null);
  assert.deepEqual(executedRoute.position, beforeRoute.position);
});

test("GAME-002: STOP freezes the caravan and ends the executable timeline at discovery", () => {
  const origin = rumorOrigin();
  const commands = directRumorCommands();
  const plan = createFourSegmentRouteSnapshot(origin.position, commands, 5, 0);
  const searchPlan = createRumorSearchSnapshot("checkpoint-04", origin, plan);
  const discoveryAtSeconds = searchPlan.serverTruth.plannedDiscoveryAtSeconds;
  assert.ok(discoveryAtSeconds);

  const laterRoute = createFourSegmentRouteSnapshot(
    origin.position,
    commands,
    5,
    discoveryAtSeconds + 1_000,
  );
  const laterSearch = createRumorSearchSnapshot(
    "checkpoint-04",
    origin,
    laterRoute,
  );
  const doctrine = createDiscoveryDoctrineSnapshot(
    laterRoute,
    laterSearch,
    "STOP",
  );
  const executedRoute = applyDiscoveryDoctrineToRoute(laterRoute, doctrine);
  const executedSearch = createRumorSearchSnapshot(
    "checkpoint-04",
    origin,
    executedRoute,
  );
  const status = createCaravanStatusSnapshot(
    executedRoute,
    searchSupplies,
    searchConsumption,
    doctrine,
  );
  const log = createExpeditionEventLogSnapshot(
    executedRoute,
    searchSupplies,
    searchConsumption,
    executedSearch,
    doctrine,
  );

  assert.equal(doctrine.status, "stopped");
  assert.equal(executedRoute.position.elapsedSeconds, discoveryAtSeconds);
  approx(
    executedRoute.position.traveledDistanceMeters,
    (doctrine.decision?.routeDistanceKilometers ?? 0) * 1_000,
    1e-6,
  );
  assert.equal(status.doctrine?.status, "stopped");
  assert.equal(log.executionStatus, "stopped");
  assert.deepEqual(
    log.events.slice(-2).map(({ id }) => id),
    ["rumor-target-discovered", "doctrine-stop"],
  );
  assert.equal(log.events.some((event) => event.kind === "arrival"), false);
  assert.equal(log.nextEventId, null);
});

test("GAME-002: MARK_AND_CONTINUE records the decision and preserves arrival", () => {
  const origin = rumorOrigin();
  const commands = directRumorCommands();
  const plan = createFourSegmentRouteSnapshot(origin.position, commands, 5, 0);
  const arrivedRoute = createFourSegmentRouteSnapshot(
    origin.position,
    commands,
    5,
    plan.totalDurationSeconds,
  );
  const arrivedSearch = createRumorSearchSnapshot(
    "checkpoint-04",
    origin,
    arrivedRoute,
  );
  const doctrine = createDiscoveryDoctrineSnapshot(
    arrivedRoute,
    arrivedSearch,
    "MARK_AND_CONTINUE",
  );
  const executedRoute = applyDiscoveryDoctrineToRoute(arrivedRoute, doctrine);
  const log = createExpeditionEventLogSnapshot(
    executedRoute,
    searchSupplies,
    searchConsumption,
    arrivedSearch,
    doctrine,
  );
  const decisionIndex = log.events.findIndex(
    (event) => event.id === "doctrine-mark-and-continue",
  );
  const arrivalIndex = log.events.findIndex((event) => event.id === "arrival");

  assert.equal(doctrine.status, "marked-and-continuing");
  assert.equal(executedRoute.position.status, "arrived");
  assert.equal(log.executionStatus, "running");
  assert.ok(decisionIndex >= 0);
  assert.ok(decisionIndex < arrivalIndex);
  assert.equal(log.events[decisionIndex]?.doctrine, "MARK_AND_CONTINUE");
  assert.equal(log.events[arrivalIndex]?.active, true);
});

test("GAME-002: a missed search never creates a doctrine decision", () => {
  const origin = rumorOrigin();
  const direct = directRumorCommands();
  const away = [
    {
      bearingDeg: (direct[0].bearingDeg + 90) % 360,
      distanceKilometers: direct[0].distanceKilometers,
    },
    ...direct.slice(1),
  ];
  const plan = createFourSegmentRouteSnapshot(origin.position, away, 5);
  const arrivedRoute = createFourSegmentRouteSnapshot(
    origin.position,
    away,
    5,
    plan.totalDurationSeconds,
  );
  const missedSearch = createRumorSearchSnapshot(
    "checkpoint-04",
    origin,
    arrivedRoute,
  );
  const doctrine = createDiscoveryDoctrineSnapshot(
    arrivedRoute,
    missedSearch,
    "STOP",
  );
  const log = createExpeditionEventLogSnapshot(
    arrivedRoute,
    searchSupplies,
    searchConsumption,
    missedSearch,
    doctrine,
  );

  assert.equal(missedSearch.status, "missed");
  assert.equal(doctrine.status, "pending");
  assert.equal(doctrine.decision, null);
  assert.equal(
    log.events.some((event) => event.kind === "doctrine-decision"),
    false,
  );
});

test("GAME-003: safe arrival becomes a completed terminal outcome", () => {
  const plan = createFourSegmentRouteSnapshot(
    { latitudeDeg: 0, longitudeDeg: 0 },
    fourSegments,
    5,
  );
  const selected = createFourSegmentRouteSnapshot(
    plan.start,
    fourSegments,
    5,
    plan.totalDurationSeconds + 1_000,
  );
  const outcome = createExpeditionOutcomeSnapshot(
    selected,
    { foodUnits: 2_000, waterUnits: 4_000 },
    consumption,
  );
  const executed = applyExpeditionOutcomeToRoute(selected, outcome);
  const status = createCaravanStatusSnapshot(
    executed,
    { foodUnits: 2_000, waterUnits: 4_000 },
    consumption,
    null,
    outcome,
  );
  const log = createExpeditionEventLogSnapshot(
    executed,
    { foodUnits: 2_000, waterUnits: 4_000 },
    consumption,
    null,
    null,
    outcome,
  );

  assert.equal(outcome.status, "completed");
  assert.equal(outcome.terminal, true);
  assert.equal(executed.position.status, "arrived");
  assert.equal(status.outcome?.status, "completed");
  assert.equal(log.executionStatus, "completed");
  assert.equal(log.events.at(-1)?.id, "arrival");
  assert.equal(log.events.at(-1)?.active, true);
});

test("GAME-003: fatal depletion freezes the caravan and removes future arrival", () => {
  const initial = { foodUnits: 100, waterUnits: 20 };
  const selected = createFourSegmentRouteSnapshot(
    { latitudeDeg: 0, longitudeDeg: 0 },
    fourSegments,
    5,
    10 * 3_600,
  );
  const outcome = createExpeditionOutcomeSnapshot(
    selected,
    initial,
    consumption,
  );
  const executed = applyExpeditionOutcomeToRoute(selected, outcome);
  const log = createExpeditionEventLogSnapshot(
    executed,
    initial,
    consumption,
    null,
    null,
    outcome,
  );

  assert.equal(outcome.status, "failed");
  assert.equal(outcome.failureCause, "water");
  assert.equal(executed.position.elapsedSeconds, 3_600);
  assert.equal(executed.position.traveledDistanceMeters, 5_000);
  assert.equal(log.executionStatus, "failed");
  assert.equal(log.events.at(-1)?.id, "supplies-depleted");
  assert.equal(log.events.at(-1)?.active, true);
  assert.equal(log.events.at(-1)?.distanceKilometers, 5);
  assert.equal(log.events.some((event) => event.kind === "arrival"), false);
});

test("GAME-003: exact depletion at ETA fails instead of also arriving", () => {
  const initial = { foodUnits: 870, waterUnits: 1_740 };
  const selected = createFourSegmentRouteSnapshot(
    { latitudeDeg: 0, longitudeDeg: 0 },
    timelineSegments,
    5,
    1_740 * 3_600,
  );
  const outcome = createExpeditionOutcomeSnapshot(
    selected,
    initial,
    timelineConsumption,
  );
  const executed = applyExpeditionOutcomeToRoute(selected, outcome);
  const log = createExpeditionEventLogSnapshot(
    executed,
    initial,
    timelineConsumption,
    null,
    null,
    outcome,
  );

  assert.equal(outcome.status, "failed");
  assert.equal(outcome.failureCause, "both");
  assert.equal(log.events.at(-1)?.kind, "supplies-depleted");
  assert.equal(log.events.some((event) => event.kind === "arrival"), false);
});

test("GAME-003: STOP before depletion remains a non-terminal pause", () => {
  const origin = rumorOrigin();
  const commands = directRumorCommands();
  const plan = createFourSegmentRouteSnapshot(origin.position, commands, 5);
  const searchPlan = createRumorSearchSnapshot("checkpoint-04", origin, plan);
  const discoveryAtSeconds = searchPlan.serverTruth.plannedDiscoveryAtSeconds;
  assert.ok(discoveryAtSeconds);
  const selected = createFourSegmentRouteSnapshot(
    origin.position,
    commands,
    5,
    plan.totalDurationSeconds,
  );
  const doctrine = createDiscoveryDoctrineSnapshot(
    selected,
    searchPlan,
    "STOP",
  );
  const outcome = createExpeditionOutcomeSnapshot(
    selected,
    { foodUnits: 100, waterUnits: 200 },
    consumption,
    doctrine,
  );
  const executed = applyExpeditionOutcomeToRoute(selected, outcome);
  const executedSearch = createRumorSearchSnapshot(
    "checkpoint-04",
    origin,
    executed,
  );
  const log = createExpeditionEventLogSnapshot(
    executed,
    { foodUnits: 100, waterUnits: 200 },
    consumption,
    executedSearch,
    doctrine,
    outcome,
  );

  assert.equal(outcome.status, "paused");
  assert.equal(outcome.terminal, false);
  assert.equal(executed.position.elapsedSeconds, discoveryAtSeconds);
  assert.equal(log.executionStatus, "paused");
  assert.equal(log.events.at(-1)?.id, "doctrine-stop");
  assert.equal(log.events.some((event) => event.kind === "supplies-depleted"), false);
});

test("GAME-003: depletion before discovery suppresses the impossible doctrine decision", () => {
  const origin = rumorOrigin();
  const commands = directRumorCommands();
  const plan = createFourSegmentRouteSnapshot(origin.position, commands, 5);
  const selected = createFourSegmentRouteSnapshot(
    origin.position,
    commands,
    5,
    plan.totalDurationSeconds,
  );
  const plannedSearch = createRumorSearchSnapshot(
    "checkpoint-04",
    origin,
    selected,
  );
  const proposedDoctrine = createDiscoveryDoctrineSnapshot(
    selected,
    plannedSearch,
    "STOP",
  );
  const outcome = createExpeditionOutcomeSnapshot(
    selected,
    { foodUnits: 1, waterUnits: 1 },
    consumption,
    proposedDoctrine,
  );
  const executed = applyExpeditionOutcomeToRoute(selected, outcome);
  const executedSearch = createRumorSearchSnapshot(
    "checkpoint-04",
    origin,
    executed,
  );
  const effectiveDoctrine = createDiscoveryDoctrineSnapshot(
    executed,
    executedSearch,
    "STOP",
  );

  assert.equal(outcome.status, "failed");
  assert.equal(proposedDoctrine.status, "stopped");
  assert.equal(executedSearch.status, "searching");
  assert.equal(effectiveDoctrine.status, "pending");
  assert.equal(effectiveDoctrine.decision, null);
});

function monsterInterceptAt(elapsedSeconds = 0, monsterIndex = 0) {
  const world = createDebugMapSnapshot("checkpoint-04", elapsedSeconds, 2);
  const monster = world.monsters[monsterIndex];
  assert.ok(monster);
  const candidates = world.cities.map((city) => ({
    city,
    preset: createMonsterInterceptRoutePreset(city.position, monster),
  }));
  candidates.sort(
    (left, right) =>
      left.preset.commands[0].distanceKilometers -
        right.preset.commands[0].distanceKilometers ||
      left.city.id.localeCompare(right.city.id),
  );
  const selected = candidates[0];
  assert.ok(selected);
  const route = createFourSegmentRouteSnapshot(
    selected.city.position,
    selected.preset.commands,
    selected.preset.speedKilometersPerHour,
    elapsedSeconds,
  );
  return {
    world,
    monster,
    city: selected.city,
    preset: selected.preset,
    route,
    danger: createDangerDetectionSnapshot(route, monster),
    contact: createMonsterContactSnapshot(route, monster),
  };
}

test("GAME-019: debug warning precedes the exact contact forecast", () => {
  const planned = monsterInterceptAt();
  const detection = planned.danger.detection;
  const contact = planned.contact.contact;

  assert.ok(detection);
  assert.ok(contact);
  assert.equal(planned.danger.status, "forecast");
  assert.equal(detection.detectionRadiusMeters, 1_000);
  assert.equal(detection.interactionRadiusMeters, 500);
  assert.equal(detection.contactOrder, "before-contact");
  assert.equal(detection.plannedContactAtSeconds, contact.atSeconds);
  assert.ok(detection.atSeconds < contact.atSeconds);
  assert.ok(detection.routeDistanceKilometers < contact.routeDistanceKilometers);

  const reached = monsterInterceptAt(detection.atSeconds);
  assert.equal(reached.danger.status, "detected");
});

test("GAME-022: debug map exposes one stable winner across all patrols", () => {
  const planned = monsterInterceptAt();
  const source = planned.monster;
  const patrolA = {
    ...source,
    id: "patrol-a",
    authoritativeMonster: {
      ...source.authoritativeMonster,
      id: "patrol-a",
    },
  };
  const patrolB = {
    ...source,
    id: "patrol-b",
    authoritativeMonster: {
      ...source.authoritativeMonster,
      id: "patrol-b",
    },
  };
  const forward = createMultiPatrolDangerDetectionSnapshot(
    planned.route,
    [patrolB, patrolA],
  );
  const reverse = createMultiPatrolDangerDetectionSnapshot(
    planned.route,
    [patrolA, patrolB],
  );

  assert.equal(forward.patrolCount, 2);
  assert.equal(forward.status, "forecast");
  assert.equal(forward.detection?.monsterId, "patrol-a");
  assert.deepEqual(reverse, forward);
});

test("GAME-022: debug arbitration changes from forecast to detected exactly at warning", () => {
  const planned = monsterInterceptAt();
  const forecast = createMultiPatrolDangerDetectionSnapshot(
    planned.route,
    planned.world.monsters,
  );
  assert.ok(forecast.detection);

  const reachedRoute = createFourSegmentRouteSnapshot(
    planned.city.position,
    planned.preset.commands,
    planned.preset.speedKilometersPerHour,
    forecast.detection.atSeconds,
  );
  const reached = createMultiPatrolDangerDetectionSnapshot(
    reachedRoute,
    planned.world.monsters,
  );

  assert.equal(reached.status, "detected");
  assert.equal(
    reached.detection?.monsterId,
    forecast.detection.monsterId,
  );
});

test("GAME-023: debug moving AVOID clears the route against every patrol", () => {
  const planned = monsterInterceptAt();
  const source = planned.monster;
  const patrolA = {
    ...source,
    id: "patrol-a",
    authoritativeMonster: {
      ...source.authoritativeMonster,
      id: "patrol-a",
    },
  };
  const patrolB = {
    ...source,
    id: "patrol-b",
    authoritativeMonster: {
      ...source.authoritativeMonster,
      id: "patrol-b",
    },
  };
  const avoidance = createMultiPatrolDangerAvoidanceDoctrineSnapshot(
    planned.route,
    [patrolB, patrolA],
    "AVOID",
  );

  assert.equal(avoidance.status, "pending");
  assert.equal(avoidance.planStatus, "avoided");
  assert.equal(avoidance.patrolCount, 2);
  assert.deepEqual(avoidance.clearanceMonsterIds, ["patrol-a", "patrol-b"]);
  assert.equal(avoidance.detection?.monsterId, "patrol-a");
  assert.equal(avoidance.effectiveContact, null);
  for (const patrol of [patrolA, patrolB]) {
    assert.equal(
      findFirstExpeditionMonsterContact(
        avoidance.authoritativePlan.effectiveRoute,
        patrol.authoritativeMonster,
      ),
      null,
    );
  }
});

test("GAME-023: debug moving CONTINUE preserves the stable first contact", () => {
  const planned = monsterInterceptAt();
  const source = planned.monster;
  const patrolA = {
    ...source,
    id: "patrol-a",
    authoritativeMonster: {
      ...source.authoritativeMonster,
      id: "patrol-a",
    },
  };
  const patrolB = {
    ...source,
    id: "patrol-b",
    authoritativeMonster: {
      ...source.authoritativeMonster,
      id: "patrol-b",
    },
  };
  const continued = createMultiPatrolDangerAvoidanceDoctrineSnapshot(
    planned.route,
    [patrolB, patrolA],
    "CONTINUE",
  );

  assert.equal(continued.status, "pending");
  assert.equal(continued.planStatus, "continued");
  assert.equal(continued.effectiveRoute, planned.route);
  assert.equal(continued.originalContact?.monsterId, "patrol-a");
  assert.equal(continued.effectiveContact, continued.originalContact);
});

test("GAME-020: AVOID snapshot applies one contact-free planned detour", () => {
  const planned = monsterInterceptAt();
  const avoidance = createDangerAvoidanceDoctrineSnapshot(
    planned.route,
    planned.monster,
    "AVOID",
  );
  const avoidedContact = createMonsterContactSnapshot(
    avoidance.effectiveRoute,
    planned.monster,
  );

  assert.equal(avoidance.status, "pending");
  assert.equal(avoidance.planStatus, "avoided");
  assert.equal(avoidance.appliesAvoidance, true);
  assert.equal(avoidance.decisionOccurred, false);
  assert.notEqual(avoidance.effectiveRoute, planned.route);
  assert.notEqual(
    avoidance.effectiveRoute.authoritativeRoute,
    planned.route.authoritativeRoute,
  );
  assert.ok(avoidance.detourWaypoint);
  assert.ok(avoidance.detourWaypointPoint);
  assert.ok(avoidance.addedDistanceKilometers > 0);
  assert.equal(avoidance.originalContact?.monsterId, planned.monster.id);
  assert.equal(avoidance.effectiveContact, null);
  assert.equal(avoidedContact.contact, null);

  const reached = monsterInterceptAt(avoidance.decisionAtSeconds);
  const executed = createDangerAvoidanceDoctrineSnapshot(
    reached.route,
    reached.monster,
    "AVOID",
  );
  assert.equal(executed.status, "avoiding");
  assert.equal(executed.decisionOccurred, true);
});

test("GAME-020: CONTINUE snapshot keeps the exact route and contact", () => {
  const planned = monsterInterceptAt();
  const continued = createDangerAvoidanceDoctrineSnapshot(
    planned.route,
    planned.monster,
    "CONTINUE",
  );

  assert.equal(continued.status, "pending");
  assert.equal(continued.planStatus, "continued");
  assert.equal(continued.appliesAvoidance, false);
  assert.equal(continued.effectiveRoute, planned.route);
  assert.equal(
    continued.effectiveRoute.authoritativeRoute,
    planned.route.authoritativeRoute,
  );
  assert.equal(
    continued.effectiveContact?.atSeconds,
    planned.contact.contact?.atSeconds,
  );
  assert.equal(continued.detourWaypoint, null);
});

test("UI-006: planned contact becomes the exact local focus", () => {
  const planned = monsterInterceptAt();
  const contact = planned.contact.contact;
  assert.ok(contact);
  const zoom = createContactZoomSnapshot(
    planned.route,
    planned.monster,
    planned.contact,
  );
  const focusSeparationPixels = Math.hypot(
    zoom.focusCaravan.point.x - zoom.focusMonster.point.x,
    zoom.focusCaravan.point.y - zoom.focusMonster.point.y,
  );

  assert.equal(zoom.focusKind, "contact");
  assert.equal(zoom.focusAtSeconds, contact.atSeconds);
  approx(zoom.focusCaravan.point.x, CONTACT_ZOOM_WIDTH / 2);
  approx(zoom.focusCaravan.point.y, CONTACT_ZOOM_HEIGHT / 2);
  approx(
    focusSeparationPixels * zoom.metersPerPixel,
    contact.separationMeters,
    1e-3,
  );
  approx(
    zoom.interactionRadiusPixels * zoom.metersPerPixel,
    contact.interactionRadiusMeters,
  );
  approx(
    zoom.dangerDetectionRadiusPixels * zoom.metersPerPixel,
    1_000,
  );
  assert.ok(
    zoom.dangerDetectionRadiusPixels > zoom.interactionRadiusPixels,
  );
  assert.equal(zoom.caravanPath.length, 65);
  assert.equal(zoom.monsterPath.length, 65);
});

test("UI-006: spatial zoom changes pixels without changing server distance", () => {
  const planned = monsterInterceptAt();
  const close = createContactZoomSnapshot(
    planned.route,
    planned.monster,
    planned.contact,
    1_000,
    300,
  );
  const wide = createContactZoomSnapshot(
    planned.route,
    planned.monster,
    planned.contact,
    25_000,
    300,
  );
  const separationPixels = (snapshot) =>
    Math.hypot(
      snapshot.focusCaravan.point.x - snapshot.focusMonster.point.x,
      snapshot.focusCaravan.point.y - snapshot.focusMonster.point.y,
    );

  assert.equal(close.focusAtSeconds, wide.focusAtSeconds);
  approx(close.metersPerPixel * 25, wide.metersPerPixel);
  approx(separationPixels(close) / separationPixels(wide), 25, 1e-6);
});

test("UI-006: time zoom changes trace window without moving its focus", () => {
  const planned = monsterInterceptAt();
  const narrow = createContactZoomSnapshot(
    planned.route,
    planned.monster,
    planned.contact,
    5_000,
    300,
  );
  const wide = createContactZoomSnapshot(
    planned.route,
    planned.monster,
    planned.contact,
    5_000,
    10_800,
  );

  assert.equal(narrow.focusAtSeconds, wide.focusAtSeconds);
  assert.deepEqual(narrow.focusCaravan, wide.focusCaravan);
  assert.deepEqual(narrow.focusMonster, wide.focusMonster);
  assert.ok(wide.windowStartSeconds < narrow.windowStartSeconds);
  assert.ok(wide.windowEndSeconds >= narrow.windowEndSeconds);
  assert.equal(narrow.caravanPath.length, 65);
  assert.equal(wide.caravanPath.length, 65);
  assert.notDeepEqual(narrow.caravanPath, wide.caravanPath);
});

test("UI-006: no-contact view follows the selected patrol at current time", () => {
  const selected = monsterInterceptAt(1_234);
  const first = createContactZoomSnapshot(
    selected.route,
    selected.monster,
    null,
    5_000,
    1_800,
  );
  const second = createContactZoomSnapshot(
    selected.route,
    selected.monster,
    null,
    5_000,
    1_800,
  );

  assert.deepEqual(first, second);
  assert.equal(first.focusKind, "monster");
  assert.equal(first.focusAtSeconds, 1_234);
  approx(first.focusMonster.point.x, CONTACT_ZOOM_WIDTH / 2);
  approx(first.focusMonster.point.y, CONTACT_ZOOM_HEIGHT / 2);
});

test("UI-006: local time trace is clipped to the finite expedition", () => {
  const selected = monsterInterceptAt(0);
  const zoom = createContactZoomSnapshot(
    selected.route,
    selected.monster,
    null,
    25_000,
    10_800,
  );

  assert.equal(zoom.windowStartSeconds, 0);
  assert.equal(
    zoom.windowEndSeconds,
    Math.min(selected.route.totalDurationSeconds, 10_800),
  );
  assert.equal(zoom.caravanPath[0]?.atSeconds, 0);
  assert.equal(zoom.monsterPath[0]?.atSeconds, 0);
});

test("UI-006: zoom presets and selected contact identity are validated", () => {
  const planned = monsterInterceptAt();
  const otherMonster = planned.world.monsters[1];
  assert.ok(otherMonster);

  assert.throws(
    () =>
      createContactZoomSnapshot(
        planned.route,
        planned.monster,
        planned.contact,
        2_000,
        300,
      ),
    /spatialRadiusMeters must be one of 1000, 5000 or 25000/,
  );
  assert.throws(
    () =>
      createContactZoomSnapshot(
        planned.route,
        planned.monster,
        planned.contact,
        1_000,
        600,
      ),
    /timeRadiusSeconds must be one of 300, 1800 or 10800/,
  );
  assert.throws(
    () =>
      createContactZoomSnapshot(
        planned.route,
        otherMonster,
        planned.contact,
      ),
    /contactSnapshot must belong to the selected monster/,
  );
});

test("GAME-004: QA intercept preset is deterministic and guarantees contact", () => {
  const first = monsterInterceptAt();
  const second = monsterInterceptAt();

  assert.deepEqual(first.preset, second.preset);
  assert.equal(first.preset.commands.length, 4);
  assert.ok(first.preset.cycleCount > 0);
  assert.ok(first.contact.contact);
  assert.equal(first.contact.status, "forecast");
  assert.ok(
    Math.abs(
      first.contact.contact.separationMeters -
        first.contact.contact.interactionRadiusMeters,
    ) < 0.001,
  );
  assert.ok(
    first.contact.contact.expeditionElapsedSeconds <
      first.route.totalDurationSeconds,
  );
  assert.equal(first.contact.contact.monsterSpeedMetersPerSecond, 1.5);
});

test("GAME-019: expedition log records warning before contact without replanning", () => {
  const planned = monsterInterceptAt();
  const contactAt = planned.contact.contact?.expeditionElapsedSeconds;
  assert.ok(contactAt);
  const selected = monsterInterceptAt(contactAt + 1);
  const outcome = createExpeditionOutcomeSnapshot(
    selected.route,
    searchSupplies,
    searchConsumption,
    null,
    selected.contact,
  );
  const executed = applyExpeditionOutcomeToRoute(selected.route, outcome);
  const log = createExpeditionEventLogSnapshot(
    executed,
    searchSupplies,
    searchConsumption,
    null,
    null,
    outcome,
    null,
    null,
    null,
    selected.danger,
  );
  const detectionIndex = log.events.findIndex(
    (event) => event.kind === "danger-detected",
  );
  const contactIndex = log.events.findIndex(
    (event) => event.kind === "monster-contact",
  );
  const detection = log.events[detectionIndex];

  assert.ok(detectionIndex >= 0);
  assert.ok(contactIndex > detectionIndex);
  assert.equal(detection?.occurred, true);
  assert.equal(detection?.detectionRadiusMeters, 1_000);
  assert.equal(detection?.interactionRadiusMeters, 500);
  assert.equal(detection?.dangerContactOrder, "before-contact");
  assert.ok((detection?.secondsUntilContact ?? 0) > 0);
  assert.equal(
    executed.authoritativeRoute,
    selected.route.authoritativeRoute,
  );
});

test("GAME-020: AVOID decision follows warning and removes contact from the log", () => {
  const planned = monsterInterceptAt();
  const decisionAtSeconds = planned.danger.detection?.atSeconds;
  assert.ok(decisionAtSeconds);
  const selected = monsterInterceptAt(decisionAtSeconds + 1);
  const avoidance = createDangerAvoidanceDoctrineSnapshot(
    selected.route,
    selected.monster,
    "AVOID",
  );
  const avoidedContact = createMonsterContactSnapshot(
    avoidance.effectiveRoute,
    selected.monster,
  );
  const outcome = createExpeditionOutcomeSnapshot(
    avoidance.effectiveRoute,
    searchSupplies,
    searchConsumption,
    null,
    avoidedContact,
  );
  const log = createExpeditionEventLogSnapshot(
    avoidance.effectiveRoute,
    searchSupplies,
    searchConsumption,
    null,
    null,
    outcome,
    null,
    null,
    null,
    selected.danger,
    avoidance,
  );
  const detectionIndex = log.events.findIndex(
    (event) => event.kind === "danger-detected",
  );
  const decisionIndex = log.events.findIndex(
    (event) => event.kind === "danger-doctrine-decision",
  );
  const decision = log.events[decisionIndex];

  assert.ok(detectionIndex >= 0);
  assert.equal(decisionIndex, detectionIndex + 1);
  assert.equal(decision?.occurred, true);
  assert.equal(decision?.dangerAvoidanceDoctrine, "AVOID");
  assert.ok(["left", "right"].includes(decision?.dangerAvoidanceSide));
  assert.ok((decision?.detourAddedDistanceKilometers ?? 0) > 0);
  assert.equal(
    log.events.some((event) => event.kind === "monster-contact"),
    false,
  );
});

test("GAME-005: weak contact defeats the monster and route execution continues", () => {
  const planned = monsterInterceptAt();
  const contactAt = planned.contact.contact?.expeditionElapsedSeconds;
  assert.ok(contactAt);
  const selected = monsterInterceptAt(contactAt + 60);
  const outcome = createExpeditionOutcomeSnapshot(
    selected.route,
    searchSupplies,
    searchConsumption,
    null,
    selected.contact,
  );
  const executed = applyExpeditionOutcomeToRoute(selected.route, outcome);
  const log = createExpeditionEventLogSnapshot(
    executed,
    searchSupplies,
    searchConsumption,
    null,
    null,
    outcome,
  );

  assert.equal(outcome.status, "in-progress");
  assert.equal(outcome.terminal, false);
  assert.equal(outcome.interruptionCause, null);
  assert.equal(outcome.monsterContact?.monsterId, selected.monster.id);
  assert.equal(
    outcome.monsterContactResolution?.status,
    "monster-defeated",
  );
  assert.ok(executed.position.elapsedSeconds > contactAt);
  assert.equal(log.executionStatus, "running");
  const contactEvent = log.events.find((event) => event.kind === "monster-contact");
  assert.equal(contactEvent?.occurred, true);
  assert.equal(contactEvent?.monsterPower, selected.monster.power);
  assert.equal(contactEvent?.playerPower, 100);
  assert.equal(contactEvent?.powerResolutionStatus, "monster-defeated");
  assert.equal(log.events.some((event) => event.kind === "arrival"), true);
});

test("GAME-005: debug QA exposes deterministic weak and strong patrols", () => {
  const first = createDebugMapSnapshot("checkpoint-04", 0, 2);
  const second = createDebugMapSnapshot("checkpoint-04", 0, 2);

  assert.deepEqual(first.monsters, second.monsters);
  assert.deepEqual(first.monsters.map((monster) => monster.power), [90, 110]);
});

test("GAME-006: a faster FLEE against PWR 110 succeeds and route execution continues", () => {
  const planned = monsterInterceptAt(0, 1);
  const contactAt = planned.contact.contact?.expeditionElapsedSeconds;
  assert.ok(contactAt);
  const selected = monsterInterceptAt(contactAt + 60, 1);
  const outcome = createExpeditionOutcomeSnapshot(
    selected.route,
    searchSupplies,
    searchConsumption,
    null,
    selected.contact,
    "FLEE",
    6 / 3.6,
  );
  const executed = applyExpeditionOutcomeToRoute(selected.route, outcome);
  const log = createExpeditionEventLogSnapshot(
    executed,
    searchSupplies,
    searchConsumption,
    null,
    null,
    outcome,
  );

  assert.equal(outcome.status, "in-progress");
  assert.equal(outcome.terminal, false);
  assert.equal(outcome.interruptionCause, null);
  assert.equal(outcome.failureReason, null);
  assert.equal(outcome.monsterContactResolution?.status, "flee-succeeded");
  assert.equal(
    outcome.monsterContactResolution?.fleeResolution
      ?.safeSeparationMeters,
    1_000,
  );
  assert.ok(
    (outcome.monsterContactResolution?.fleeResolution
      ?.secondsToSafeSeparation ?? 0) > 0,
  );
  assert.ok(executed.position.elapsedSeconds > contactAt);
  assert.equal(log.executionStatus, "running");
  const contactEvent = log.events.find((event) => event.kind === "monster-contact");
  assert.equal(contactEvent?.occurred, true);
  assert.equal(contactEvent?.powerResolutionStatus, "flee-succeeded");
  assert.equal(contactEvent?.fleeSpeedMetersPerSecond, 6 / 3.6);
  assert.equal(contactEvent?.monsterSpeedMetersPerSecond, 1.5);
  assert.equal(log.events.some((event) => event.kind === "arrival"), true);
});

test("GAME-006: an equal or slower FLEE against PWR 110 is terminal", () => {
  const planned = monsterInterceptAt(0, 1);
  const contactAt = planned.contact.contact?.expeditionElapsedSeconds;
  assert.ok(contactAt);
  const selected = monsterInterceptAt(contactAt, 1);
  const outcome = createExpeditionOutcomeSnapshot(
    selected.route,
    searchSupplies,
    searchConsumption,
    null,
    selected.contact,
    "FLEE",
    5 / 3.6,
  );
  const executed = applyExpeditionOutcomeToRoute(selected.route, outcome);
  const log = createExpeditionEventLogSnapshot(
    executed,
    searchSupplies,
    searchConsumption,
    null,
    null,
    outcome,
  );

  assert.equal(outcome.status, "failed");
  assert.equal(outcome.terminal, true);
  assert.equal(outcome.failureReason, "monster");
  assert.equal(outcome.interruptionCause, "monster-defeat");
  assert.equal(outcome.monsterContactResolution?.status, "flee-failed");
  assert.equal(
    outcome.monsterContactResolution?.fleeResolution
      ?.secondsToSafeSeparation,
    null,
  );
  approx(executed.position.elapsedSeconds, contactAt, 1e-6);
  assert.equal(log.executionStatus, "failed");
  assert.equal(log.events.at(-1)?.powerResolutionStatus, "flee-failed");
  assert.equal(log.events.some((event) => event.kind === "arrival"), false);
});

test("GAME-005: ACCEPT_FIGHT against PWR 110 is a terminal expedition defeat", () => {
  const planned = monsterInterceptAt(0, 1);
  const contactAt = planned.contact.contact?.expeditionElapsedSeconds;
  assert.ok(contactAt);
  const selected = monsterInterceptAt(contactAt, 1);
  const outcome = createExpeditionOutcomeSnapshot(
    selected.route,
    searchSupplies,
    searchConsumption,
    null,
    selected.contact,
    "ACCEPT_FIGHT",
  );
  const executed = applyExpeditionOutcomeToRoute(selected.route, outcome);
  const log = createExpeditionEventLogSnapshot(
    executed,
    searchSupplies,
    searchConsumption,
    null,
    null,
    outcome,
  );

  assert.equal(outcome.status, "failed");
  assert.equal(outcome.terminal, true);
  assert.equal(outcome.failureReason, "monster");
  assert.equal(outcome.failureCause, null);
  assert.equal(outcome.interruptionCause, "monster-defeat");
  assert.equal(
    outcome.monsterContactResolution?.status,
    "expedition-defeated",
  );
  approx(executed.position.elapsedSeconds, contactAt, 1e-6);
  assert.equal(log.executionStatus, "failed");
  assert.equal(log.events.at(-1)?.powerResolutionStatus, "expedition-defeated");
  assert.equal(log.events.some((event) => event.kind === "arrival"), false);
});

test("GAME-004: fatal depletion before contact suppresses the encounter boundary", () => {
  const planned = monsterInterceptAt(10 * 3_600);
  const outcome = createExpeditionOutcomeSnapshot(
    planned.route,
    { foodUnits: 1, waterUnits: 1 },
    consumption,
    null,
    planned.contact,
  );
  const executed = applyExpeditionOutcomeToRoute(planned.route, outcome);
  const log = createExpeditionEventLogSnapshot(
    executed,
    { foodUnits: 1, waterUnits: 1 },
    consumption,
    null,
    null,
    outcome,
  );

  assert.equal(outcome.status, "failed");
  assert.equal(outcome.interruptionCause, null);
  assert.equal(outcome.monsterContact, null);
  assert.equal(
    log.events.some((event) => event.kind === "monster-contact"),
    false,
  );
});

test("GAME-004: fatal depletion wins an exact tie with monster contact", () => {
  const planned = monsterInterceptAt();
  const contactAt = planned.contact.contact?.expeditionElapsedSeconds;
  assert.ok(contactAt);
  const stockAtTie = contactAt / 3_600;
  const tieProfile = {
    moving: { foodUnitsPerHour: 1, waterUnitsPerHour: 1 },
    idle: { foodUnitsPerHour: 0, waterUnitsPerHour: 0 },
  };
  const outcome = createExpeditionOutcomeSnapshot(
    planned.route,
    { foodUnits: stockAtTie, waterUnits: stockAtTie },
    tieProfile,
    null,
    planned.contact,
  );

  assert.equal(outcome.planned.status, "failed");
  assert.equal(outcome.planned.failureCause, "both");
  assert.equal(outcome.interruptionCause, null);
});

test("GAME-006: fatal depletion wins an exact tie with a successful FLEE", () => {
  const planned = monsterInterceptAt(0, 1);
  const contactAt = planned.contact.contact?.expeditionElapsedSeconds;
  assert.ok(contactAt);
  const stockAtTie = contactAt / 3_600;
  const tieProfile = {
    moving: { foodUnitsPerHour: 1, waterUnitsPerHour: 1 },
    idle: { foodUnitsPerHour: 0, waterUnitsPerHour: 0 },
  };
  const outcome = createExpeditionOutcomeSnapshot(
    planned.route,
    { foodUnits: stockAtTie, waterUnits: stockAtTie },
    tieProfile,
    null,
    planned.contact,
    "FLEE",
    6 / 3.6,
  );

  assert.equal(outcome.planned.status, "failed");
  assert.equal(outcome.planned.failureCause, "both");
  assert.equal(outcome.interruptionCause, null);
  assert.equal(outcome.monsterContact, null);
  assert.equal(outcome.monsterContactResolution, null);
});

test("GAME-004: an earlier discovery STOP remains the first pause", () => {
  const planned = monsterInterceptAt();
  const contactAt = planned.contact.contact?.expeditionElapsedSeconds;
  assert.ok(contactAt);
  const earlierDoctrine = {
    status: "stopped",
    decision: { decidedAtSeconds: contactAt - 60 },
  };
  const outcome = createExpeditionOutcomeSnapshot(
    planned.route,
    searchSupplies,
    searchConsumption,
    earlierDoctrine,
    planned.contact,
  );

  assert.equal(outcome.planned.status, "paused");
  assert.equal(outcome.planned.atSeconds, contactAt - 60);
  assert.equal(outcome.interruptionCause, "doctrine-stop");
  assert.equal(outcome.monsterContact, null);
});

const cityArrivalSupplies = { foodUnits: 100, waterUnits: 100 };
const cityArrivalConsumption = {
  moving: { foodUnitsPerHour: 1, waterUnitsPerHour: 1 },
  idle: { foodUnitsPerHour: 0, waterUnitsPerHour: 0 },
};
const returnCity = {
  id: "city-return",
  name: "Return City",
  position: { latitudeDeg: 0, longitudeDeg: 0 },
};

function cityReturnAt(elapsedSeconds = 0) {
  const preset = createCityArrivalRoutePreset(
    returnCity.position,
    returnCity,
  );
  const route = createFourSegmentRouteSnapshot(
    returnCity.position,
    preset.commands,
    5,
    elapsedSeconds,
  );
  const destination = createCityArrivalSnapshot(route, returnCity);
  return { preset, route, destination };
}

test("GAME-007: QA return preset exits the origin and re-enters its radius", () => {
  const first = cityReturnAt();
  const second = cityReturnAt();

  assert.deepEqual(first.preset, second.preset);
  assert.equal(first.preset.kind, "return");
  assert.equal(first.preset.commands.length, 4);
  assert.equal(first.destination.status, "forecast");
  assert.equal(first.destination.arrival?.kind, "reentry");
  approx(first.destination.arrival?.routeDistanceKilometers ?? 0, 19.5, 1e-6);
  approx(first.destination.arrival?.distanceToCityMeters ?? 0, 500, 1e-4);
});

test("GAME-007: any generated city can become the authoritative destination", () => {
  const world = createDebugMapSnapshot("checkpoint-04");
  const startCity = world.cities[0];
  const destinationCity = world.cities[1];
  assert.ok(startCity);
  assert.ok(destinationCity);
  const preset = createCityArrivalRoutePreset(
    startCity.position,
    destinationCity,
  );
  const route = createFourSegmentRouteSnapshot(
    startCity.position,
    preset.commands,
    5,
  );
  const destination = createCityArrivalSnapshot(route, destinationCity);

  assert.equal(preset.kind, "transfer");
  assert.equal(destination.arrival?.kind, "entry");
  assert.equal(destination.arrival?.city.id, destinationCity.id);
  approx(destination.arrival?.distanceToCityMeters ?? 0, 500, 1e-3);
});

test("GAME-007: city re-entry completes the expedition and names the city in the log", () => {
  const planned = cityReturnAt();
  const arrivalAt = planned.destination.arrival?.atSeconds;
  assert.ok(arrivalAt);
  const selected = cityReturnAt(arrivalAt + 60);
  const outcome = createExpeditionOutcomeSnapshot(
    selected.route,
    cityArrivalSupplies,
    cityArrivalConsumption,
    null,
    null,
    "FLEE",
    selected.route.authoritativeRoute.speedMetersPerSecond,
    selected.destination,
  );
  const executed = applyExpeditionOutcomeToRoute(selected.route, outcome);
  const log = createExpeditionEventLogSnapshot(
    executed,
    cityArrivalSupplies,
    cityArrivalConsumption,
    null,
    null,
    outcome,
  );
  const arrivalEvent = log.events.at(-1);

  assert.equal(outcome.status, "completed");
  assert.equal(outcome.terminal, true);
  assert.equal(outcome.destinationCity?.id, returnCity.id);
  assert.equal(outcome.cityArrival?.kind, "reentry");
  approx(outcome.endedAtSeconds ?? 0, arrivalAt);
  approx(executed.position.remainingDistanceMeters, 500, 1e-4);
  assert.equal(log.executionStatus, "completed");
  assert.equal(arrivalEvent?.kind, "arrival");
  assert.equal(arrivalEvent?.cityId, returnCity.id);
  assert.equal(arrivalEvent?.cityName, returnCity.name);
  assert.equal(arrivalEvent?.arrivalKind, "reentry");
  assert.equal(arrivalEvent?.active, true);
});

test("GAME-007: ending the drawn route outside the city is a pause, not success", () => {
  const commands = [
    { bearingDeg: 90, distanceKilometers: 2 },
    { bearingDeg: 0, distanceKilometers: 0 },
    { bearingDeg: 0, distanceKilometers: 0 },
    { bearingDeg: 0, distanceKilometers: 0 },
  ];
  const plan = createFourSegmentRouteSnapshot(
    returnCity.position,
    commands,
    5,
  );
  const selected = createFourSegmentRouteSnapshot(
    returnCity.position,
    commands,
    5,
    plan.totalDurationSeconds,
  );
  const destination = createCityArrivalSnapshot(selected, returnCity);
  const outcome = createExpeditionOutcomeSnapshot(
    selected,
    cityArrivalSupplies,
    cityArrivalConsumption,
    null,
    null,
    "FLEE",
    selected.authoritativeRoute.speedMetersPerSecond,
    destination,
  );
  const executed = applyExpeditionOutcomeToRoute(selected, outcome);
  const log = createExpeditionEventLogSnapshot(
    executed,
    cityArrivalSupplies,
    cityArrivalConsumption,
    null,
    null,
    outcome,
  );

  assert.equal(destination.arrival, null);
  assert.equal(outcome.status, "paused");
  assert.equal(outcome.terminal, false);
  assert.equal(outcome.interruptionCause, "route-end");
  assert.equal(log.executionStatus, "paused");
  assert.equal(log.events.at(-1)?.kind, "route-ended");
  approx(log.events.at(-1)?.distanceToCityMeters ?? 0, 2_000, 1e-4);
  assert.equal(log.events.some((event) => event.kind === "arrival"), false);
});

test("GAME-007: depletion on the exact city-entry second cancels arrival", () => {
  const planned = cityReturnAt();
  const arrivalAt = planned.destination.arrival?.atSeconds;
  assert.ok(arrivalAt);
  const selected = cityReturnAt(arrivalAt);
  const stockAtTie = arrivalAt / 3_600;
  const profile = {
    moving: { foodUnitsPerHour: 1, waterUnitsPerHour: 1 },
    idle: { foodUnitsPerHour: 0, waterUnitsPerHour: 0 },
  };
  const outcome = createExpeditionOutcomeSnapshot(
    selected.route,
    { foodUnits: stockAtTie, waterUnits: stockAtTie },
    profile,
    null,
    null,
    "FLEE",
    selected.route.authoritativeRoute.speedMetersPerSecond,
    selected.destination,
  );
  const executed = applyExpeditionOutcomeToRoute(selected.route, outcome);
  const log = createExpeditionEventLogSnapshot(
    executed,
    { foodUnits: stockAtTie, waterUnits: stockAtTie },
    profile,
    null,
    null,
    outcome,
  );

  assert.equal(outcome.status, "failed");
  assert.equal(outcome.failureCause, "both");
  assert.equal(log.events.at(-1)?.kind, "supplies-depleted");
  assert.equal(log.events.some((event) => event.kind === "arrival"), false);
});

test("GAME-007: an earlier STOP still suppresses planned city arrival", () => {
  const selected = cityReturnAt();
  const outcome = createExpeditionOutcomeSnapshot(
    selected.route,
    cityArrivalSupplies,
    cityArrivalConsumption,
    {
      status: "stopped",
      decision: { decidedAtSeconds: 1_000 },
    },
    null,
    "FLEE",
    selected.route.authoritativeRoute.speedMetersPerSecond,
    selected.destination,
  );

  assert.equal(outcome.planned.status, "paused");
  assert.equal(outcome.planned.atSeconds, 1_000);
  assert.equal(outcome.interruptionCause, "doctrine-stop");
});

function game008ScenarioAt(
  elapsedSeconds,
  initialSupplies = searchSupplies,
  profile = searchConsumption,
) {
  const origin = rumorOrigin();
  const commands = directRumorCommands();
  const route = createFourSegmentRouteSnapshot(
    origin.position,
    commands,
    5,
    elapsedSeconds,
  );
  const search = createRumorSearchSnapshot("checkpoint-04", origin, route);
  const doctrine = createDiscoveryDoctrineSnapshot(route, search, "STOP");
  const resume = createDiscoveryResumeSnapshot(
    doctrine,
    search.serverTruth.target.id,
  );
  const outcome = createExpeditionOutcomeSnapshot(
    route,
    initialSupplies,
    profile,
    resume ?? doctrine,
  );
  const executedRoute = applyExpeditionOutcomeToRoute(route, outcome);
  const executedSearch = createRumorSearchSnapshot(
    "checkpoint-04",
    origin,
    executedRoute,
  );
  const executedDoctrine = createDiscoveryDoctrineSnapshot(
    executedRoute,
    executedSearch,
    "STOP",
  );
  const executedResume = createDiscoveryResumeSnapshot(
    executedDoctrine,
    executedSearch.serverTruth.target.id,
  );
  const log = createExpeditionEventLogSnapshot(
    executedRoute,
    initialSupplies,
    profile,
    executedSearch,
    executedDoctrine,
    outcome,
    executedResume,
  );

  return {
    route: executedRoute,
    search: executedSearch,
    doctrine: executedDoctrine,
    resume: executedResume,
    outcome,
    log,
  };
}

test("GAME-008: explicit resume reopens the route at the exact STOP coordinate", () => {
  const origin = rumorOrigin();
  const commands = directRumorCommands();
  const plan = createFourSegmentRouteSnapshot(origin.position, commands, 5);
  const search = createRumorSearchSnapshot("checkpoint-04", origin, plan);
  const discoveryAtSeconds = search.serverTruth.plannedDiscoveryAtSeconds;
  assert.ok(discoveryAtSeconds);

  const scenario = game008ScenarioAt(discoveryAtSeconds);

  assert.equal(scenario.doctrine.status, "stopped");
  assert.equal(scenario.resume?.status, "resumed-and-continuing");
  assert.equal(
    scenario.resume?.resumeDecision.resumedAtSeconds,
    discoveryAtSeconds,
  );
  assert.equal(scenario.route.position.elapsedSeconds, discoveryAtSeconds);
  approx(
    scenario.route.position.traveledDistanceMeters,
    scenario.resume?.resumeDecision.routeDistanceMeters ?? 0,
    1e-6,
  );
  assert.equal(scenario.outcome.status, "in-progress");
  assert.equal(scenario.outcome.planned.status, "completed");
  assert.deepEqual(
    scenario.log.events
      .filter((event) => event.atSeconds === discoveryAtSeconds)
      .map(({ id }) => id),
    [
      "rumor-target-discovered",
      "doctrine-stop",
      "discovery-route-resumed",
    ],
  );
});

test("GAME-008: later route time advances without rediscovering the acknowledged target", () => {
  const origin = rumorOrigin();
  const commands = directRumorCommands();
  const plan = createFourSegmentRouteSnapshot(origin.position, commands, 5);
  const search = createRumorSearchSnapshot("checkpoint-04", origin, plan);
  const discoveryAtSeconds = search.serverTruth.plannedDiscoveryAtSeconds;
  assert.ok(discoveryAtSeconds);
  const elapsedSeconds = discoveryAtSeconds + 30;

  const scenario = game008ScenarioAt(elapsedSeconds);
  const eventIds = scenario.log.events.map(({ id }) => id);

  assert.equal(scenario.route.position.elapsedSeconds, elapsedSeconds);
  assert.ok(
    scenario.route.position.traveledDistanceMeters >
      (scenario.resume?.resumeDecision.routeDistanceMeters ?? Infinity),
  );
  assert.equal(
    eventIds.filter((id) => id === "rumor-target-discovered").length,
    1,
  );
  assert.equal(eventIds.filter((id) => id === "doctrine-stop").length, 1);
  assert.equal(
    eventIds.filter((id) => id === "discovery-route-resumed").length,
    1,
  );
});

test("GAME-008: the resumed expedition can reach its original route completion", () => {
  const origin = rumorOrigin();
  const commands = directRumorCommands();
  const plan = createFourSegmentRouteSnapshot(origin.position, commands, 5);

  const scenario = game008ScenarioAt(plan.totalDurationSeconds);

  assert.equal(scenario.outcome.status, "completed");
  assert.equal(scenario.route.position.status, "arrived");
  assert.equal(scenario.log.events.at(-1)?.kind, "arrival");
  assert.equal(scenario.log.events.at(-1)?.active, true);
});

test("GAME-008: post-resume fatal depletion remains authoritative", () => {
  const origin = rumorOrigin();
  const commands = directRumorCommands();
  const plan = createFourSegmentRouteSnapshot(origin.position, commands, 5);
  const search = createRumorSearchSnapshot("checkpoint-04", origin, plan);
  const discoveryAtSeconds = search.serverTruth.plannedDiscoveryAtSeconds;
  assert.ok(discoveryAtSeconds);
  const depletionAtSeconds =
    discoveryAtSeconds + (plan.totalDurationSeconds - discoveryAtSeconds) / 2;
  const profile = {
    moving: { foodUnitsPerHour: 1, waterUnitsPerHour: 0 },
    idle: { foodUnitsPerHour: 0, waterUnitsPerHour: 0 },
  };
  const scenario = game008ScenarioAt(
    plan.totalDurationSeconds,
    { foodUnits: depletionAtSeconds / 3_600, waterUnits: 1 },
    profile,
  );

  assert.equal(scenario.outcome.status, "failed");
  assert.equal(scenario.outcome.failureCause, "food");
  approx(scenario.outcome.endedAtSeconds ?? 0, depletionAtSeconds, 1e-6);
  assert.equal(scenario.log.events.at(-1)?.kind, "supplies-depleted");
  assert.equal(scenario.log.events.some((event) => event.kind === "arrival"), false);
});

test("GAME-008: a stored resume is dormant before STOP and rejects another target", () => {
  const origin = rumorOrigin();
  const commands = directRumorCommands();
  const plan = createFourSegmentRouteSnapshot(origin.position, commands, 5);
  const plannedSearch = createRumorSearchSnapshot("checkpoint-04", origin, plan);
  const discoveryAtSeconds = plannedSearch.serverTruth.plannedDiscoveryAtSeconds;
  assert.ok(discoveryAtSeconds);
  const beforeRoute = createFourSegmentRouteSnapshot(
    origin.position,
    commands,
    5,
    discoveryAtSeconds - 1,
  );
  const beforeSearch = createRumorSearchSnapshot(
    "checkpoint-04",
    origin,
    beforeRoute,
  );
  const pending = createDiscoveryDoctrineSnapshot(
    beforeRoute,
    beforeSearch,
    "STOP",
  );
  assert.equal(
    createDiscoveryResumeSnapshot(pending, beforeSearch.serverTruth.target.id),
    null,
  );

  const stoppedRoute = createFourSegmentRouteSnapshot(
    origin.position,
    commands,
    5,
    discoveryAtSeconds,
  );
  const stoppedSearch = createRumorSearchSnapshot(
    "checkpoint-04",
    origin,
    stoppedRoute,
  );
  const stopped = createDiscoveryDoctrineSnapshot(
    stoppedRoute,
    stoppedSearch,
    "STOP",
  );
  assert.throws(
    () => createDiscoveryResumeSnapshot(stopped, "another-target"),
    /objectId must match the stopped discovery/,
  );
});

function game009ScenarioAt(
  expeditionElapsedSeconds,
  idleDurationSeconds,
  initialSupplies,
  profile,
) {
  const origin = rumorOrigin();
  const commands = directRumorCommands();
  const timelineRoute = createFourSegmentRouteSnapshot(
    origin.position,
    commands,
    5,
    expeditionElapsedSeconds,
  );
  const timelineSearch = createRumorSearchSnapshot(
    "checkpoint-04",
    origin,
    timelineRoute,
  );
  const stopAtSeconds = timelineSearch.serverTruth.plannedDiscoveryAtSeconds;
  assert.ok(stopAtSeconds);
  const stopRoute = createFourSegmentRouteSnapshot(
    origin.position,
    commands,
    5,
    stopAtSeconds,
  );
  const stopSearch = createRumorSearchSnapshot(
    "checkpoint-04",
    origin,
    stopRoute,
  );
  const stoppedDoctrine = createDiscoveryDoctrineSnapshot(
    stopRoute,
    stopSearch,
    "STOP",
  );
  const scheduledResume = createDiscoveryResumeSnapshot(
    stoppedDoctrine,
    stopSearch.serverTruth.target.id,
  );
  assert.ok(scheduledResume);
  const lifecycle = createDiscoveryStopLifecycleSnapshot(
    timelineRoute,
    initialSupplies,
    profile,
    scheduledResume,
    idleDurationSeconds,
    expeditionElapsedSeconds,
  );
  assert.ok(lifecycle);
  const plannedRoute = createFourSegmentRouteSnapshot(
    origin.position,
    commands,
    5,
    lifecycle.movementElapsedSeconds,
  );
  const search = createRumorSearchSnapshot(
    "checkpoint-04",
    origin,
    plannedRoute,
  );
  const doctrine = createDiscoveryDoctrineSnapshot(
    plannedRoute,
    search,
    "STOP",
  );
  const resume = createDiscoveryResumeSnapshot(
    doctrine,
    search.serverTruth.target.id,
  );
  const outcome = createExpeditionOutcomeSnapshot(
    plannedRoute,
    initialSupplies,
    profile,
    resume ?? doctrine,
    null,
    "FLEE",
    plannedRoute.authoritativeRoute.speedMetersPerSecond,
    null,
    lifecycle,
  );
  const route = applyExpeditionOutcomeToRoute(plannedRoute, outcome);
  const status = createCaravanStatusSnapshot(
    route,
    initialSupplies,
    profile,
    resume ?? doctrine,
    outcome,
  );
  const log = createExpeditionEventLogSnapshot(
    route,
    initialSupplies,
    profile,
    search,
    doctrine,
    outcome,
    resume ?? scheduledResume,
    lifecycle,
  );

  return {
    stopAtSeconds,
    lifecycle,
    route,
    outcome,
    status,
    log,
  };
}

const game009Consumption = {
  moving: { foodUnitsPerHour: 1, waterUnitsPerHour: 2 },
  idle: { foodUnitsPerHour: 4, waterUnitsPerHour: 6 },
};
const game009Supplies = { foodUnits: 1_000, waterUnits: 2_000 };

test("GAME-009: explicit idle time consumes idle supplies without route movement", () => {
  const idleDurationSeconds = 6 * 3_600;
  const probe = game009ScenarioAt(
    0,
    idleDurationSeconds,
    game009Supplies,
    game009Consumption,
  );
  const scenario = game009ScenarioAt(
    probe.stopAtSeconds + 2 * 3_600,
    idleDurationSeconds,
    game009Supplies,
    game009Consumption,
  );
  const stopHours = scenario.stopAtSeconds / 3_600;

  assert.equal(scenario.outcome.status, "in-progress");
  assert.equal(scenario.outcome.phase, "idle-at-stop");
  assert.equal(scenario.route.position.elapsedSeconds, scenario.stopAtSeconds);
  assert.equal(scenario.status.supplies.activity, "idle");
  approx(
    scenario.status.supplies.foodRemaining,
    game009Supplies.foodUnits - stopHours - 8,
    1e-6,
  );
  approx(
    scenario.status.supplies.waterRemaining,
    game009Supplies.waterUnits - stopHours * 2 - 12,
    1e-6,
  );
  const resumeEvent = scenario.log.events.find(
    (event) => event.kind === "route-resumed",
  );
  assert.equal(
    resumeEvent?.atSeconds,
    scenario.stopAtSeconds + idleDurationSeconds,
  );
  assert.equal(resumeEvent?.occurred, false);
});

test("GAME-009: route completion and journal ETA shift by the full stop", () => {
  const idleDurationSeconds = 6 * 3_600;
  const probe = game009ScenarioAt(
    0,
    idleDurationSeconds,
    game009Supplies,
    game009Consumption,
  );
  const routeCompletion = probe.route.totalDurationSeconds;
  const scenario = game009ScenarioAt(
    routeCompletion + idleDurationSeconds,
    idleDurationSeconds,
    game009Supplies,
    game009Consumption,
  );

  assert.equal(scenario.outcome.status, "completed");
  assert.equal(scenario.route.position.status, "arrived");
  assert.equal(
    scenario.outcome.endedAtSeconds,
    routeCompletion + idleDurationSeconds,
  );
  assert.equal(
    scenario.log.events.at(-1)?.atSeconds,
    routeCompletion + idleDurationSeconds,
  );
  assert.equal(
    scenario.log.events.filter((event) => event.kind === "route-resumed")
      .length,
    1,
  );
});

test("GAME-009: idle depletion cancels resume and arrival at the STOP point", () => {
  const idleDurationSeconds = 6 * 3_600;
  const probe = game009ScenarioAt(
    0,
    idleDurationSeconds,
    game009Supplies,
    game009Consumption,
  );
  const stopHours = probe.stopAtSeconds / 3_600;
  const waterAtDeath =
    stopHours * game009Consumption.moving.waterUnitsPerHour +
    2 * game009Consumption.idle.waterUnitsPerHour;
  const scenario = game009ScenarioAt(
    probe.route.totalDurationSeconds + idleDurationSeconds,
    idleDurationSeconds,
    { foodUnits: 1_000, waterUnits: waterAtDeath },
    game009Consumption,
  );

  assert.equal(scenario.outcome.status, "failed");
  assert.equal(scenario.outcome.failureActivity, "idle");
  assert.equal(scenario.outcome.failureCause, "water");
  assert.equal(
    scenario.outcome.endedAtSeconds,
    scenario.stopAtSeconds + 2 * 3_600,
  );
  assert.equal(scenario.route.position.elapsedSeconds, scenario.stopAtSeconds);
  assert.equal(
    scenario.log.events.some((event) => event.kind === "route-resumed"),
    false,
  );
  assert.equal(
    scenario.log.events.some((event) => event.kind === "arrival"),
    false,
  );
  assert.equal(scenario.log.events.at(-1)?.failureActivity, "idle");
});

test("GAME-009: depletion tied with the end of STOP still prevents resume", () => {
  const idleDurationSeconds = 3 * 3_600;
  const probe = game009ScenarioAt(
    0,
    idleDurationSeconds,
    game009Supplies,
    game009Consumption,
  );
  const stopHours = probe.stopAtSeconds / 3_600;
  const waterAtTie =
    stopHours * game009Consumption.moving.waterUnitsPerHour +
    3 * game009Consumption.idle.waterUnitsPerHour;
  const scenario = game009ScenarioAt(
    probe.stopAtSeconds + idleDurationSeconds,
    idleDurationSeconds,
    { foodUnits: 1_000, waterUnits: waterAtTie },
    game009Consumption,
  );

  assert.equal(scenario.outcome.status, "failed");
  assert.equal(
    scenario.outcome.endedAtSeconds,
    scenario.stopAtSeconds + idleDurationSeconds,
  );
  assert.equal(
    scenario.log.events.some((event) => event.kind === "route-resumed"),
    false,
  );
});

test("GAME-009: the 25-percent warning can occur inside the idle interval", () => {
  const idleDurationSeconds = 3.5 * 3_600;
  const profile = {
    moving: { foodUnitsPerHour: 0, waterUnitsPerHour: 0 },
    idle: { foodUnitsPerHour: 0, waterUnitsPerHour: 4 },
  };
  const probe = game009ScenarioAt(
    0,
    idleDurationSeconds,
    { foodUnits: 100, waterUnits: 16 },
    profile,
  );
  const scenario = game009ScenarioAt(
    probe.stopAtSeconds + 3 * 3_600,
    idleDurationSeconds,
    { foodUnits: 100, waterUnits: 16 },
    profile,
  );
  const warning = scenario.log.events.find(
    (event) => event.kind === "supplies-low",
  );

  assert.equal(warning?.cause, "water");
  assert.equal(warning?.atSeconds, scenario.stopAtSeconds + 3 * 3_600);
  assert.equal(warning?.occurred, true);
  assert.equal(
    scenario.log.events.some((event) => event.kind === "supplies-depleted"),
    false,
  );
});

function game010ScenarioAt(
  expeditionElapsedSeconds,
  {
    idleDurationSeconds = 6 * 3_600,
    monsterPower = 110,
    strongMonsterDoctrine = "FLEE",
    fleeSpeedMetersPerSecond = 6 / 3.6,
    initialSupplies = game009Supplies,
    profile = game009Consumption,
  } = {},
) {
  const origin = rumorOrigin();
  const commands = directRumorCommands();
  const timelineRoute = createFourSegmentRouteSnapshot(
    origin.position,
    commands,
    5,
    expeditionElapsedSeconds,
  );
  const timelineSearch = createRumorSearchSnapshot(
    "checkpoint-04",
    origin,
    timelineRoute,
  );
  const plannedStop = timelineSearch.serverTruth.plannedDiscovery;
  assert.ok(plannedStop);
  const stopRoute = createFourSegmentRouteSnapshot(
    origin.position,
    commands,
    5,
    plannedStop.elapsedSeconds,
  );
  const stopSearch = createRumorSearchSnapshot(
    "checkpoint-04",
    origin,
    stopRoute,
  );
  const stoppedDoctrine = createDiscoveryDoctrineSnapshot(
    stopRoute,
    stopSearch,
    "STOP",
  );
  const scheduledResume = createDiscoveryResumeSnapshot(
    stoppedDoctrine,
    stopSearch.serverTruth.target.id,
  );
  assert.ok(scheduledResume);
  const scheduledLifecycle = createDiscoveryStopLifecycleSnapshot(
    timelineRoute,
    initialSupplies,
    profile,
    scheduledResume,
    idleDurationSeconds,
    expeditionElapsedSeconds,
  );
  assert.ok(scheduledLifecycle);
  const plannedRoute = createFourSegmentRouteSnapshot(
    origin.position,
    commands,
    5,
    scheduledLifecycle.movementElapsedSeconds,
  );
  const search = createRumorSearchSnapshot(
    "checkpoint-04",
    origin,
    plannedRoute,
  );
  const doctrine = createDiscoveryDoctrineSnapshot(
    plannedRoute,
    search,
    "STOP",
  );
  const resume = createDiscoveryResumeSnapshot(
    doctrine,
    search.serverTruth.target.id,
  );
  const world = createDebugMapSnapshot(
    "checkpoint-04",
    expeditionElapsedSeconds,
    2,
  );
  const sourceMonster = world.monsters.find(
    (monster) => monster.power === monsterPower,
  );
  assert.ok(sourceMonster);
  const plannedContactAtSeconds =
    plannedStop.elapsedSeconds + idleDurationSeconds / 2;
  const monster = createStationaryStopPatrolPreset(
    plannedStop.caravanPosition,
    plannedContactAtSeconds,
    sourceMonster,
    expeditionElapsedSeconds,
  );
  const contact = createMonsterContactSnapshot(
    plannedRoute,
    monster,
    scheduledLifecycle,
  );
  const outcome = createExpeditionOutcomeSnapshot(
    plannedRoute,
    initialSupplies,
    profile,
    resume ?? doctrine,
    contact,
    strongMonsterDoctrine,
    fleeSpeedMetersPerSecond,
    null,
    scheduledLifecycle,
  );
  const effectiveLifecycle = outcome.stopLifecycle ?? scheduledLifecycle;
  const route = applyExpeditionOutcomeToRoute(plannedRoute, outcome);
  const status = createCaravanStatusSnapshot(
    route,
    initialSupplies,
    profile,
    resume ?? doctrine,
    outcome,
  );
  const log = createExpeditionEventLogSnapshot(
    route,
    initialSupplies,
    profile,
    search,
    doctrine,
    outcome,
    resume ?? scheduledResume,
    effectiveLifecycle,
  );

  return {
    stopAtSeconds: plannedStop.elapsedSeconds,
    plannedContactAtSeconds,
    scheduledLifecycle,
    effectiveLifecycle,
    monster,
    contact,
    outcome,
    route,
    status,
    log,
  };
}

test("GAME-010: DEV patrol guarantees a transient contact inside STOP", () => {
  const probe = game010ScenarioAt(0);
  const contact = probe.contact.contact;

  assert.equal(probe.monster.qaStationaryStop, true);
  assert.ok(contact);
  assert.equal(contact.caravanActivity, "idle");
  approx(contact.expeditionElapsedSeconds, probe.plannedContactAtSeconds, 1e-5);
  assert.equal(contact.routeElapsedSeconds, probe.stopAtSeconds);
  assert.ok(
    contact.expeditionElapsedSeconds <
      probe.scheduledLifecycle.resumeAtSeconds,
  );
});

test("GAME-010: weak patrol dies while the scheduled STOP continues", () => {
  const probe = game010ScenarioAt(0, { monsterPower: 90 });
  const scenario = game010ScenarioAt(
    probe.plannedContactAtSeconds + 60,
    { monsterPower: 90 },
  );

  assert.equal(
    scenario.outcome.monsterContactResolution?.status,
    "monster-defeated",
  );
  assert.equal(scenario.outcome.stopInterruptedByContact, false);
  assert.equal(scenario.outcome.phase, "idle-at-stop");
  assert.equal(scenario.route.position.elapsedSeconds, scenario.stopAtSeconds);
  assert.equal(
    scenario.effectiveLifecycle.resumeAtSeconds,
    scenario.stopAtSeconds + 6 * 3_600,
  );
});

test("GAME-010: successful FLEE interrupts STOP and resumes at contact", () => {
  const probe = game010ScenarioAt(0);
  const scenario = game010ScenarioAt(probe.plannedContactAtSeconds + 60);

  assert.equal(
    scenario.outcome.monsterContactResolution?.status,
    "flee-succeeded",
  );
  assert.equal(scenario.outcome.stopInterruptedByContact, true);
  assert.equal(scenario.outcome.scheduledIdleDurationSeconds, 6 * 3_600);
  approx(
    scenario.outcome.idleDurationSeconds,
    scenario.plannedContactAtSeconds - scenario.stopAtSeconds,
    1e-5,
  );
  approx(
    scenario.outcome.resumeAtSeconds ?? 0,
    scenario.plannedContactAtSeconds,
    1e-5,
  );
  assert.ok(scenario.route.position.elapsedSeconds > scenario.stopAtSeconds);
  const contactEventIndex = scenario.log.events.findIndex(
    (event) => event.kind === "monster-contact",
  );
  const resumeEventIndex = scenario.log.events.findIndex(
    (event) => event.kind === "route-resumed",
  );
  assert.ok(contactEventIndex >= 0);
  assert.ok(resumeEventIndex > contactEventIndex);
  assert.equal(
    scenario.log.events[resumeEventIndex]?.resumeReason,
    "monster-contact",
  );
});

test("GAME-010: failed FLEE destroys the caravan at the stationary contact", () => {
  const probe = game010ScenarioAt(0, {
    fleeSpeedMetersPerSecond: 5 / 3.6,
  });
  const scenario = game010ScenarioAt(probe.plannedContactAtSeconds, {
    fleeSpeedMetersPerSecond: 5 / 3.6,
  });

  assert.equal(scenario.outcome.status, "failed");
  assert.equal(scenario.outcome.failureReason, "monster");
  assert.equal(
    scenario.outcome.monsterContactResolution?.status,
    "flee-failed",
  );
  assert.equal(scenario.outcome.movementElapsedSeconds, scenario.stopAtSeconds);
  assert.equal(scenario.route.position.elapsedSeconds, scenario.stopAtSeconds);
});

test("GAME-010: ACCEPT_FIGHT is terminal at a stationary strong patrol", () => {
  const probe = game010ScenarioAt(0, {
    strongMonsterDoctrine: "ACCEPT_FIGHT",
  });
  const scenario = game010ScenarioAt(probe.plannedContactAtSeconds, {
    strongMonsterDoctrine: "ACCEPT_FIGHT",
  });

  assert.equal(scenario.outcome.status, "failed");
  assert.equal(scenario.outcome.failureReason, "monster");
  assert.equal(
    scenario.outcome.monsterContactResolution?.status,
    "expedition-defeated",
  );
  assert.equal(
    scenario.outcome.monsterContact?.caravanActivity,
    "idle",
  );
  assert.equal(scenario.route.position.elapsedSeconds, scenario.stopAtSeconds);
});

test("GAME-010: idle depletion wins an exact tie with stationary contact", () => {
  const probe = game010ScenarioAt(0);
  const contactAtSeconds =
    probe.contact.contact?.expeditionElapsedSeconds ?? 0;
  const stopHours = probe.stopAtSeconds / 3_600;
  const idleHours = (contactAtSeconds - probe.stopAtSeconds) / 3_600;
  const waterAtTie =
    stopHours * game009Consumption.moving.waterUnitsPerHour +
    idleHours * game009Consumption.idle.waterUnitsPerHour;
  const scenario = game010ScenarioAt(contactAtSeconds, {
    initialSupplies: { foodUnits: 1_000, waterUnits: waterAtTie },
  });

  assert.equal(scenario.outcome.status, "failed");
  assert.equal(scenario.outcome.failureReason, "supplies");
  assert.equal(scenario.outcome.failureActivity, "idle");
  assert.equal(scenario.outcome.monsterContact, null);
  assert.equal(
    scenario.log.events.some((event) => event.kind === "monster-contact"),
    false,
  );
});

function game021ScenarioAt(
  expeditionElapsedSeconds,
  { doctrine = "AVOID", monsterPower = 90 } = {},
) {
  const initialSupplies = { foodUnits: 100, waterUnits: 100 };
  const profile = {
    moving: { foodUnitsPerHour: 1, waterUnitsPerHour: 1 },
    idle: { foodUnitsPerHour: 1, waterUnitsPerHour: 1 },
  };
  const idleDurationSeconds = 6 * 3_600;
  const origin = rumorOrigin();
  const commands = directRumorCommands();
  const timelineRoute = createFourSegmentRouteSnapshot(
    origin.position,
    commands,
    5,
    expeditionElapsedSeconds,
  );
  const timelineSearch = createRumorSearchSnapshot(
    "checkpoint-04",
    origin,
    timelineRoute,
  );
  const plannedStop = timelineSearch.serverTruth.plannedDiscovery;
  assert.ok(plannedStop);
  const stopRoute = createFourSegmentRouteSnapshot(
    origin.position,
    commands,
    5,
    plannedStop.elapsedSeconds,
  );
  const stopSearch = createRumorSearchSnapshot(
    "checkpoint-04",
    origin,
    stopRoute,
  );
  const stoppedDoctrine = createDiscoveryDoctrineSnapshot(
    stopRoute,
    stopSearch,
    "STOP",
  );
  const scheduledResume = createDiscoveryResumeSnapshot(
    stoppedDoctrine,
    stopSearch.serverTruth.target.id,
  );
  assert.ok(scheduledResume);
  const scheduledLifecycle = createDiscoveryStopLifecycleSnapshot(
    timelineRoute,
    initialSupplies,
    profile,
    scheduledResume,
    idleDurationSeconds,
    expeditionElapsedSeconds,
  );
  assert.ok(scheduledLifecycle);
  const plannedRoute = createFourSegmentRouteSnapshot(
    origin.position,
    commands,
    5,
    scheduledLifecycle.movementElapsedSeconds,
  );
  const search = createRumorSearchSnapshot(
    "checkpoint-04",
    origin,
    plannedRoute,
  );
  const discoveryDoctrine = createDiscoveryDoctrineSnapshot(
    plannedRoute,
    search,
    "STOP",
  );
  const world = createDebugMapSnapshot(
    "checkpoint-04",
    expeditionElapsedSeconds,
    2,
  );
  const sourceMonster = world.monsters.find(
    (monster) => monster.power === monsterPower,
  );
  assert.ok(sourceMonster);
  const plannedContactAtSeconds =
    plannedStop.elapsedSeconds + idleDurationSeconds / 2;
  const monster = createStationaryStopPatrolPreset(
    plannedStop.caravanPosition,
    plannedContactAtSeconds,
    sourceMonster,
    expeditionElapsedSeconds,
  );
  const dangerDetection = createDangerDetectionSnapshot(
    plannedRoute,
    monster,
    scheduledLifecycle,
  );
  const danger = createDangerAvoidanceDoctrineSnapshot(
    plannedRoute,
    monster,
    doctrine,
    scheduledLifecycle,
    scheduledLifecycle.planned.atSeconds,
  );
  const executionRoute = danger.effectiveRoute;
  const effectiveLifecycle = danger.appliesAvoidance
    ? createDiscoveryStopLifecycleSnapshot(
        executionRoute,
        initialSupplies,
        profile,
        scheduledResume,
        danger.effectiveIdleDurationSeconds,
        expeditionElapsedSeconds,
      )
    : scheduledLifecycle;
  assert.ok(effectiveLifecycle);
  const contact = createMonsterContactSnapshot(
    executionRoute,
    monster,
    effectiveLifecycle,
  );
  const outcome = createExpeditionOutcomeSnapshot(
    executionRoute,
    initialSupplies,
    profile,
    scheduledResume,
    contact,
    "FLEE",
    executionRoute.authoritativeRoute.speedMetersPerSecond * 2,
    null,
    effectiveLifecycle,
    null,
    danger,
  );
  const route = applyExpeditionOutcomeToRoute(executionRoute, outcome);
  const log = createExpeditionEventLogSnapshot(
    route,
    initialSupplies,
    profile,
    search,
    discoveryDoctrine,
    outcome,
    scheduledResume,
    outcome.stopLifecycle ?? effectiveLifecycle,
    null,
    dangerDetection,
    danger,
  );

  return {
    plannedStop,
    plannedContactAtSeconds,
    plannedRoute,
    scheduledLifecycle,
    effectiveLifecycle,
    monster,
    dangerDetection,
    danger,
    contact,
    outcome,
    route,
    log,
  };
}

test("GAME-021: AVOID snapshot schedules exact departure from discovery STOP", () => {
  const scenario = game021ScenarioAt(0);

  assert.equal(scenario.danger.status, "pending");
  assert.equal(scenario.danger.triggerActivity, "idle");
  assert.equal(scenario.danger.triggersDuringIdleStop, true);
  assert.equal(scenario.danger.appliesAvoidance, true);
  assert.equal(scenario.danger.interruptsIdleStop, true);
  assert.ok(
    scenario.danger.effectiveIdleDurationSeconds <
      scenario.danger.scheduledIdleDurationSeconds,
  );
  assert.equal(scenario.danger.authoritativePlan.originalContact?.caravanActivity, "idle");
  assert.equal(scenario.danger.authoritativePlan.effectiveContact, null);
  assert.equal(scenario.contact.contact, null);
});

test("GAME-022: debug arbitration also selects one stable idle-STOP warning", () => {
  const scenario = game021ScenarioAt(0);
  const patrolA = {
    ...scenario.monster,
    id: "idle-a",
    authoritativeMonster: {
      ...scenario.monster.authoritativeMonster,
      id: "idle-a",
    },
  };
  const patrolB = {
    ...scenario.monster,
    id: "idle-b",
    authoritativeMonster: {
      ...scenario.monster.authoritativeMonster,
      id: "idle-b",
    },
  };
  const detection = createMultiPatrolDangerDetectionSnapshot(
    scenario.plannedRoute,
    [patrolB, patrolA],
    scenario.scheduledLifecycle,
  );

  assert.equal(detection.patrolCount, 2);
  assert.equal(detection.status, "forecast");
  assert.equal(detection.detection?.monsterId, "idle-a");
  assert.equal(detection.detection?.caravanActivity, "idle");
});

test("GAME-024: debug STOP AVOID clears the departure against every patrol", () => {
  const scenario = game021ScenarioAt(0);
  const patrolA = {
    ...scenario.monster,
    id: "idle-a",
    authoritativeMonster: {
      ...scenario.monster.authoritativeMonster,
      id: "idle-a",
    },
  };
  const patrolB = {
    ...scenario.monster,
    id: "idle-b",
    authoritativeMonster: {
      ...scenario.monster.authoritativeMonster,
      id: "idle-b",
    },
  };
  const danger = createMultiPatrolDangerAvoidanceDoctrineSnapshot(
    scenario.plannedRoute,
    [patrolB, patrolA],
    "AVOID",
    scenario.scheduledLifecycle,
    scenario.scheduledLifecycle.planned.atSeconds,
  );

  assert.equal(danger.status, "pending");
  assert.equal(danger.planStatus, "avoided");
  assert.equal(danger.triggerActivity, "idle");
  assert.equal(danger.triggersDuringIdleStop, true);
  assert.equal(danger.interruptsIdleStop, true);
  assert.equal(danger.patrolCount, 2);
  assert.deepEqual(danger.clearanceMonsterIds, ["idle-a", "idle-b"]);
  assert.equal(danger.detection?.monsterId, "idle-a");
  assert.equal(danger.effectiveContact, null);
  assert.ok(
    danger.effectiveIdleDurationSeconds <
      danger.scheduledIdleDurationSeconds,
  );

  const plan = danger.authoritativePlan;
  assert.ok(plan.decisionPosition);
  assert.ok(plan.detourSegmentIndexes);
  const continuation = createRoutePlan(
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
  for (const patrol of [patrolA, patrolB]) {
    assert.equal(
      findFirstExpeditionMonsterContact(
        continuation,
        patrol.authoritativeMonster,
        plan.decisionAtSeconds,
      ),
      null,
    );
  }
});

test("GAME-024: debug STOP CONTINUE preserves stable contact and full wait", () => {
  const scenario = game021ScenarioAt(0, { doctrine: "CONTINUE" });
  const patrolA = {
    ...scenario.monster,
    id: "idle-a",
    authoritativeMonster: {
      ...scenario.monster.authoritativeMonster,
      id: "idle-a",
    },
  };
  const patrolB = {
    ...scenario.monster,
    id: "idle-b",
    authoritativeMonster: {
      ...scenario.monster.authoritativeMonster,
      id: "idle-b",
    },
  };
  const danger = createMultiPatrolDangerAvoidanceDoctrineSnapshot(
    scenario.plannedRoute,
    [patrolB, patrolA],
    "CONTINUE",
    scenario.scheduledLifecycle,
    scenario.scheduledLifecycle.planned.atSeconds,
  );

  assert.equal(danger.status, "pending");
  assert.equal(danger.planStatus, "continued");
  assert.equal(danger.effectiveRoute, scenario.plannedRoute);
  assert.equal(danger.originalContact?.monsterId, "idle-a");
  assert.equal(danger.effectiveContact, danger.originalContact);
  assert.equal(
    danger.effectiveIdleDurationSeconds,
    scenario.scheduledLifecycle.idleDurationSeconds,
  );
  assert.equal(danger.interruptsIdleStop, false);
});

test("GAME-021: executed AVOID truncates STOP, logs resume and removes contact", () => {
  const probe = game021ScenarioAt(0);
  assert.ok(probe.danger.decisionAtSeconds);
  const scenario = game021ScenarioAt(probe.danger.decisionAtSeconds + 1);

  assert.equal(scenario.danger.status, "avoiding");
  assert.equal(scenario.outcome.stopInterruptedByDangerAvoidance, true);
  approx(
    scenario.outcome.idleDurationSeconds,
    scenario.danger.effectiveIdleDurationSeconds,
    1e-5,
  );
  assert.ok(
    scenario.route.position.elapsedSeconds >
      scenario.plannedStop.elapsedSeconds,
  );
  assert.equal(scenario.outcome.monsterContact, null);
  const kinds = scenario.log.events.map((event) => event.kind);
  assert.ok(kinds.includes("danger-detected"));
  assert.ok(kinds.includes("danger-doctrine-decision"));
  assert.ok(kinds.includes("route-resumed"));
  assert.equal(kinds.includes("monster-contact"), false);
  assert.equal(
    scenario.log.events.find((event) => event.kind === "route-resumed")
      ?.resumeReason,
    "danger-avoidance",
  );
});

test("GAME-021: CONTINUE snapshot preserves the full STOP and later contact", () => {
  const probe = game021ScenarioAt(0, { doctrine: "CONTINUE" });
  assert.ok(probe.danger.decisionAtSeconds);
  const scenario = game021ScenarioAt(
    probe.plannedContactAtSeconds + 1,
    { doctrine: "CONTINUE" },
  );

  assert.equal(scenario.danger.status, "continued");
  assert.equal(scenario.danger.appliesAvoidance, false);
  assert.equal(scenario.danger.effectiveRoute, scenario.plannedRoute);
  assert.equal(scenario.danger.authoritativePlan.routeChanged, false);
  assert.equal(
    scenario.effectiveLifecycle.idleDurationSeconds,
    scenario.scheduledLifecycle.idleDurationSeconds,
  );
  assert.equal(scenario.contact.contact?.caravanActivity, "idle");
  assert.ok(scenario.outcome.monsterContact);
  assert.ok(
    scenario.log.events.some((event) => event.kind === "monster-contact"),
  );
});

test("GAME-011: known target remains pending until the route reaches it", () => {
  const origin = rumorOrigin();
  const commands = directRumorCommands();
  const plan = createFourSegmentRouteSnapshot(origin.position, commands, 5, 0);
  const firstSearch = createRumorSearchSnapshot(
    "checkpoint-04",
    origin,
    plan,
  );
  const discoveryAtSeconds = firstSearch.serverTruth.plannedDiscoveryAtSeconds;
  assert.ok(discoveryAtSeconds);

  const beforeRoute = createFourSegmentRouteSnapshot(
    origin.position,
    commands,
    5,
    discoveryAtSeconds - 1,
  );
  const knownSearch = createRumorSearchSnapshot(
    "checkpoint-04",
    origin,
    beforeRoute,
    [firstSearch.serverTruth.target.id],
  );
  const doctrine = createDiscoveryDoctrineSnapshot(
    beforeRoute,
    knownSearch,
    "STOP",
  );

  assert.equal(knownSearch.targetKnowledge, "known");
  assert.equal(knownSearch.status, "searching");
  assert.equal(doctrine.status, "pending");
  assert.equal(doctrine.decision, null);
});

test("GAME-011: a known target is reobserved without executing STOP again", () => {
  const origin = rumorOrigin();
  const commands = directRumorCommands();
  const plan = createFourSegmentRouteSnapshot(origin.position, commands, 5, 0);
  const firstSearch = createRumorSearchSnapshot(
    "checkpoint-04",
    origin,
    plan,
  );
  const arrivedRoute = createFourSegmentRouteSnapshot(
    origin.position,
    commands,
    5,
    plan.totalDurationSeconds,
  );
  const knownSearch = createRumorSearchSnapshot(
    "checkpoint-04",
    origin,
    arrivedRoute,
    [firstSearch.serverTruth.target.id],
  );
  const doctrine = createDiscoveryDoctrineSnapshot(
    arrivedRoute,
    knownSearch,
    "STOP",
  );
  const executedRoute = applyDiscoveryDoctrineToRoute(arrivedRoute, doctrine);
  const log = createExpeditionEventLogSnapshot(
    executedRoute,
    searchSupplies,
    searchConsumption,
    knownSearch,
    doctrine,
  );

  assert.equal(knownSearch.status, "found");
  assert.equal(doctrine.status, "known-and-continuing");
  assert.equal(doctrine.decision, null);
  assert.equal(
    doctrine.movementElapsedSeconds,
    arrivedRoute.position.elapsedSeconds,
  );
  assert.equal(executedRoute.position.status, "arrived");
  assert.equal(
    log.events.some((event) => event.kind === "doctrine-decision"),
    false,
  );
  assert.equal(
    log.events.find((event) => event.kind === "known-target-observed")?.id,
    "rumor-target-reobserved",
  );
});

test("GAME-012: a selected ledger entry fills one coordinate-free return leg", () => {
  const recorded = recordDirectDiscoveryObservation(
    createPlayerDiscoveryLedger("checkpoint-04"),
    {
      expeditionNumber: 1,
      objectId: "rumor-mine-city-01",
      objectKind: "mine",
      originCityId: "city-01",
      rumorId: "rumor-city-01-01",
      observedAtSeconds: 6_540,
      segmentIndex: 0,
      routeDistanceMeters: 32_700,
      originBearingDeg: 307.75,
      originDistanceMeters: 32_850,
    },
  );

  const preset = createKnownObjectReturnRoutePreset(
    recorded.ledger,
    "rumor-mine-city-01",
  );

  assert.deepEqual(preset, {
    kind: "known-object-return",
    objectId: "rumor-mine-city-01",
    objectKind: "mine",
    originCityId: "city-01",
    source: "direct-observation",
    confidence: "confirmed",
    firstObservedInExpedition: 1,
    commands: [
      { bearingDeg: 307.75, distanceKilometers: 32.85 },
      { bearingDeg: 0, distanceKilometers: 0 },
      { bearingDeg: 0, distanceKilometers: 0 },
      { bearingDeg: 0, distanceKilometers: 0 },
    ],
  });
  assert.equal(JSON.stringify(preset).includes("latitude"), false);
  assert.equal(JSON.stringify(preset).includes("longitude"), false);
});

test("GAME-012: a return preset requires an existing ledger selection", () => {
  assert.throws(
    () =>
      createKnownObjectReturnRoutePreset(
        createPlayerDiscoveryLedger("checkpoint-04"),
        "unknown-object",
      ),
    /known ledger entry/,
  );
});

test("GAME-013: confirmed fixes project north-up from one local origin", () => {
  let ledger = createPlayerDiscoveryLedger("checkpoint-04");
  for (const [index, fix] of [
    ["north", "oasis", 0],
    ["east", "mine", 90],
    ["south", "ruins", 180],
    ["west", "cave", 270],
  ].entries()) {
    ledger = recordDirectDiscoveryObservation(ledger, {
      expeditionNumber: 1,
      objectId: fix[0],
      objectKind: fix[1],
      originCityId: "city-01",
      rumorId: `rumor-${index}`,
      observedAtSeconds: 1_000 + index,
      segmentIndex: 0,
      routeDistanceMeters: 10_000,
      originBearingDeg: fix[2],
      originDistanceMeters: 10_000,
    }).ledger;
  }

  const map = createSessionKnowledgeMapSnapshot(ledger);
  assert.equal(map.width, KNOWLEDGE_MAP_WIDTH);
  assert.equal(map.height, KNOWLEDGE_MAP_HEIGHT);
  assert.equal(map.originCityId, "city-01");
  assert.equal(map.scaleRadiusMeters, 10_000);
  assert.deepEqual(map.origin, { x: 260, y: 150 });
  const expected = [
    { objectId: "north", x: 260, y: 34 },
    { objectId: "east", x: 376, y: 150 },
    { objectId: "south", x: 260, y: 266 },
    { objectId: "west", x: 144, y: 150 },
  ];
  assert.deepEqual(
    map.entries.map((entry) => entry.objectId),
    expected.map((entry) => entry.objectId),
  );
  map.entries.forEach((entry, index) => {
    const target = expected[index];
    assert.ok(target);
    approx(entry.x, target.x);
    approx(entry.y, target.y);
  });
});

test("GAME-013: independent city origins remain separate selectable charts", () => {
  const first = recordDirectDiscoveryObservation(
    createPlayerDiscoveryLedger("checkpoint-04"),
    {
      expeditionNumber: 1,
      objectId: "mine-a",
      objectKind: "mine",
      originCityId: "city-01",
      rumorId: "rumor-a",
      observedAtSeconds: 1_000,
      segmentIndex: 0,
      routeDistanceMeters: 20_000,
      originBearingDeg: 45,
      originDistanceMeters: 20_000,
    },
  );
  const second = recordDirectDiscoveryObservation(first.ledger, {
    expeditionNumber: 2,
    objectId: "oasis-b",
    objectKind: "oasis",
    originCityId: "city-02",
    rumorId: "rumor-b",
    observedAtSeconds: 2_000,
    segmentIndex: 0,
    routeDistanceMeters: 30_000,
    originBearingDeg: 225,
    originDistanceMeters: 30_000,
  });

  const defaultMap = createSessionKnowledgeMapSnapshot(second.ledger);
  const cityTwoMap = createSessionKnowledgeMapSnapshot(
    second.ledger,
    "city-02",
  );

  assert.deepEqual(defaultMap.originCityIds, ["city-01", "city-02"]);
  assert.deepEqual(defaultMap.entries.map((entry) => entry.objectId), [
    "mine-a",
  ]);
  assert.equal(cityTwoMap.originCityId, "city-02");
  assert.deepEqual(cityTwoMap.entries.map((entry) => entry.objectId), [
    "oasis-b",
  ]);
  assert.equal(JSON.stringify(cityTwoMap).includes("latitude"), false);
  assert.equal(JSON.stringify(cityTwoMap).includes("longitude"), false);
});

test("GAME-013: map marker stays anchored to the first personal fix", () => {
  const first = recordDirectDiscoveryObservation(
    createPlayerDiscoveryLedger("checkpoint-04"),
    {
      expeditionNumber: 1,
      objectId: "known-mine",
      objectKind: "mine",
      originCityId: "city-01",
      rumorId: "rumor-first",
      observedAtSeconds: 1_000,
      segmentIndex: 0,
      routeDistanceMeters: 20_000,
      originBearingDeg: 90,
      originDistanceMeters: 20_000,
    },
  );
  const reobserved = recordDirectDiscoveryObservation(first.ledger, {
    expeditionNumber: 2,
    objectId: "known-mine",
    objectKind: "mine",
    originCityId: "city-01",
    rumorId: "rumor-later",
    observedAtSeconds: 3_000,
    segmentIndex: 1,
    routeDistanceMeters: 50_000,
    originBearingDeg: 180,
    originDistanceMeters: 50_000,
  });

  const marker = createSessionKnowledgeMapSnapshot(reobserved.ledger).entries[0];
  assert.equal(marker.bearingDeg, 90);
  assert.equal(marker.distanceMeters, 20_000);
  assert.equal(marker.x, 376);
  assert.equal(marker.y, 150);
});

test("GAME-013: empty knowledge and unknown origins are explicit", () => {
  const ledger = createPlayerDiscoveryLedger("checkpoint-04");
  const map = createSessionKnowledgeMapSnapshot(ledger);

  assert.equal(map.originCityId, null);
  assert.deepEqual(map.originCityIds, []);
  assert.deepEqual(map.entries, []);
  assert.equal(map.scaleRadiusMeters, 0);
  assert.throws(
    () => createSessionKnowledgeMapSnapshot(ledger, "city-99"),
    /knowledge-map origin/,
  );
});

test("GAME-014: a travelled prefix renders north-up without a discovery", () => {
  const recorded = recordExpeditionTravelProgress(
    createPlayerTravelLedger("checkpoint-04"),
    {
      expeditionNumber: 1,
      originCityId: "city-01",
      routeCommands: [
        { bearingDeg: 0, distanceMeters: 10_000 },
        { bearingDeg: 90, distanceMeters: 10_000 },
        { bearingDeg: 180, distanceMeters: 40_000 },
      ],
      traveledDistanceMeters: 15_000,
    },
  );
  const map = createSessionKnowledgeMapSnapshot(
    createPlayerDiscoveryLedger("checkpoint-04"),
    null,
    recorded.ledger,
  );

  assert.equal(map.originCityId, "city-01");
  assert.equal(map.entries.length, 0);
  assert.equal(map.tracks.length, 1);
  assert.equal(map.scaleRadiusMeters, 20_000);
  assert.deepEqual(map.tracks[0]?.points[0], { x: 260, y: 150 });
  approx(map.tracks[0]?.points[1]?.x, 260);
  approx(map.tracks[0]?.points[1]?.y, 92);
  approx(map.tracks[0]?.points[2]?.x, 289);
  approx(map.tracks[0]?.points[2]?.y, 92);
  assert.equal(map.tracks[0]?.traveledDistanceMeters, 15_000);
});

test("GAME-014: trail origins stay separate from unrelated discovery anchors", () => {
  const discovered = recordDirectDiscoveryObservation(
    createPlayerDiscoveryLedger("checkpoint-04"),
    {
      expeditionNumber: 1,
      objectId: "mine-a",
      objectKind: "mine",
      originCityId: "city-01",
      rumorId: "rumor-a",
      observedAtSeconds: 1_000,
      segmentIndex: 0,
      routeDistanceMeters: 10_000,
      originBearingDeg: 45,
      originDistanceMeters: 10_000,
    },
  );
  const travelled = recordExpeditionTravelProgress(
    createPlayerTravelLedger("checkpoint-04"),
    {
      expeditionNumber: 2,
      originCityId: "city-02",
      routeCommands: [{ bearingDeg: 225, distanceMeters: 8_000 }],
      traveledDistanceMeters: 8_000,
    },
  );

  const cityOne = createSessionKnowledgeMapSnapshot(
    discovered.ledger,
    "city-01",
    travelled.ledger,
  );
  const cityTwo = createSessionKnowledgeMapSnapshot(
    discovered.ledger,
    "city-02",
    travelled.ledger,
  );

  assert.deepEqual(cityOne.originCityIds, ["city-01", "city-02"]);
  assert.equal(cityOne.entries.length, 1);
  assert.equal(cityOne.tracks.length, 0);
  assert.equal(cityTwo.entries.length, 0);
  assert.equal(cityTwo.tracks.length, 1);
  assert.equal(JSON.stringify(cityTwo).includes("latitude"), false);
  assert.equal(JSON.stringify(cityTwo).includes("longitude"), false);
});

test("GAME-014: map rejects travel knowledge from another world seed", () => {
  assert.throws(
    () =>
      createSessionKnowledgeMapSnapshot(
        createPlayerDiscoveryLedger("checkpoint-04"),
        null,
        createPlayerTravelLedger("other-world"),
      ),
    /worldSeed/,
  );
});

test("GAME-015: the session visibility radius is physically scaled to 300 m", () => {
  const travelled = recordExpeditionTravelProgress(
    createPlayerTravelLedger("checkpoint-04"),
    {
      expeditionNumber: 1,
      originCityId: "city-01",
      routeCommands: [{ bearingDeg: 0, distanceMeters: 10_000 }],
      traveledDistanceMeters: 10_000,
    },
  );
  const map = createSessionKnowledgeMapSnapshot(
    createPlayerDiscoveryLedger("checkpoint-04"),
    null,
    travelled.ledger,
  );

  assert.equal(map.scaleRadiusMeters, 10_000);
  assert.equal(map.visibilityRadiusMeters, 300);
  approx(map.visibilityRadiusPixels, 3.48);
  approx(map.visibilityDiameterPixels, 6.96);
});

test("GAME-015: one physical radius shrinks predictably on a wider chart", () => {
  let ledger = createPlayerTravelLedger("checkpoint-04");
  ledger = recordExpeditionTravelProgress(ledger, {
    expeditionNumber: 1,
    originCityId: "city-01",
    routeCommands: [{ bearingDeg: 90, distanceMeters: 10_000 }],
    traveledDistanceMeters: 10_000,
  }).ledger;
  ledger = recordExpeditionTravelProgress(ledger, {
    expeditionNumber: 2,
    originCityId: "city-02",
    routeCommands: [{ bearingDeg: 90, distanceMeters: 100_000 }],
    traveledDistanceMeters: 100_000,
  }).ledger;

  const discoveries = createPlayerDiscoveryLedger("checkpoint-04");
  const local = createSessionKnowledgeMapSnapshot(
    discoveries,
    "city-01",
    ledger,
  );
  const wide = createSessionKnowledgeMapSnapshot(
    discoveries,
    "city-02",
    ledger,
  );

  approx(
    (local.visibilityRadiusPixels / local.radiusPixels) *
      local.scaleRadiusMeters,
    300,
  );
  approx(
    (wide.visibilityRadiusPixels / wide.radiusPixels) *
      wide.scaleRadiusMeters,
    300,
  );
  approx(local.visibilityRadiusPixels / wide.visibilityRadiusPixels, 10);
});

test("GAME-015: an empty session has no invented visibility aperture", () => {
  const map = createSessionKnowledgeMapSnapshot(
    createPlayerDiscoveryLedger("checkpoint-04"),
  );

  assert.equal(map.visibilityRadiusMeters, 300);
  assert.equal(map.visibilityRadiusPixels, 0);
  assert.equal(map.visibilityDiameterPixels, 0);
  assert.deepEqual(map.tracks, []);
});

test("GAME-016: a reached city projects only on its origin-city chart", () => {
  const travel = recordReachedCityLandmark(
    createPlayerTravelLedger("checkpoint-04"),
    {
      expeditionNumber: 1,
      originCityId: "city-01",
      cityId: "city-02",
      arrivedAtSeconds: 3_600,
      originBearingDeg: 90,
      originDistanceMeters: 25_000,
    },
  );
  const map = createSessionKnowledgeMapSnapshot(
    createPlayerDiscoveryLedger("checkpoint-04"),
    "city-01",
    travel,
  );

  assert.deepEqual(map.originCityIds, ["city-01"]);
  assert.equal(map.cityLandmarks.length, 1);
  assert.equal(map.cityLandmarks[0]?.cityId, "city-02");
  assert.equal(map.cityLandmarks[0]?.x, 318);
  assert.equal(map.cityLandmarks[0]?.y, 150);
  assert.equal(JSON.stringify(map.cityLandmarks).includes("latitude"), false);
  assert.equal(JSON.stringify(map.cityLandmarks).includes("longitude"), false);
});
