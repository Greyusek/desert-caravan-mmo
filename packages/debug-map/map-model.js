// @ts-check

import {
  DEFAULT_CITY_ARRIVAL_RADIUS_METERS,
  DEFAULT_CONCEALED_DISCOVERY_RADIUS_METERS,
  DEFAULT_DANGER_DETECTION_RADIUS_METERS,
  DEFAULT_FLEE_SAFE_SEPARATION_MULTIPLIER,
  DEFAULT_PLAYER_POWER,
  DEFAULT_VISIBLE_TARGET_RADIUS_METERS,
  createRoutePlan,
  createKnownObjectReturnNavigation,
  createRumorSearchScenario,
  destinationPoint,
  discoverStaticObjectsAlongRoute,
  evaluateDiscoveryStopLifecycle,
  evaluateExpeditionOutcome,
  evaluateStaticObjectDiscoveryDoctrine,
  expeditionTimeToRouteTime,
  findFirstCityArrival,
  findFirstExpeditionMonsterDangerDetection,
  findFirstExpeditionMonsterDangerDetectionAmongPatrols,
  findFirstExpeditionMonsterDangerDetectionDuringIdleStop,
  findFirstExpeditionMonsterDangerDetectionDuringIdleStopAmongPatrols,
  findFirstExpeditionMonsterContact,
  findFirstExpeditionMonsterContactWithIdleStop,
  generateSeededWorld,
  greatCircleDistance,
  kilometers,
  positionAtTime,
  planExpeditionMonsterDangerResponse,
  planExpeditionMonsterDangerResponseAmongPatrols,
  planExpeditionMonsterDangerResponseDuringIdleStop,
  planExpeditionMonsterDangerResponseDuringIdleStopAmongPatrols,
  planEmergencySupplyReturn,
  planEmergencySupplyReturnDuringIdleStop,
  projectCitySettlementAtTime,
  projectMixedActivitySupplies,
  resolveMonsterPowerContact,
  resumeStaticObjectDiscoveryDoctrine,
  routeTimeToExpeditionTime,
  timeToFirstDepletion,
  wanderingMonsterPositionAtTime,
} from "../sim-core/dist/src/index.js";

/** @typedef {import("../sim-core/dist/src/index.js").WorldCoordinate} WorldCoordinate */
/** @typedef {import("../sim-core/dist/src/index.js").SupplyStock} SupplyStock */
/** @typedef {import("../sim-core/dist/src/index.js").ConsumptionProfile} ConsumptionProfile */

/**
 * @typedef {object} DebugRouteCommand
 * @property {number} bearingDeg
 * @property {number} distanceKilometers
 */

export const DEBUG_MAP_WIDTH = 1_000;
export const DEBUG_MAP_HEIGHT = 500;
export const SIMULATION_CLOCK_SPEED_MULTIPLIERS = Object.freeze([
  1, 10, 100, 1_000,
]);
export const CONTACT_ZOOM_WIDTH = 480;
export const CONTACT_ZOOM_HEIGHT = 260;
export const CONTACT_ZOOM_SPATIAL_RADII_METERS = Object.freeze([
  1_000, 5_000, 25_000,
]);
export const CONTACT_ZOOM_TIME_RADII_SECONDS = Object.freeze([
  5 * 60, 30 * 60, 3 * 3_600,
]);
export const KNOWLEDGE_MAP_WIDTH = 520;
export const KNOWLEDGE_MAP_HEIGHT = 300;
const ROUTE_SAMPLE_TARGET_METERS = 100_000;
const MAX_ROUTE_SAMPLES_PER_SEGMENT = 64;
const LOCAL_ROUTE_SAMPLE_TARGET_METERS = 1_000;
const MAX_LOCAL_ROUTE_SAMPLES_PER_SEGMENT = 128;
const LOW_SUPPLY_FRACTION = 0.25;
const EVENT_TIME_EPSILON_SECONDS = 1e-9;
export const RUMOR_MAP_WIDTH = 400;
export const RUMOR_MAP_HEIGHT = 220;
const RUMOR_MAP_ORIGIN = { x: 260, y: 160 };
const RUMOR_MAP_PIXELS_PER_METER = 0.0022;
const RUMOR_SECTOR_SAMPLE_COUNT = 16;
const CONTACT_ZOOM_PADDING_PIXELS = 20;
const CONTACT_ZOOM_TIME_SAMPLE_COUNT = 64;
const KNOWLEDGE_MAP_PADDING_PIXELS = 34;

/**
 * Converts elapsed wall-clock time into authoritative simulation time. The
 * browser supplies a single elapsed value to the simulation core, while the
 * first expedition boundary remains an exact hard stop.
 *
 * @param {number} elapsedSeconds
 * @param {number} realElapsedSeconds
 * @param {number} speedMultiplier
 * @param {number} stopAtSeconds
 */
export function advanceSimulationClock(
  elapsedSeconds,
  realElapsedSeconds,
  speedMultiplier,
  stopAtSeconds,
) {
  assertNonNegativeFinite(elapsedSeconds, "elapsedSeconds");
  assertNonNegativeFinite(realElapsedSeconds, "realElapsedSeconds");
  assertNonNegativeFinite(stopAtSeconds, "stopAtSeconds");
  if (!SIMULATION_CLOCK_SPEED_MULTIPLIERS.includes(speedMultiplier)) {
    throw new RangeError(
      "speedMultiplier must be one of 1, 10, 100 or 1000",
    );
  }
  if (stopAtSeconds < elapsedSeconds) {
    throw new RangeError(
      "stopAtSeconds must be greater than or equal to elapsedSeconds",
    );
  }

  const nextElapsedSeconds = Math.min(
    stopAtSeconds,
    elapsedSeconds + realElapsedSeconds * speedMultiplier,
  );

  return {
    elapsedSeconds: nextElapsedSeconds,
    reachedBoundary: nextElapsedSeconds === stopAtSeconds,
  };
}

/**
 * @typedef {"departure" | "segment-completed" | "supplies-emergency-doctrine" | "supplies-low" | "supplies-depleted" | "target-discovered" | "known-target-observed" | "doctrine-decision" | "route-resumed" | "danger-detected" | "danger-doctrine-decision" | "monster-contact" | "search-missed" | "route-ended" | "arrival"} ExpeditionEventKind
 */

/**
 * @typedef {object} PlannedExpeditionEvent
 * @property {string} id
 * @property {ExpeditionEventKind} kind
 * @property {number} atSeconds
 * @property {number | null} segmentIndex
 * @property {"food" | "water" | "both" | null} cause
 * @property {number | null} distanceKilometers
 * @property {number} order
 * @property {import("../sim-core/dist/src/index.js").StaticWorldObjectKind} [objectKind]
 * @property {string} [objectId]
 * @property {import("../sim-core/dist/src/index.js").StaticObjectDiscoveryDoctrine} [doctrine]
 * @property {string} [monsterId]
 * @property {number} [monsterPower]
 * @property {number} [separationMeters]
 * @property {number} [detectionRadiusMeters]
 * @property {number} [interactionRadiusMeters]
 * @property {import("../sim-core/dist/src/index.js").DangerContactOrder} [dangerContactOrder]
 * @property {number | null} [secondsUntilContact]
 * @property {import("../sim-core/dist/src/index.js").DangerAvoidanceDoctrine} [dangerAvoidanceDoctrine]
 * @property {import("../sim-core/dist/src/index.js").DangerAvoidanceSide | null} [dangerAvoidanceSide]
 * @property {number | null} [detourAddedDistanceKilometers]
 * @property {number} [playerPower]
 * @property {number} [powerDelta]
 * @property {import("../sim-core/dist/src/index.js").PowerContactResolutionStatus} [powerResolutionStatus]
 * @property {import("../sim-core/dist/src/index.js").StrongMonsterContactDoctrine | null} [contactDoctrine]
 * @property {number} [monsterSpeedMetersPerSecond]
 * @property {number} [fleeSpeedMetersPerSecond]
 * @property {number} [safeSeparationMeters]
 * @property {number} [relativeSpeedMetersPerSecond]
 * @property {number | null} [secondsToSafeSeparation]
 * @property {import("../sim-core/dist/src/index.js").CaravanActivity} [caravanActivity]
 * @property {"scheduled" | "monster-contact" | "supply-emergency" | "danger-avoidance"} [resumeReason]
 * @property {string} [cityId]
 * @property {string} [cityName]
 * @property {number} [cityRadiusMeters]
 * @property {number} [distanceToCityMeters]
 * @property {import("../sim-core/dist/src/index.js").CityArrivalKind} [arrivalKind]
 * @property {number} [idleDurationSeconds]
 * @property {import("../sim-core/dist/src/index.js").CaravanActivity | null} [failureActivity]
 * @property {import("../sim-core/dist/src/index.js").SupplyEmergencyDoctrine} [supplyEmergencyDoctrine]
 * @property {import("../sim-core/dist/src/index.js").CaravanActivity} [supplyEmergencyActivity]
 * @property {number} [remainingFraction]
 * @property {number} [returnDistanceKilometers]
 */

/**
 * @typedef {object} ProjectedPoint
 * @property {number} x
 * @property {number} y
 */

/**
 * Equirectangular north-up projection used only by the developer map.
 * @param {WorldCoordinate} coordinate
 * @returns {ProjectedPoint}
 */
export function projectCoordinate(coordinate) {
  return projectDegrees(coordinate.latitudeDeg, coordinate.longitudeDeg);
}

/**
 * Splits a spherical route where it crosses the antimeridian so the browser
 * never draws a misleading line across the entire map.
 * @param {readonly WorldCoordinate[]} coordinates
 * @returns {ProjectedPoint[][]}
 */
export function splitPathAtAntimeridian(coordinates) {
  const first = coordinates[0];
  if (!first) return [];

  /** @type {ProjectedPoint[][]} */
  const paths = [[projectCoordinate(first)]];
  let previous = first;

  for (let index = 1; index < coordinates.length; index += 1) {
    const current = coordinates[index];
    if (!current) continue;

    const currentPath = paths[paths.length - 1];
    if (!currentPath) throw new Error("debug map path invariant failed");

    const longitudeDelta = current.longitudeDeg - previous.longitudeDeg;
    if (Math.abs(longitudeDelta) <= 180) {
      currentPath.push(projectCoordinate(current));
      previous = current;
      continue;
    }

    const adjustedLongitude =
      longitudeDelta > 180
        ? current.longitudeDeg - 360
        : current.longitudeDeg + 360;
    const crossingLongitude =
      adjustedLongitude > previous.longitudeDeg ? 180 : -180;
    const fraction =
      (crossingLongitude - previous.longitudeDeg) /
      (adjustedLongitude - previous.longitudeDeg);
    const crossingLatitude =
      previous.latitudeDeg +
      (current.latitudeDeg - previous.latitudeDeg) * fraction;

    currentPath.push(projectDegrees(crossingLatitude, crossingLongitude));
    paths.push([
      projectDegrees(crossingLatitude, -crossingLongitude),
      projectCoordinate(current),
    ]);
    previous = current;
  }

  return paths;
}

/**
 * Builds a browser-facing snapshot without moving any state into the UI.
 * Hidden coordinates are included intentionally because this is dev-only.
 * @param {string} seed
 * @param {number} [elapsedSeconds]
 * @param {number} [wanderingMonsterCount]
 */
export function createDebugMapSnapshot(
  seed,
  elapsedSeconds = 0,
  wanderingMonsterCount = 1,
) {
  assertNonNegativeFinite(elapsedSeconds, "elapsedSeconds");
  const world = generateSeededWorld(seed, { wanderingMonsterCount });
  const stocksByCityId = new Map(
    world.cityStocks.map((stocks) => [stocks.cityId, stocks]),
  );
  const populationsByCityId = new Map(
    world.cityPopulations.map((population) => [population.cityId, population]),
  );

  return {
    seed: world.seed,
    elapsedSeconds,
    cities: world.cities.map((city) => {
      const initialStocks = stocksByCityId.get(city.id);
      const population = populationsByCityId.get(city.id);
      if (!initialStocks || !population) {
        throw new Error(`city resource invariant failed for ${city.id}`);
      }
      return {
        id: city.id,
        name: city.name,
        position: city.position,
        point: projectCoordinate(city.position),
        population,
        initialStocks,
        stocks: projectCitySettlementAtTime(
          initialStocks,
          population,
          elapsedSeconds,
        ),
      };
    }),
    staticObjects: world.staticObjects.map((object) => ({
      id: object.id,
      kind: object.kind,
      position: object.position,
      point: projectCoordinate(object.position),
    })),
    monsters: world.wanderingMonsters.map((monster) => {
      const evaluated = wanderingMonsterPositionAtTime(monster, elapsedSeconds);
      const patrolCoordinates = [
        monster.patrolRoute.start,
        ...monster.patrolRoute.segments.map((segment) => segment.end),
      ];

      return {
        id: monster.id,
        power: monster.power,
        visionRadiusMeters: monster.visionRadiusMeters,
        dangerDetectionRadiusMeters:
          DEFAULT_DANGER_DETECTION_RADIUS_METERS,
        interactionRadiusMeters: monster.interactionRadiusMeters,
        periodSeconds: monster.patrolRoute.totalDurationSeconds,
        cycleIndex: evaluated.cycleIndex,
        segmentIndex: evaluated.segmentIndex,
        position: evaluated.coordinate,
        point: projectCoordinate(evaluated.coordinate),
        patrolPaths: splitPathAtAntimeridian(patrolCoordinates),
        authoritativeMonster: monster,
      };
    }),
  };
}

/**
 * GAME-019 exposes the first technical warning-radius entry without applying
 * AVOID geometry. The core also classifies whether a later 500 m contact is
 * planned or whether both boundaries coincide because execution starts
 * already unsafe.
 * @param {ReturnType<typeof createFourSegmentRouteSnapshot>} route
 * @param {ReturnType<typeof createDebugMapSnapshot>["monsters"][number]} monster
 * @param {ReturnType<typeof createDiscoveryStopLifecycleSnapshot> | null} [stopLifecycle]
 */
export function createDangerDetectionSnapshot(
  route,
  monster,
  stopLifecycle = null,
) {
  const detection = stopLifecycle && stopLifecycle.resumeAtSeconds !== null
    ? findFirstExpeditionMonsterDangerDetectionDuringIdleStop(
        route.authoritativeRoute,
        monster.authoritativeMonster,
        stopLifecycle.stopAtRouteSeconds,
        stopLifecycle.idleDurationSeconds,
        0,
        monster.dangerDetectionRadiusMeters,
      )
    : findFirstExpeditionMonsterDangerDetection(
        route.authoritativeRoute,
        monster.authoritativeMonster,
        0,
        monster.dangerDetectionRadiusMeters,
      );
  const evaluatedAtSeconds = Math.min(
    stopLifecycle?.evaluatedAtSeconds ?? route.position.elapsedSeconds,
    route.totalDurationSeconds + (stopLifecycle?.idleDurationSeconds ?? 0),
  );

  if (!detection) {
    return {
      status: /** @type {const} */ ("clear"),
      evaluatedAtSeconds,
      detection: null,
    };
  }

  const routePosition = positionAtTime(
    route.authoritativeRoute,
    detection.routeElapsedSeconds,
  );
  return {
    status:
      evaluatedAtSeconds + EVENT_TIME_EPSILON_SECONDS >=
      detection.expeditionElapsedSeconds
        ? /** @type {const} */ ("detected")
        : /** @type {const} */ ("forecast"),
    evaluatedAtSeconds,
    detection: {
      ...detection,
      segmentIndex: routePosition.segmentIndex,
      routeDistanceKilometers:
        routePosition.traveledDistanceMeters / 1_000,
      caravanPoint: projectCoordinate(detection.caravanPosition),
      monsterPoint: projectCoordinate(detection.monsterPosition),
    },
  };
}

/**
 * GAME-022 exposes the first authoritative warning across every patrol in the
 * debug world. It is intentionally separate from the selected-patrol doctrine
 * snapshot: multi-patrol avoidance clearance is a later checkpoint.
 * @param {ReturnType<typeof createFourSegmentRouteSnapshot>} route
 * @param {ReturnType<typeof createDebugMapSnapshot>["monsters"]} monsters
 * @param {ReturnType<typeof createDiscoveryStopLifecycleSnapshot> | null} [stopLifecycle]
 */
export function createMultiPatrolDangerDetectionSnapshot(
  route,
  monsters,
  stopLifecycle = null,
) {
  const detection = stopLifecycle && stopLifecycle.resumeAtSeconds !== null
    ? findFirstExpeditionMonsterDangerDetectionDuringIdleStopAmongPatrols(
        route.authoritativeRoute,
        monsters.map((monster) => monster.authoritativeMonster),
        stopLifecycle.stopAtRouteSeconds,
        stopLifecycle.idleDurationSeconds,
      )
    : findFirstExpeditionMonsterDangerDetectionAmongPatrols(
        route.authoritativeRoute,
        monsters.map((monster) => monster.authoritativeMonster),
      );
  const evaluatedAtSeconds = Math.min(
    stopLifecycle?.evaluatedAtSeconds ?? route.position.elapsedSeconds,
    route.totalDurationSeconds + (stopLifecycle?.idleDurationSeconds ?? 0),
  );

  if (!detection) {
    return {
      status: /** @type {const} */ ("clear"),
      patrolCount: monsters.length,
      evaluatedAtSeconds,
      detection: null,
    };
  }

  const routePosition = positionAtTime(
    route.authoritativeRoute,
    detection.routeElapsedSeconds,
  );
  return {
    status:
      evaluatedAtSeconds + EVENT_TIME_EPSILON_SECONDS >=
      detection.expeditionElapsedSeconds
        ? /** @type {const} */ ("detected")
        : /** @type {const} */ ("forecast"),
    patrolCount: monsters.length,
    evaluatedAtSeconds,
    detection: {
      ...detection,
      segmentIndex: routePosition.segmentIndex,
      routeDistanceKilometers:
        routePosition.traveledDistanceMeters / 1_000,
      caravanPoint: projectCoordinate(detection.caravanPosition),
      monsterPoint: projectCoordinate(detection.monsterPosition),
    },
  };
}

/**
 * GAME-020 exposes one deterministic danger-doctrine execution. The planned
 * AVOID route may be rendered before the warning, but its executed position is
 * identical to the original route until the exact 1000 m decision boundary.
 * @param {ReturnType<typeof createFourSegmentRouteSnapshot>} route
 * @param {ReturnType<typeof createDebugMapSnapshot>["monsters"][number]} monster
 * @param {import("../sim-core/dist/src/index.js").DangerAvoidanceDoctrine} doctrine
 * @param {ReturnType<typeof createDiscoveryStopLifecycleSnapshot> | null} [stopLifecycle]
 * @param {number | null} [blockingExpeditionAtSeconds]
 */
export function createDangerAvoidanceDoctrineSnapshot(
  route,
  monster,
  doctrine,
  stopLifecycle = null,
  blockingExpeditionAtSeconds = null,
) {
  const usesIdleStop = Boolean(
    stopLifecycle && stopLifecycle.resumeAtSeconds !== null,
  );
  const idlePlan = usesIdleStop && stopLifecycle
    ? planExpeditionMonsterDangerResponseDuringIdleStop(
        route.authoritativeRoute,
        monster.authoritativeMonster,
        doctrine,
        stopLifecycle.stopAtRouteSeconds,
        stopLifecycle.idleDurationSeconds,
        0,
        monster.dangerDetectionRadiusMeters,
        blockingExpeditionAtSeconds,
      )
    : null;
  const plan = idlePlan ?? planExpeditionMonsterDangerResponse(
        route.authoritativeRoute,
        monster.authoritativeMonster,
        doctrine,
        0,
        monster.dangerDetectionRadiusMeters,
      );
  const evaluatedAtSeconds = stopLifecycle?.evaluatedAtSeconds ??
    route.position.elapsedSeconds;
  const decisionOccurred =
    plan.decisionAtSeconds !== null &&
    evaluatedAtSeconds + EVENT_TIME_EPSILON_SECONDS >= plan.decisionAtSeconds;
  const appliesAvoidance = plan.status === "avoided";
  const scheduledIdleDurationSeconds =
    idlePlan?.scheduledIdleDurationSeconds ?? 0;
  const effectiveIdleDurationSeconds =
    idlePlan?.effectiveIdleDurationSeconds ?? 0;
  const effectiveRouteAtSeconds = appliesAvoidance && usesIdleStop &&
      stopLifecycle
    ? expeditionTimeToRouteTime(
        evaluatedAtSeconds,
        stopLifecycle.stopAtRouteSeconds,
        effectiveIdleDurationSeconds,
        true,
      )
    : evaluatedAtSeconds;
  const effectiveRoute = appliesAvoidance
    ? createRoutePlanSnapshot(plan.effectiveRoute, effectiveRouteAtSeconds)
    : route;
  const completionAtExpeditionSeconds =
    idlePlan?.completionAtExpeditionSeconds ??
    plan.effectiveRoute.totalDurationSeconds;
  const status = plan.status === "avoided"
    ? !decisionOccurred
      ? /** @type {const} */ ("pending")
      : evaluatedAtSeconds + EVENT_TIME_EPSILON_SECONDS >=
          (completionAtExpeditionSeconds ?? Number.POSITIVE_INFINITY)
        ? /** @type {const} */ ("avoided")
        : /** @type {const} */ ("avoiding")
    : plan.status === "continued" && !decisionOccurred
      ? /** @type {const} */ ("pending")
      : plan.status;

  return {
    doctrine,
    status,
    planStatus: plan.status,
    evaluatedAtSeconds,
    decisionOccurred,
    appliesAvoidance,
    triggerActivity: plan.detection?.caravanActivity ?? null,
    triggersDuringIdleStop: idlePlan?.triggersDuringIdleStop ?? false,
    scheduledIdleDurationSeconds,
    effectiveIdleDurationSeconds,
    interruptsIdleStop: idlePlan?.interruptsIdleStop ?? false,
    blockedByEarlierBoundary:
      plan.status === "blocked-by-earlier-boundary",
    blockingExpeditionAtSeconds:
      idlePlan?.blockingExpeditionAtSeconds ?? null,
    completionAtExpeditionSeconds,
    detection: plan.detection,
    decisionAtSeconds: plan.decisionAtSeconds,
    decisionRouteElapsedSeconds: plan.decisionRouteElapsedSeconds,
    decisionSegmentIndex: plan.decisionSegmentIndex,
    decisionRouteDistanceKilometers:
      plan.decisionRouteDistanceMeters === null
        ? null
        : plan.decisionRouteDistanceMeters / 1_000,
    detourWaypoint: plan.detourWaypoint,
    detourWaypointPoint: plan.detourWaypoint
      ? projectCoordinate(plan.detourWaypoint)
      : null,
    detourSide: plan.detourSide,
    detourWaypointRadiusMeters: plan.detourWaypointRadiusMeters,
    detourSegmentIndexes: plan.detourSegmentIndexes,
    detourDistanceKilometers:
      plan.detourDistanceMeters === null
        ? null
        : plan.detourDistanceMeters / 1_000,
    addedDistanceKilometers:
      plan.addedDistanceMeters === null
        ? null
        : plan.addedDistanceMeters / 1_000,
    rejoinPosition: plan.rejoinPosition,
    rejoinPoint: plan.rejoinPosition
      ? projectCoordinate(plan.rejoinPosition)
      : null,
    originalContact: plan.originalContact,
    effectiveContact: plan.effectiveContact,
    patrolCount: 1,
    clearanceMonsterIds: [monster.id],
    effectiveRoute,
    authoritativePlan: plan,
  };
}

/**
 * GAME-024 executes AVOID | CONTINUE from the first warning across all patrols
 * both while moving and during a scheduled discovery STOP. Every accepted
 * continuation is continuously cleared against the complete patrol set.
 * @param {ReturnType<typeof createFourSegmentRouteSnapshot>} route
 * @param {ReturnType<typeof createDebugMapSnapshot>["monsters"]} monsters
 * @param {import("../sim-core/dist/src/index.js").DangerAvoidanceDoctrine} doctrine
 * @param {ReturnType<typeof createDiscoveryStopLifecycleSnapshot> | null} [stopLifecycle]
 * @param {number | null} [blockingExpeditionAtSeconds]
 */
export function createMultiPatrolDangerAvoidanceDoctrineSnapshot(
  route,
  monsters,
  doctrine,
  stopLifecycle = null,
  blockingExpeditionAtSeconds = null,
) {
  const authoritativeMonsters = monsters.map(
    (monster) => monster.authoritativeMonster,
  );
  const usesIdleStop = Boolean(
    stopLifecycle && stopLifecycle.resumeAtSeconds !== null,
  );
  const idlePlan = usesIdleStop && stopLifecycle
    ? planExpeditionMonsterDangerResponseDuringIdleStopAmongPatrols(
        route.authoritativeRoute,
        authoritativeMonsters,
        doctrine,
        stopLifecycle.stopAtRouteSeconds,
        stopLifecycle.idleDurationSeconds,
        0,
        DEFAULT_DANGER_DETECTION_RADIUS_METERS,
        blockingExpeditionAtSeconds,
      )
    : null;
  const plan = idlePlan ?? planExpeditionMonsterDangerResponseAmongPatrols(
        route.authoritativeRoute,
        authoritativeMonsters,
        doctrine,
      );
  const evaluatedAtSeconds = stopLifecycle?.evaluatedAtSeconds ??
    route.position.elapsedSeconds;
  const decisionOccurred =
    plan.decisionAtSeconds !== null &&
    evaluatedAtSeconds + EVENT_TIME_EPSILON_SECONDS >= plan.decisionAtSeconds;
  const appliesAvoidance = plan.status === "avoided";
  const scheduledIdleDurationSeconds =
    idlePlan?.scheduledIdleDurationSeconds ?? 0;
  const effectiveIdleDurationSeconds =
    idlePlan?.effectiveIdleDurationSeconds ?? 0;
  const effectiveRouteAtSeconds = appliesAvoidance && usesIdleStop &&
      stopLifecycle
    ? expeditionTimeToRouteTime(
        evaluatedAtSeconds,
        stopLifecycle.stopAtRouteSeconds,
        effectiveIdleDurationSeconds,
        true,
      )
    : evaluatedAtSeconds;
  const effectiveRoute = appliesAvoidance
    ? createRoutePlanSnapshot(plan.effectiveRoute, effectiveRouteAtSeconds)
    : route;
  const completionAtExpeditionSeconds =
    idlePlan?.completionAtExpeditionSeconds ??
    plan.effectiveRoute.totalDurationSeconds;
  const status = plan.status === "avoided"
    ? !decisionOccurred
      ? /** @type {const} */ ("pending")
      : evaluatedAtSeconds + EVENT_TIME_EPSILON_SECONDS >=
          (completionAtExpeditionSeconds ?? Number.POSITIVE_INFINITY)
        ? /** @type {const} */ ("avoided")
        : /** @type {const} */ ("avoiding")
    : plan.status === "continued" && !decisionOccurred
      ? /** @type {const} */ ("pending")
      : plan.status;

  return {
    doctrine,
    status,
    planStatus: plan.status,
    evaluatedAtSeconds,
    decisionOccurred,
    appliesAvoidance,
    triggerActivity: plan.detection?.caravanActivity ?? null,
    triggersDuringIdleStop: idlePlan?.triggersDuringIdleStop ?? false,
    scheduledIdleDurationSeconds,
    effectiveIdleDurationSeconds,
    interruptsIdleStop: idlePlan?.interruptsIdleStop ?? false,
    blockedByEarlierBoundary:
      plan.status === "blocked-by-earlier-boundary",
    blockingExpeditionAtSeconds:
      idlePlan?.blockingExpeditionAtSeconds ?? null,
    completionAtExpeditionSeconds,
    detection: plan.detection,
    decisionAtSeconds: plan.decisionAtSeconds,
    decisionRouteElapsedSeconds: plan.decisionRouteElapsedSeconds,
    decisionSegmentIndex: plan.decisionSegmentIndex,
    decisionRouteDistanceKilometers:
      plan.decisionRouteDistanceMeters === null
        ? null
        : plan.decisionRouteDistanceMeters / 1_000,
    detourWaypoint: plan.detourWaypoint,
    detourWaypointPoint: plan.detourWaypoint
      ? projectCoordinate(plan.detourWaypoint)
      : null,
    detourSide: plan.detourSide,
    detourWaypointRadiusMeters: plan.detourWaypointRadiusMeters,
    detourSegmentIndexes: plan.detourSegmentIndexes,
    detourDistanceKilometers:
      plan.detourDistanceMeters === null
        ? null
        : plan.detourDistanceMeters / 1_000,
    addedDistanceKilometers:
      plan.addedDistanceMeters === null
        ? null
        : plan.addedDistanceMeters / 1_000,
    rejoinPosition: plan.rejoinPosition,
    rejoinPoint: plan.rejoinPosition
      ? projectCoordinate(plan.rejoinPosition)
      : null,
    originalContact: plan.originalContact,
    effectiveContact: plan.effectiveContact,
    patrolCount: plan.patrolCount,
    clearanceMonsterIds: [...plan.clearanceMonsterIds],
    effectiveRoute,
    authoritativePlan: plan,
  };
}

/**
 * GAME-004 exposes the first finite-caravan/cyclic-patrol SIM-008 contact to
 * the browser without moving encounter authority into the UI.
 * @param {ReturnType<typeof createFourSegmentRouteSnapshot>} route
 * @param {ReturnType<typeof createDebugMapSnapshot>["monsters"][number]} monster
 * @param {ReturnType<typeof createDiscoveryStopLifecycleSnapshot> | null} [stopLifecycle]
 */
export function createMonsterContactSnapshot(
  route,
  monster,
  stopLifecycle = null,
) {
  const contact = stopLifecycle && stopLifecycle.resumeAtSeconds !== null
    ? findFirstExpeditionMonsterContactWithIdleStop(
        route.authoritativeRoute,
        monster.authoritativeMonster,
        stopLifecycle.stopAtRouteSeconds,
        stopLifecycle.idleDurationSeconds,
      )
    : findFirstExpeditionMonsterContact(
        route.authoritativeRoute,
        monster.authoritativeMonster,
      );

  if (!contact) {
    return {
      status: /** @type {const} */ ("clear"),
      evaluatedAtSeconds: stopLifecycle?.evaluatedAtSeconds ??
        Math.min(route.position.elapsedSeconds, route.totalDurationSeconds),
      contact: null,
    };
  }

  const routePosition = positionAtTime(
    route.authoritativeRoute,
    contact.routeElapsedSeconds,
  );
  const evaluatedAtSeconds = stopLifecycle?.evaluatedAtSeconds ??
    Math.min(route.position.elapsedSeconds, route.totalDurationSeconds);

  return {
    status:
      evaluatedAtSeconds + EVENT_TIME_EPSILON_SECONDS >=
      contact.expeditionElapsedSeconds
        ? /** @type {const} */ ("contact")
        : /** @type {const} */ ("forecast"),
    evaluatedAtSeconds,
    contact: {
      ...contact,
      segmentIndex: routePosition.segmentIndex,
      routeDistanceKilometers:
        routePosition.traveledDistanceMeters / 1_000,
      caravanPoint: projectCoordinate(contact.caravanPosition),
      monsterPoint: projectCoordinate(contact.monsterPosition),
    },
  };
}

/**
 * Builds a deterministic north-up local view around a planned contact or, if
 * no contact exists, around the selected patrol at the current route time.
 * Spatial and temporal zoom affect presentation samples only.
 *
 * @param {ReturnType<typeof createFourSegmentRouteSnapshot>} route
 * @param {ReturnType<typeof createDebugMapSnapshot>["monsters"][number]} monster
 * @param {ReturnType<typeof createMonsterContactSnapshot> | null} [contactSnapshot]
 * @param {number} [spatialRadiusMeters]
 * @param {number} [timeRadiusSeconds]
 * @param {ReturnType<typeof createDiscoveryStopLifecycleSnapshot> | null} [stopLifecycle]
 */
export function createContactZoomSnapshot(
  route,
  monster,
  contactSnapshot = null,
  spatialRadiusMeters = 25_000,
  timeRadiusSeconds = 3 * 3_600,
  stopLifecycle = null,
) {
  if (!CONTACT_ZOOM_SPATIAL_RADII_METERS.includes(spatialRadiusMeters)) {
    throw new RangeError(
      "spatialRadiusMeters must be one of 1000, 5000 or 25000",
    );
  }
  if (!CONTACT_ZOOM_TIME_RADII_SECONDS.includes(timeRadiusSeconds)) {
    throw new RangeError(
      "timeRadiusSeconds must be one of 300, 1800 or 10800",
    );
  }

  const contact = contactSnapshot?.contact ?? null;
  if (contact && contact.monsterId !== monster.id) {
    throw new RangeError("contactSnapshot must belong to the selected monster");
  }

  const focusAtSeconds = contact
    ? contact.atSeconds
    : stopLifecycle?.evaluatedAtSeconds ??
      Math.min(route.position.elapsedSeconds, route.totalDurationSeconds);
  const focusRouteAtSeconds = stopLifecycle
    ? expeditionTimeToRouteTime(
        focusAtSeconds,
        stopLifecycle.stopAtRouteSeconds,
        stopLifecycle.idleDurationSeconds,
        stopLifecycle.resumeAtSeconds !== null,
      )
    : focusAtSeconds;
  const evaluatedCaravan = positionAtTime(
    route.authoritativeRoute,
    focusRouteAtSeconds,
  );
  const evaluatedMonster = wanderingMonsterPositionAtTime(
    monster.authoritativeMonster,
    focusAtSeconds,
  );
  const focusCaravanCoordinate = contact?.caravanPosition ??
    evaluatedCaravan.coordinate;
  const focusMonsterCoordinate = contact?.monsterPosition ??
    evaluatedMonster.coordinate;
  const centerCoordinate = contact
    ? focusCaravanCoordinate
    : focusMonsterCoordinate;
  const usableRadiusPixels =
    CONTACT_ZOOM_HEIGHT / 2 - CONTACT_ZOOM_PADDING_PIXELS;
  const metersPerPixel = spatialRadiusMeters / usableRadiusPixels;
  /** @param {WorldCoordinate} coordinate */
  const project = (coordinate) =>
    projectContactZoomCoordinate(
      centerCoordinate,
      coordinate,
      route.authoritativeRoute.planetRadiusMeters,
      metersPerPixel,
    );
  const windowStartSeconds = Math.max(0, focusAtSeconds - timeRadiusSeconds);
  const windowEndSeconds = Math.min(
    stopLifecycle && stopLifecycle.resumeAtSeconds !== null
      ? route.totalDurationSeconds + stopLifecycle.idleDurationSeconds
      : route.totalDurationSeconds,
    focusAtSeconds + timeRadiusSeconds,
  );
  const sampleTimes = sampleTimeRange(
    windowStartSeconds,
    windowEndSeconds,
    CONTACT_ZOOM_TIME_SAMPLE_COUNT,
  );

  return {
    focusKind: contact
      ? /** @type {const} */ ("contact")
      : /** @type {const} */ ("monster"),
    focusAtSeconds,
    centerCoordinate,
    spatialRadiusMeters,
    timeRadiusSeconds,
    windowStartSeconds,
    windowEndSeconds,
    metersPerPixel,
    interactionRadiusMeters:
      monster.authoritativeMonster.interactionRadiusMeters,
    interactionRadiusPixels:
      monster.authoritativeMonster.interactionRadiusMeters / metersPerPixel,
    dangerDetectionRadiusMeters: monster.dangerDetectionRadiusMeters,
    dangerDetectionRadiusPixels:
      monster.dangerDetectionRadiusMeters / metersPerPixel,
    caravanPath: sampleTimes.map((atSeconds) => {
      const routeAtSeconds = stopLifecycle
        ? expeditionTimeToRouteTime(
            atSeconds,
            stopLifecycle.stopAtRouteSeconds,
            stopLifecycle.idleDurationSeconds,
            stopLifecycle.resumeAtSeconds !== null,
          )
        : atSeconds;
      const position = positionAtTime(
        route.authoritativeRoute,
        routeAtSeconds,
      );
      return {
        atSeconds,
        coordinate: position.coordinate,
        point: project(position.coordinate),
      };
    }),
    monsterPath: sampleTimes.map((atSeconds) => {
      const position = wanderingMonsterPositionAtTime(
        monster.authoritativeMonster,
        atSeconds,
      );
      return {
        atSeconds,
        coordinate: position.coordinate,
        point: project(position.coordinate),
      };
    }),
    focusCaravan: {
      coordinate: focusCaravanCoordinate,
      point: project(focusCaravanCoordinate),
    },
    focusMonster: {
      coordinate: focusMonsterCoordinate,
      point: project(focusMonsterCoordinate),
    },
  };
}

/**
 * Creates a deterministic QA preset that reaches the patrol start after a
 * whole number of monster cycles, guaranteeing a SIM-008 contact on the way.
 * @param {WorldCoordinate} start
 * @param {ReturnType<typeof createDebugMapSnapshot>["monsters"][number]} monster
 * @param {number} [targetSpeedKilometersPerHour]
 */
export function createMonsterInterceptRoutePreset(
  start,
  monster,
  targetSpeedKilometersPerHour = 5,
) {
  assertPositiveFinite(
    targetSpeedKilometersPerHour,
    "targetSpeedKilometersPerHour",
  );
  const patrolRoute = monster.authoritativeMonster.patrolRoute;
  const distanceMeters = greatCircleDistance(
    start,
    patrolRoute.start,
    patrolRoute.planetRadiusMeters,
  );
  if (distanceMeters === 0) {
    throw new RangeError("intercept start must differ from patrol start");
  }

  const targetSpeedMetersPerSecond =
    (targetSpeedKilometersPerHour * 1_000) / 3_600;
  const cycleCount = Math.max(
    1,
    Math.round(
      distanceMeters /
        (targetSpeedMetersPerSecond * patrolRoute.totalDurationSeconds),
    ),
  );
  const durationSeconds = cycleCount * patrolRoute.totalDurationSeconds;
  const speedKilometersPerHour =
    (distanceMeters / durationSeconds) * 3.6;

  return {
    speedKilometersPerHour,
    cycleCount,
    durationSeconds,
    commands: [
      {
        bearingDeg: initialBearingDegrees(start, patrolRoute.start),
        distanceKilometers: distanceMeters / 1_000,
      },
      { bearingDeg: 0, distanceKilometers: 0 },
      { bearingDeg: 0, distanceKilometers: 0 },
      { bearingDeg: 0, distanceKilometers: 0 },
    ],
  };
}

/**
 * GAME-010 DEV preset — replaces one selected patrol route with a closed
 * great-circle pass whose first interaction-radius entry occurs at the exact
 * requested world time beside a stationary discovery STOP. Power, speed and
 * interaction metadata remain those of the selected generated monster.
 *
 * @param {WorldCoordinate} stopCoordinate
 * @param {number} contactAtSeconds
 * @param {ReturnType<typeof createDebugMapSnapshot>["monsters"][number]} monster
 * @param {number} [elapsedSeconds]
 */
export function createStationaryStopPatrolPreset(
  stopCoordinate,
  contactAtSeconds,
  monster,
  elapsedSeconds = 0,
) {
  assertPositiveFinite(contactAtSeconds, "contactAtSeconds");
  assertNonNegativeFinite(elapsedSeconds, "elapsedSeconds");
  const source = monster.authoritativeMonster;
  const planetRadiusMeters = source.patrolRoute.planetRadiusMeters;
  const speedMetersPerSecond = source.patrolRoute.speedMetersPerSecond;
  const approachDistanceMeters =
    contactAtSeconds * speedMetersPerSecond +
    source.interactionRadiusMeters;
  const start = destinationPoint(
    stopCoordinate,
    270,
    approachDistanceMeters,
    planetRadiusMeters,
  );
  const throughStopBearing = initialBearingDegrees(start, stopCoordinate);
  const farSide = destinationPoint(
    start,
    throughStopBearing,
    approachDistanceMeters * 2,
    planetRadiusMeters,
  );
  const returnDistanceMeters = greatCircleDistance(
    farSide,
    start,
    planetRadiusMeters,
  );
  const patrolRoute = createRoutePlan(
    start,
    [
      {
        bearingDeg: throughStopBearing,
        distanceMeters: approachDistanceMeters * 2,
      },
      {
        bearingDeg: initialBearingDegrees(farSide, start),
        distanceMeters: returnDistanceMeters,
      },
    ],
    speedMetersPerSecond,
    planetRadiusMeters,
  );
  const authoritativeMonster = {
    ...source,
    patrolRoute,
  };
  const evaluated = wanderingMonsterPositionAtTime(
    authoritativeMonster,
    elapsedSeconds,
  );
  const patrolCoordinates = [
    patrolRoute.start,
    ...patrolRoute.segments.map((segment) => segment.end),
  ];

  return {
    ...monster,
    periodSeconds: patrolRoute.totalDurationSeconds,
    cycleIndex: evaluated.cycleIndex,
    segmentIndex: evaluated.segmentIndex,
    position: evaluated.coordinate,
    point: projectCoordinate(evaluated.coordinate),
    patrolPaths: splitPathAtAntimeridian(patrolCoordinates),
    authoritativeMonster,
    qaStationaryStop: true,
    qaContactAtSeconds: contactAtSeconds,
  };
}

/**
 * GAME-007 creates a reproducible route to the selected city. A destination
 * that already contains the start point first receives a real outbound leg so
 * the later radius crossing is a return rather than a T+0 false positive.
 * @param {WorldCoordinate} start
 * @param {import("../sim-core/dist/src/index.js").City} destinationCity
 * @param {number} [cityRadiusMeters]
 */
export function createCityArrivalRoutePreset(
  start,
  destinationCity,
  cityRadiusMeters = DEFAULT_CITY_ARRIVAL_RADIUS_METERS,
) {
  assertNonNegativeFinite(cityRadiusMeters, "cityRadiusMeters");
  const distanceToDestinationMeters = greatCircleDistance(
    start,
    destinationCity.position,
  );

  if (distanceToDestinationMeters <= cityRadiusMeters + 1e-7) {
    const outboundDistanceMeters = Math.max(10_000, cityRadiusMeters * 4);
    const outboundPoint = destinationPoint(start, 0, outboundDistanceMeters);
    const returnDistanceMeters = greatCircleDistance(
      outboundPoint,
      destinationCity.position,
    );
    return {
      kind: /** @type {const} */ ("return"),
      commands: [
        { bearingDeg: 0, distanceKilometers: outboundDistanceMeters / 1_000 },
        {
          bearingDeg: initialBearingDegrees(
            outboundPoint,
            destinationCity.position,
          ),
          distanceKilometers: returnDistanceMeters / 1_000,
        },
        { bearingDeg: 0, distanceKilometers: 0 },
        { bearingDeg: 0, distanceKilometers: 0 },
      ],
    };
  }

  return {
    kind: /** @type {const} */ ("transfer"),
    commands: [
      {
        bearingDeg: initialBearingDegrees(start, destinationCity.position),
        distanceKilometers: distanceToDestinationMeters / 1_000,
      },
      { bearingDeg: 0, distanceKilometers: 0 },
      { bearingDeg: 0, distanceKilometers: 0 },
      { bearingDeg: 0, distanceKilometers: 0 },
    ],
  };
}

/**
 * GAME-012 converts one selected coordinate-free ledger fix into the four
 * route-editor commands used by the debug map. The preset deliberately carries
 * no world position and always starts at the first-observation city.
 * @param {import("../sim-core/dist/src/index.js").PlayerDiscoveryLedger} ledger
 * @param {string} objectId
 */
export function createKnownObjectReturnRoutePreset(ledger, objectId) {
  const navigation = createKnownObjectReturnNavigation(ledger, objectId);
  return {
    kind: /** @type {const} */ ("known-object-return"),
    objectId: navigation.objectId,
    objectKind: navigation.objectKind,
    originCityId: navigation.originCityId,
    source: navigation.source,
    confidence: navigation.confidence,
    firstObservedInExpedition: navigation.firstObservedInExpedition,
    commands: [
      {
        bearingDeg: navigation.command.bearingDeg,
        distanceKilometers: navigation.command.distanceMeters / 1_000,
      },
      { bearingDeg: 0, distanceKilometers: 0 },
      { bearingDeg: 0, distanceKilometers: 0 },
      { bearingDeg: 0, distanceKilometers: 0 },
    ],
  };
}

/**
 * GAME-013 projects confirmed player knowledge into a local north-up chart.
 * Independent origin cities remain separate chart anchors because the ledger
 * deliberately contains no absolute coordinates with which to join them.
 * Every marker is derived only from the immutable first-observation bearing
 * and distance exposed by GAME-012.
 *
 * @param {import("../sim-core/dist/src/index.js").PlayerDiscoveryLedger} ledger
 * @param {string | null} [preferredOriginCityId]
 * @param {import("../sim-core/dist/src/index.js").PlayerTravelLedger | null} [travelLedger]
 */
export function createSessionKnowledgeMapSnapshot(
  ledger,
  preferredOriginCityId = null,
  travelLedger = null,
) {
  if (!ledger || !Array.isArray(ledger.entries)) {
    throw new TypeError("ledger.entries must be an array");
  }
  if (travelLedger !== null) {
    if (!Array.isArray(travelLedger.tracks)) {
      throw new TypeError("travelLedger.tracks must be an array");
    }
    if (!Array.isArray(travelLedger.reachedCityLandmarks)) {
      throw new TypeError(
        "travelLedger.reachedCityLandmarks must be an array",
      );
    }
    if (travelLedger.worldSeed !== ledger.worldSeed) {
      throw new RangeError(
        "travelLedger.worldSeed must match the discovery ledger",
      );
    }
  }
  if (
    preferredOriginCityId !== null &&
    (typeof preferredOriginCityId !== "string" ||
      preferredOriginCityId.length === 0)
  ) {
    throw new RangeError("preferredOriginCityId must be null or non-empty");
  }

  const originCityIds = [
    ...new Set([
      ...ledger.entries.map(
        (entry) => entry.firstObservation.originCityId,
      ),
      ...(travelLedger?.tracks.map((track) => track.originCityId) ?? []),
      ...(travelLedger?.reachedCityLandmarks.map(
        (landmark) => landmark.originCityId,
      ) ?? []),
    ]),
  ];
  if (
    preferredOriginCityId !== null &&
    !originCityIds.includes(preferredOriginCityId)
  ) {
    throw new RangeError(
      "preferredOriginCityId must reference a knowledge-map origin",
    );
  }

  const originCityId = preferredOriginCityId ?? originCityIds[0] ?? null;
  const origin = {
    x: KNOWLEDGE_MAP_WIDTH / 2,
    y: KNOWLEDGE_MAP_HEIGHT / 2,
  };
  const navigations = originCityId
    ? ledger.entries
        .filter(
          (entry) => entry.firstObservation.originCityId === originCityId,
        )
        .map((entry) => createKnownObjectReturnNavigation(ledger, entry.objectId))
    : [];
  const localTracks = originCityId
    ? (travelLedger?.tracks ?? [])
        .filter((track) => track.originCityId === originCityId)
        .map(createLocalTravelTrack)
    : [];
  const cityLandmarks = originCityId
    ? (travelLedger?.reachedCityLandmarks ?? []).filter(
        (landmark) => landmark.originCityId === originCityId,
      )
    : [];
  const furthestTrackPointMeters = Math.max(
    0,
    ...localTracks.flatMap((track) =>
      track.points.map((point) =>
        Math.hypot(point.eastMeters, point.northMeters),
      ),
    ),
  );
  const furthestDistanceMeters = Math.max(
    0,
    ...navigations.map((navigation) => navigation.command.distanceMeters),
    ...cityLandmarks.map((landmark) => landmark.distanceMeters),
    furthestTrackPointMeters,
  );
  const scaleRadiusMeters =
    furthestDistanceMeters > 0
      ? niceKnowledgeMapRadius(furthestDistanceMeters)
      : 0;
  const radiusPixels =
    Math.min(KNOWLEDGE_MAP_WIDTH, KNOWLEDGE_MAP_HEIGHT) / 2 -
    KNOWLEDGE_MAP_PADDING_PIXELS;

  return {
    width: KNOWLEDGE_MAP_WIDTH,
    height: KNOWLEDGE_MAP_HEIGHT,
    originCityIds,
    originCityId,
    origin,
    radiusPixels,
    scaleRadiusMeters,
    visibilityRadiusMeters: DEFAULT_VISIBLE_TARGET_RADIUS_METERS,
    visibilityRadiusPixels:
      scaleRadiusMeters > 0
        ? (DEFAULT_VISIBLE_TARGET_RADIUS_METERS / scaleRadiusMeters) *
          radiusPixels
        : 0,
    visibilityDiameterPixels:
      scaleRadiusMeters > 0
        ? ((DEFAULT_VISIBLE_TARGET_RADIUS_METERS * 2) /
            scaleRadiusMeters) *
          radiusPixels
        : 0,
    tracks: localTracks.map((track) => ({
      expeditionNumber: track.expeditionNumber,
      originCityId: track.originCityId,
      traveledDistanceMeters: track.traveledDistanceMeters,
      points: track.points.map((point) => ({
        x:
          origin.x +
          (scaleRadiusMeters > 0
            ? (point.eastMeters / scaleRadiusMeters) * radiusPixels
            : 0),
        y:
          origin.y -
          (scaleRadiusMeters > 0
            ? (point.northMeters / scaleRadiusMeters) * radiusPixels
            : 0),
      })),
    })),
    cityLandmarks: cityLandmarks.map((landmark) => ({
      ...landmark,
      x:
        origin.x +
        (scaleRadiusMeters > 0
          ? (Math.sin((landmark.bearingDeg * Math.PI) / 180) *
              landmark.distanceMeters /
              scaleRadiusMeters) *
            radiusPixels
          : 0),
      y:
        origin.y -
        (scaleRadiusMeters > 0
          ? (Math.cos((landmark.bearingDeg * Math.PI) / 180) *
              landmark.distanceMeters /
              scaleRadiusMeters) *
            radiusPixels
          : 0),
    })),
    entries: navigations.map((navigation) => {
      const angleRadians = (navigation.command.bearingDeg * Math.PI) / 180;
      const distancePixels =
        scaleRadiusMeters > 0
          ? (navigation.command.distanceMeters / scaleRadiusMeters) *
            radiusPixels
          : 0;
      return {
        objectId: navigation.objectId,
        objectKind: navigation.objectKind,
        source: navigation.source,
        confidence: navigation.confidence,
        firstObservedInExpedition: navigation.firstObservedInExpedition,
        bearingDeg: navigation.command.bearingDeg,
        distanceMeters: navigation.command.distanceMeters,
        x: origin.x + Math.sin(angleRadians) * distancePixels,
        y: origin.y - Math.cos(angleRadians) * distancePixels,
      };
    }),
  };
}

/**
 * GAME-016 exposes only the relative fix earned by an authoritative arrival.
 * Planned or interrupted journeys return null and cannot create knowledge.
 * @param {ReturnType<typeof createExpeditionOutcomeSnapshot>} outcome
 * @param {{id: string, position: WorldCoordinate}} originCity
 * @param {number} expeditionNumber
 */
export function createReachedCityLandmarkInput(
  outcome,
  originCity,
  expeditionNumber,
) {
  if (
    outcome.status !== "completed" ||
    !outcome.cityArrival ||
    !outcome.destinationCity
  ) {
    return null;
  }
  return {
    expeditionNumber,
    originCityId: originCity.id,
    cityId: outcome.destinationCity.id,
    arrivedAtSeconds: outcome.cityArrival.atSeconds,
    originBearingDeg: initialBearingDegrees(
      originCity.position,
      outcome.destinationCity.position,
    ),
    originDistanceMeters: greatCircleDistance(
      originCity.position,
      outcome.destinationCity.position,
    ),
  };
}

/**
 * Integrates player-known bearing/distance legs on a local tangent chart.
 * No server coordinate is read or emitted.
 * @param {import("../sim-core/dist/src/index.js").ExpeditionTravelTrack} track
 */
function createLocalTravelTrack(track) {
  let eastMeters = 0;
  let northMeters = 0;
  const points = [{ eastMeters, northMeters }];
  for (const leg of track.legs) {
    const angleRadians = (leg.bearingDeg * Math.PI) / 180;
    eastMeters += Math.sin(angleRadians) * leg.distanceMeters;
    northMeters += Math.cos(angleRadians) * leg.distanceMeters;
    points.push({ eastMeters, northMeters });
  }
  return {
    expeditionNumber: track.expeditionNumber,
    originCityId: track.originCityId,
    traveledDistanceMeters: track.traveledDistanceMeters,
    points,
  };
}

/** @param {number} minimumRadiusMeters */
function niceKnowledgeMapRadius(minimumRadiusMeters) {
  assertPositiveFinite(minimumRadiusMeters, "minimumRadiusMeters");
  const magnitude = 10 ** Math.floor(Math.log10(minimumRadiusMeters));
  const normalized = minimumRadiusMeters / magnitude;
  const multiplier = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return multiplier * magnitude;
}

/**
 * Resolves the fixed four-leg UI-002 editor through the public simulation API.
 * The UI keeps kilometers and km/h at its boundary; sim-core continues to
 * receive meters and meters per second.
 * @param {WorldCoordinate} start
 * @param {readonly DebugRouteCommand[]} commands
 * @param {number} speedKilometersPerHour
 * @param {number} [elapsedSeconds]
 */
export function createFourSegmentRouteSnapshot(
  start,
  commands,
  speedKilometersPerHour,
  elapsedSeconds = 0,
) {
  if (commands.length !== 4) {
    throw new RangeError("UI-002 route must contain exactly four segments");
  }
  assertPositiveFinite(speedKilometersPerHour, "speedKilometersPerHour");
  assertNonNegativeFinite(elapsedSeconds, "elapsedSeconds");

  const route = createRoutePlan(
    start,
    commands.map((command, index) => {
      assertNonNegativeFinite(
        command.distanceKilometers,
        `commands[${index}].distanceKilometers`,
      );
      return {
        bearingDeg: command.bearingDeg,
        distanceMeters: kilometers(command.distanceKilometers),
      };
    }),
    (speedKilometersPerHour * 1_000) / 3_600,
  );
  return createRoutePlanSnapshot(route, elapsedSeconds);
}

/**
 * Resolves a server RoutePlan into the shared DEV presentation shape.
 * GAME-017 may add a fifth, automatic return leg outside the four-leg editor.
 * @param {import("../sim-core/dist/src/index.js").RoutePlan} route
 * @param {number} [elapsedSeconds]
 */
export function createRoutePlanSnapshot(route, elapsedSeconds = 0) {
  assertNonNegativeFinite(elapsedSeconds, "elapsedSeconds");
  const evaluated = positionAtTime(route, elapsedSeconds);
  const coordinates = sampleRouteCoordinates(route);

  return {
    start: route.start,
    end: route.end,
    speedKilometersPerHour: route.speedMetersPerSecond * 3.6,
    totalDistanceKilometers: route.totalDistanceMeters / 1_000,
    totalDurationSeconds: route.totalDurationSeconds,
    routePaths: splitPathAtAntimeridian(coordinates),
    segments: route.segments.map((segment) => ({
      index: segment.index,
      bearingDeg: segment.bearingDeg,
      distanceKilometers: segment.distanceMeters / 1_000,
      durationSeconds: segment.durationSeconds,
      etaEndSeconds: segment.etaEndSeconds,
      start: segment.start,
      end: segment.end,
      startPoint: projectCoordinate(segment.start),
      endPoint: projectCoordinate(segment.end),
    })),
    position: {
      ...evaluated,
      point: projectCoordinate(evaluated.coordinate),
    },
    authoritativeRoute: route,
  };
}

/**
 * GAME-017/018 prepares one deterministic emergency route across uninterrupted
 * movement or a scheduled discovery STOP. An earlier route-changing monster
 * boundary may still keep priority over the idle decision.
 * @param {ReturnType<typeof createFourSegmentRouteSnapshot>} route
 * @param {SupplyStock} initialSupplies
 * @param {ConsumptionProfile} consumptionProfile
 * @param {import("../sim-core/dist/src/index.js").SupplyEmergencyDoctrine} doctrine
 * @param {number | null} [pauseAtRouteSeconds]
 * @param {ReturnType<typeof createDiscoveryStopLifecycleSnapshot> | null} [stopLifecycle]
 * @param {number | null} [blockingExpeditionAtSeconds]
 */
export function createEmergencySupplyDoctrineSnapshot(
  route,
  initialSupplies,
  consumptionProfile,
  doctrine,
  pauseAtRouteSeconds = null,
  stopLifecycle = null,
  blockingExpeditionAtSeconds = null,
) {
  const movingPlan = planEmergencySupplyReturn(
    route.authoritativeRoute,
    initialSupplies,
    consumptionProfile,
    doctrine,
  );
  const movingTriggerAtSeconds = movingPlan.triggersBeforeRouteEnd
    ? movingPlan.threshold?.atSeconds ?? null
    : null;
  const movingTriggersBeforePause =
    movingTriggerAtSeconds !== null &&
    (pauseAtRouteSeconds === null ||
      movingTriggerAtSeconds <
        pauseAtRouteSeconds - EVENT_TIME_EPSILON_SECONDS);
  const idlePlan = stopLifecycle
    ? planEmergencySupplyReturnDuringIdleStop(
        route.authoritativeRoute,
        initialSupplies,
        consumptionProfile,
        doctrine,
        stopLifecycle.stopAtRouteSeconds,
        stopLifecycle.idleDurationSeconds,
      )
    : null;
  const idleTriggerAtSeconds = idlePlan?.triggersDuringIdleStop
    ? idlePlan.threshold?.atSeconds ?? null
    : null;
  const usesIdleStop =
    !movingTriggersBeforePause && idleTriggerAtSeconds !== null;
  const triggerAtSeconds = usesIdleStop
    ? idleTriggerAtSeconds
    : movingTriggerAtSeconds;
  const triggerAtRouteSeconds = usesIdleStop
    ? idlePlan?.threshold?.routeAtSeconds ?? null
    : movingTriggerAtSeconds;
  const blockedByEarlierPause =
    !usesIdleStop &&
    triggerAtSeconds !== null &&
    pauseAtRouteSeconds !== null &&
    pauseAtRouteSeconds <= triggerAtSeconds + EVENT_TIME_EPSILON_SECONDS;
  const blockedByEarlierBoundary =
    usesIdleStop &&
    triggerAtSeconds !== null &&
    blockingExpeditionAtSeconds !== null &&
    blockingExpeditionAtSeconds <=
      triggerAtSeconds + EVENT_TIME_EPSILON_SECONDS;
  const returnSegmentIndex = usesIdleStop
    ? idlePlan?.returnSegmentIndex ?? null
    : movingPlan.returnSegmentIndex;
  const appliesReturn =
    doctrine === "RETURN_TO_ORIGIN" &&
    returnSegmentIndex !== null &&
    !blockedByEarlierPause &&
    !blockedByEarlierBoundary;
  const interruptsIdleStop = Boolean(
    appliesReturn && usesIdleStop && idlePlan?.interruptsIdleStop,
  );
  const scheduledIdleDurationSeconds = stopLifecycle?.idleDurationSeconds ?? 0;
  const effectiveIdleDurationSeconds = interruptsIdleStop
    ? idlePlan?.effectiveIdleDurationSeconds ?? scheduledIdleDurationSeconds
    : scheduledIdleDurationSeconds;
  const evaluatedAtSeconds = stopLifecycle?.evaluatedAtSeconds ??
    route.position.elapsedSeconds;
  const effectivePlan = usesIdleStop ? idlePlan : movingPlan;
  const effectiveRouteAtSeconds = appliesReturn
    ? usesIdleStop && stopLifecycle
      ? expeditionTimeToRouteTime(
          evaluatedAtSeconds,
          stopLifecycle.stopAtRouteSeconds,
          effectiveIdleDurationSeconds,
          true,
        )
      : evaluatedAtSeconds
    : route.position.elapsedSeconds;
  const effectiveRoute = appliesReturn
    ? createRoutePlanSnapshot(
        effectivePlan?.effectiveRoute ?? route.authoritativeRoute,
        effectiveRouteAtSeconds,
      )
    : route;
  const decisionOccurred =
    triggerAtSeconds !== null &&
    evaluatedAtSeconds + EVENT_TIME_EPSILON_SECONDS >= triggerAtSeconds;
  const returnToOriginAtRouteSeconds = usesIdleStop
    ? idlePlan?.returnToOriginAtRouteSeconds ?? null
    : movingPlan.returnToOriginAtSeconds;
  const returnToOriginAtSeconds = usesIdleStop
    ? idlePlan?.returnToOriginAtExpeditionSeconds ?? null
    : movingPlan.returnToOriginAtSeconds;
  const status = triggerAtSeconds === null
    ? /** @type {const} */ ("not-triggered")
    : blockedByEarlierBoundary
      ? /** @type {const} */ ("blocked-by-earlier-boundary")
      : blockedByEarlierPause
      ? /** @type {const} */ ("blocked-by-earlier-pause")
      : !decisionOccurred
        ? /** @type {const} */ ("pending")
        : doctrine === "CONTINUE"
          ? /** @type {const} */ ("continued")
          : evaluatedAtSeconds + EVENT_TIME_EPSILON_SECONDS >=
              (returnToOriginAtSeconds ?? Number.POSITIVE_INFINITY)
            ? /** @type {const} */ ("returned")
            : /** @type {const} */ ("returning");

  return {
    doctrine,
    status,
    threshold: effectivePlan?.threshold ?? null,
    triggerActivity: triggerAtSeconds === null
      ? null
      : usesIdleStop
        ? /** @type {const} */ ("idle")
        : /** @type {const} */ ("moving"),
    triggerAtSeconds,
    triggerAtRouteSeconds,
    triggerSegmentIndex: effectivePlan?.triggerSegmentIndex ?? null,
    triggerRouteDistanceKilometers:
      effectivePlan?.triggerRouteDistanceMeters === null ||
      effectivePlan?.triggerRouteDistanceMeters === undefined
        ? null
        : effectivePlan.triggerRouteDistanceMeters / 1_000,
    blockedByEarlierPause,
    blockedByEarlierBoundary,
    blockingExpeditionAtSeconds,
    appliesReturn,
    interruptsIdleStop,
    scheduledIdleDurationSeconds,
    effectiveIdleDurationSeconds,
    returnSegmentIndex: appliesReturn ? returnSegmentIndex : null,
    returnBearingDeg: appliesReturn
      ? effectivePlan?.returnBearingDeg ?? null
      : null,
    returnDistanceKilometers:
      appliesReturn && effectivePlan?.returnDistanceMeters !== null &&
        effectivePlan?.returnDistanceMeters !== undefined
        ? effectivePlan.returnDistanceMeters / 1_000
        : null,
    returnToOriginAtRouteSeconds:
      appliesReturn ? returnToOriginAtRouteSeconds : null,
    returnToOriginAtSeconds: appliesReturn ? returnToOriginAtSeconds : null,
    effectiveRoute,
  };
}

/**
 * GAME-007 exposes the selected generated city and its first exact route entry.
 * @param {ReturnType<typeof createFourSegmentRouteSnapshot>} route
 * @param {import("../sim-core/dist/src/index.js").City} destinationCity
 * @param {number} [cityRadiusMeters]
 */
export function createCityArrivalSnapshot(
  route,
  destinationCity,
  cityRadiusMeters = DEFAULT_CITY_ARRIVAL_RADIUS_METERS,
) {
  const arrival = findFirstCityArrival(
    route.authoritativeRoute,
    destinationCity,
    cityRadiusMeters,
  );
  const evaluatedAtSeconds = Math.min(
    route.position.elapsedSeconds,
    route.totalDurationSeconds,
  );

  return {
    city: destinationCity,
    radiusMeters: cityRadiusMeters,
    evaluatedAtSeconds,
    status: arrival
      ? evaluatedAtSeconds + EVENT_TIME_EPSILON_SECONDS >= arrival.elapsedSeconds
        ? /** @type {const} */ ("arrived")
        : /** @type {const} */ ("forecast")
      : evaluatedAtSeconds + EVENT_TIME_EPSILON_SECONDS >=
          route.totalDurationSeconds
        ? /** @type {const} */ ("missed")
        : /** @type {const} */ ("unreachable"),
    arrival: arrival
      ? {
          ...arrival,
          atSeconds: arrival.elapsedSeconds,
          routeDistanceKilometers: arrival.routeDistanceMeters / 1_000,
          point: projectCoordinate(arrival.caravanPosition),
        }
      : null,
  };
}

/**
 * GAME-001 joins one coarse rumor to an authoritative hidden target and the
 * existing route-aware discovery API. Search truth is revealed only when the
 * selected simulation time reaches discovery or route completion.
 * @param {string} seed
 * @param {import("../sim-core/dist/src/index.js").City} originCity
 * @param {ReturnType<typeof createFourSegmentRouteSnapshot>} route
 * @param {readonly string[]} [knownObjectIds]
 */
export function createRumorSearchSnapshot(
  seed,
  originCity,
  route,
  knownObjectIds = [],
) {
  const scenario = createRumorSearchScenario(seed, originCity);
  const targetPreviouslyKnown = knownObjectIds.includes(
    scenario.serverTruth.target.id,
  );
  const plannedDiscovery = discoverStaticObjectsAlongRoute(
    route.authoritativeRoute,
    [scenario.serverTruth.target],
    DEFAULT_CONCEALED_DISCOVERY_RADIUS_METERS,
  )[0] ?? null;
  const evaluatedAtSeconds = Math.min(
    route.position.elapsedSeconds,
    route.totalDurationSeconds,
  );
  const found =
    plannedDiscovery !== null &&
    plannedDiscovery.elapsedSeconds <=
      evaluatedAtSeconds + EVENT_TIME_EPSILON_SECONDS;
  const status = found
    ? "found"
    : evaluatedAtSeconds >=
        route.totalDurationSeconds - EVENT_TIME_EPSILON_SECONDS
      ? "missed"
      : "searching";
  const localRouteCoordinates = sampleRouteCoordinates(
    route.authoritativeRoute,
    LOCAL_ROUTE_SAMPLE_TARGET_METERS,
    MAX_LOCAL_ROUTE_SAMPLES_PER_SEGMENT,
  );

  return {
    rumor: scenario.rumor,
    originCity: {
      id: originCity.id,
      name: originCity.name,
    },
    targetKnowledge: targetPreviouslyKnown
      ? /** @type {const} */ ("known")
      : /** @type {const} */ ("unknown"),
    status,
    evaluatedAtSeconds,
    discoveryRadiusMeters: DEFAULT_CONCEALED_DISCOVERY_RADIUS_METERS,
    discovery:
      found && plannedDiscovery
        ? {
            atSeconds: plannedDiscovery.elapsedSeconds,
            segmentIndex: plannedDiscovery.segmentIndex,
            routeDistanceKilometers:
              plannedDiscovery.routeDistanceMeters / 1_000,
          }
        : null,
    localMap: {
      width: RUMOR_MAP_WIDTH,
      height: RUMOR_MAP_HEIGHT,
      originPoint: RUMOR_MAP_ORIGIN,
      minimumRangePixels:
        scenario.rumor.distanceRange.minimumMeters *
        RUMOR_MAP_PIXELS_PER_METER,
      maximumRangePixels:
        scenario.rumor.distanceRange.maximumMeters *
        RUMOR_MAP_PIXELS_PER_METER,
      clueAreaPoints: rumorClueAreaPoints(scenario.rumor),
      cluePoint: localPointFromBearingDistance(
        scenario.rumor.bearingSector.centerBearingDeg,
        (scenario.rumor.distanceRange.minimumMeters +
          scenario.rumor.distanceRange.maximumMeters) /
          2,
      ),
      targetPoint: localPointFromBearingDistance(
        scenario.serverTruth.exactBearingDeg,
        scenario.serverTruth.exactDistanceMeters,
      ),
      routePoints: localRouteCoordinates.map((coordinate) =>
        projectLocalCoordinate(
          originCity.position,
          coordinate,
          route.authoritativeRoute.planetRadiusMeters,
        ),
      ),
      caravanPoint: projectLocalCoordinate(
        originCity.position,
        route.position.coordinate,
        route.authoritativeRoute.planetRadiusMeters,
      ),
    },
    serverTruth: {
      target: scenario.serverTruth.target,
      exactBearingDeg: scenario.serverTruth.exactBearingDeg,
      exactDistanceKilometers:
        scenario.serverTruth.exactDistanceMeters / 1_000,
      plannedDiscoveryAtSeconds: plannedDiscovery?.elapsedSeconds ?? null,
      plannedDiscovery,
    },
  };
}

/**
 * GAME-002 keeps doctrine evaluation in sim-core and exposes only the compact
 * decision state needed by the developer UI.
 * @param {ReturnType<typeof createFourSegmentRouteSnapshot>} route
 * @param {ReturnType<typeof createRumorSearchSnapshot>} rumorSearch
 * @param {import("../sim-core/dist/src/index.js").StaticObjectDiscoveryDoctrine} doctrine
 */
export function createDiscoveryDoctrineSnapshot(route, rumorSearch, doctrine) {
  const evaluatedAtSeconds = Math.min(
    route.position.elapsedSeconds,
    route.totalDurationSeconds,
  );
  const plannedDiscovery = rumorSearch.serverTruth.plannedDiscovery;
  if (
    rumorSearch.targetKnowledge === "known" &&
    plannedDiscovery !== null &&
    evaluatedAtSeconds + EVENT_TIME_EPSILON_SECONDS >=
      plannedDiscovery.elapsedSeconds
  ) {
    return {
      doctrine,
      status: /** @type {const} */ ("known-and-continuing"),
      evaluatedAtSeconds,
      movementElapsedSeconds: evaluatedAtSeconds,
      decision: null,
      knownObjectId: plannedDiscovery.object.id,
    };
  }
  const evaluation = evaluateStaticObjectDiscoveryDoctrine(
    plannedDiscovery,
    doctrine,
    evaluatedAtSeconds,
  );

  return {
    doctrine: evaluation.doctrine,
    status: evaluation.status,
    evaluatedAtSeconds: evaluation.evaluatedAtSeconds,
    movementElapsedSeconds: evaluation.movementElapsedSeconds,
    decision: evaluation.decision
      ? {
          ...evaluation.decision,
          routeDistanceKilometers:
            evaluation.decision.routeDistanceMeters / 1_000,
        }
      : null,
  };
}

/**
 * GAME-008 applies one explicit resume command only to the authoritative
 * object that produced an executed STOP. Before discovery the stored command
 * is dormant so deterministic timeline inspection can still rewind safely.
 * @param {ReturnType<typeof createDiscoveryDoctrineSnapshot>} doctrine
 * @param {string | null} [resumedObjectId]
 */
export function createDiscoveryResumeSnapshot(
  doctrine,
  resumedObjectId = null,
) {
  if (
    resumedObjectId === null ||
    doctrine.status === "pending" ||
    doctrine.status === "known-and-continuing"
  ) {
    return null;
  }

  const evaluation = resumeStaticObjectDiscoveryDoctrine(
    doctrine,
    resumedObjectId,
  );
  return {
    ...evaluation,
    decision: {
      ...evaluation.decision,
      routeDistanceKilometers:
        evaluation.decision.routeDistanceMeters / 1_000,
    },
    resumeDecision: {
      ...evaluation.resumeDecision,
      routeDistanceKilometers:
        evaluation.resumeDecision.routeDistanceMeters / 1_000,
    },
  };
}

/**
 * GAME-009 turns a stored GAME-008 resume command into a scheduled idle phase.
 * Browser elapsed time is expedition/world time; movement time remains pinned
 * to the authoritative discovery coordinate until the duration expires.
 *
 * @param {ReturnType<typeof createFourSegmentRouteSnapshot>} route
 * @param {SupplyStock} initialSupplies
 * @param {ConsumptionProfile} consumptionProfile
 * @param {ReturnType<typeof createDiscoveryResumeSnapshot> | null} resume
 * @param {number} idleDurationSeconds
 * @param {number} expeditionElapsedSeconds
 * @param {ReturnType<typeof createCityArrivalSnapshot> | null} [cityDestination]
 */
export function createDiscoveryStopLifecycleSnapshot(
  route,
  initialSupplies,
  consumptionProfile,
  resume,
  idleDurationSeconds,
  expeditionElapsedSeconds,
  cityDestination = null,
) {
  if (!resume) return null;
  const completionAtRouteSeconds = cityDestination
    ? cityDestination.arrival?.atSeconds ?? null
    : route.totalDurationSeconds;
  return evaluateDiscoveryStopLifecycle(
    route.authoritativeRoute,
    initialSupplies,
    consumptionProfile,
    expeditionElapsedSeconds,
    resume.resumeDecision.resumedAtSeconds,
    idleDurationSeconds,
    completionAtRouteSeconds,
  );
}

/**
 * Re-evaluates only the live route position after doctrine. The original plan,
 * waypoints and ETA remain intact for comparison in the debug overlay.
 * @param {ReturnType<typeof createFourSegmentRouteSnapshot>} route
 * @param {ReturnType<typeof createDiscoveryDoctrineSnapshot>} doctrine
 */
export function applyDiscoveryDoctrineToRoute(route, doctrine) {
  const evaluated = positionAtTime(
    route.authoritativeRoute,
    doctrine.movementElapsedSeconds,
  );

  return {
    ...route,
    position: {
      ...evaluated,
      point: projectCoordinate(evaluated.coordinate),
    },
  };
}

/**
 * GAME-006/007/010/021 composes route ETA, supplies, discovery STOP and the first
 * moving or stationary contact with Power plus an explicit movement-based
 * FLEE resolution. Successful FLEE during an idle STOP cancels its remainder
 * and resumes the original route at the exact contact time.
 * @param {ReturnType<typeof createFourSegmentRouteSnapshot>} route
 * @param {SupplyStock} initialSupplies
 * @param {ConsumptionProfile} consumptionProfile
 * @param {ReturnType<typeof createDiscoveryDoctrineSnapshot> | ReturnType<typeof createDiscoveryResumeSnapshot> | null} [doctrine]
 * @param {ReturnType<typeof createMonsterContactSnapshot> | null} [monsterContact]
 * @param {import("../sim-core/dist/src/index.js").StrongMonsterContactDoctrine} [strongMonsterDoctrine]
 * @param {number} [fleeSpeedMetersPerSecond]
 * @param {ReturnType<typeof createCityArrivalSnapshot> | null} [cityDestination]
 * @param {ReturnType<typeof createDiscoveryStopLifecycleSnapshot> | null} [stopLifecycle]
 * @param {ReturnType<typeof createEmergencySupplyDoctrineSnapshot> | null} [supplyEmergency]
 * @param {ReturnType<typeof createDangerAvoidanceDoctrineSnapshot> | null} [dangerAvoidance]
 */
export function createExpeditionOutcomeSnapshot(
  route,
  initialSupplies,
  consumptionProfile,
  doctrine = null,
  monsterContact = null,
  strongMonsterDoctrine = "FLEE",
  fleeSpeedMetersPerSecond = route.authoritativeRoute.speedMetersPerSecond,
  cityDestination = null,
  stopLifecycle = null,
  supplyEmergency = null,
  dangerAvoidance = null,
) {
  const doctrinePauseAtSeconds =
    doctrine?.status === "stopped"
      ? doctrine.decision?.decidedAtSeconds ?? null
      : null;
  const monsterPauseAtSeconds =
    monsterContact?.contact?.expeditionElapsedSeconds ?? null;
  const completionAtSeconds = cityDestination
    ? cityDestination.arrival?.atSeconds ?? null
    : route.totalDurationSeconds;
  let effectiveStopLifecycle = stopLifecycle;
  let baselineEvaluation = effectiveStopLifecycle ??
    evaluateExpeditionOutcome(
      route.authoritativeRoute,
      initialSupplies,
      consumptionProfile,
      route.position.elapsedSeconds,
      doctrinePauseAtSeconds,
      completionAtSeconds,
    );
  const evaluatedAtSeconds = effectiveStopLifecycle?.evaluatedAtSeconds ??
    route.position.elapsedSeconds;
  const contact = monsterContact?.contact ?? null;
  const fleeAttempt =
    contact && strongMonsterDoctrine === "FLEE"
      ? {
          caravanSpeedMetersPerSecond: fleeSpeedMetersPerSecond,
          monsterSpeedMetersPerSecond: contact.monsterSpeedMetersPerSecond,
          contactSeparationMeters: contact.separationMeters,
          safeSeparationMeters:
            contact.interactionRadiusMeters *
            DEFAULT_FLEE_SAFE_SEPARATION_MULTIPLIER,
        }
      : null;
  const contactResolution = contact
    ? resolveMonsterPowerContact(
        contact.monsterPower,
        strongMonsterDoctrine,
        DEFAULT_PLAYER_POWER,
        fleeAttempt,
      )
    : null;
  let contactExecutes =
    monsterPauseAtSeconds !== null &&
    monsterPauseAtSeconds <
      route.totalDurationSeconds +
        (stopLifecycle?.idleDurationSeconds ?? 0) -
        EVENT_TIME_EPSILON_SECONDS &&
    (monsterPauseAtSeconds <
      baselineEvaluation.planned.atSeconds - EVENT_TIME_EPSILON_SECONDS ||
      (Math.abs(
        monsterPauseAtSeconds - baselineEvaluation.planned.atSeconds,
      ) <= EVENT_TIME_EPSILON_SECONDS &&
        baselineEvaluation.planned.status === "paused"));
  const stopInterruptedByContact = Boolean(
    contactExecutes &&
    effectiveStopLifecycle &&
    contact?.caravanActivity === "idle" &&
    contactResolution?.status === "flee-succeeded",
  );
  if (
    stopInterruptedByContact &&
    effectiveStopLifecycle &&
    monsterPauseAtSeconds !== null
  ) {
    const effectiveIdleDurationSeconds = Math.max(
      0,
      monsterPauseAtSeconds - effectiveStopLifecycle.stopAtRouteSeconds,
    );
    effectiveStopLifecycle = evaluateDiscoveryStopLifecycle(
      route.authoritativeRoute,
      initialSupplies,
      consumptionProfile,
      evaluatedAtSeconds,
      effectiveStopLifecycle.stopAtRouteSeconds,
      effectiveIdleDurationSeconds,
      completionAtSeconds,
    );
    baselineEvaluation = effectiveStopLifecycle;
    contactExecutes =
      monsterPauseAtSeconds <
        baselineEvaluation.planned.atSeconds - EVENT_TIME_EPSILON_SECONDS ||
      (Math.abs(
        monsterPauseAtSeconds - baselineEvaluation.planned.atSeconds,
      ) <= EVENT_TIME_EPSILON_SECONDS &&
        baselineEvaluation.planned.status === "paused");
  }
  const contactDisposition = contactExecutes
    ? contactResolution?.routeDisposition ?? null
    : null;

  let evaluation = baselineEvaluation;
  /** @type {number | null} */
  let contactBoundaryMovementSeconds = null;
  /** @type {"doctrine-stop" | "monster-contact" | "monster-defeat" | "route-end" | null} */
  let interruptionCause =
    baselineEvaluation.planned.status === "paused"
      ? cityDestination && cityDestination.arrival === null &&
        (doctrinePauseAtSeconds === null ||
          Math.abs(
            baselineEvaluation.planned.atSeconds - doctrinePauseAtSeconds,
          ) > EVENT_TIME_EPSILON_SECONDS)
        ? /** @type {const} */ ("route-end")
        : /** @type {const} */ ("doctrine-stop")
      : null;

  if (
    (contactDisposition === "pause" || contactDisposition === "fail") &&
    monsterPauseAtSeconds !== null
  ) {
    const occurred =
      evaluatedAtSeconds + EVENT_TIME_EPSILON_SECONDS >=
      monsterPauseAtSeconds;
    const contactRouteAtSeconds =
      contact?.routeElapsedSeconds ?? monsterPauseAtSeconds;
    contactBoundaryMovementSeconds = contactRouteAtSeconds;
    const plannedStatus = contactDisposition === "fail"
      ? /** @type {const} */ ("failed")
      : /** @type {const} */ ("paused");
    const contactStatus = occurred
      ? plannedStatus
      : /** @type {const} */ ("in-progress");
    evaluation = {
      status: contactStatus,
      evaluatedAtSeconds,
      movementElapsedSeconds: occurred
        ? contactRouteAtSeconds
        : baselineEvaluation.movementElapsedSeconds,
      planned: {
        status: plannedStatus,
        atSeconds: monsterPauseAtSeconds,
        failureCause: null,
      },
      endedAtSeconds: occurred ? monsterPauseAtSeconds : null,
      failureCause: null,
      terminal: occurred && contactDisposition === "fail",
    };
    interruptionCause = contactDisposition === "fail"
      ? /** @type {const} */ ("monster-defeat")
      : /** @type {const} */ ("monster-contact");
  }
  const boundaryMovementElapsedSeconds =
    contactBoundaryMovementSeconds ??
    effectiveStopLifecycle?.planned.movementElapsedSeconds ??
    evaluation.planned.atSeconds;
  const boundaryPosition = positionAtTime(
    route.authoritativeRoute,
    boundaryMovementElapsedSeconds,
  );
  const evaluatedBoundarySeconds = Math.min(
    evaluatedAtSeconds,
    evaluation.planned.atSeconds,
  );
  const idleElapsedSeconds = !effectiveStopLifecycle ||
    effectiveStopLifecycle.resumeAtSeconds === null
    ? 0
    : Math.min(
        effectiveStopLifecycle.idleDurationSeconds,
        Math.max(
          0,
          evaluatedBoundarySeconds -
            effectiveStopLifecycle.stopAtRouteSeconds,
        ),
      );
  const supplies = projectMixedActivitySupplies(
    initialSupplies,
    consumptionProfile,
    evaluation.movementElapsedSeconds,
    idleElapsedSeconds,
  );

  return {
    ...evaluation,
    phase:
      evaluation.status === "in-progress"
        ? effectiveStopLifecycle?.phase ??
          /** @type {const} */ ("moving-to-stop")
        : /** @type {const} */ ("ended"),
    scheduledIdleDurationSeconds:
      (dangerAvoidance?.interruptsIdleStop
        ? dangerAvoidance.scheduledIdleDurationSeconds
        : null) ?? supplyEmergency?.scheduledIdleDurationSeconds ??
      stopLifecycle?.idleDurationSeconds ??
      0,
    idleDurationSeconds: effectiveStopLifecycle?.idleDurationSeconds ?? 0,
    idleElapsedSeconds,
    resumeAtSeconds: effectiveStopLifecycle?.resumeAtSeconds ?? null,
    completionAtSeconds:
      effectiveStopLifecycle?.completionAtSeconds ?? completionAtSeconds,
    failureActivity:
      interruptionCause === "monster-defeat"
        ? null
        : effectiveStopLifecycle?.failureActivity ??
          (evaluation.planned.status === "failed" ? "moving" : null),
    supplies,
    stopLifecycle: effectiveStopLifecycle,
    stopInterruptedByContact,
    stopInterruptedBySupplyEmergency: Boolean(
      supplyEmergency?.appliesReturn &&
      supplyEmergency.interruptsIdleStop,
    ),
    stopInterruptedByDangerAvoidance: Boolean(
      dangerAvoidance?.appliesAvoidance &&
      dangerAvoidance.interruptsIdleStop,
    ),
    interruptionCause,
    destinationCity: cityDestination?.city ?? null,
    cityArrivalRadiusMeters: cityDestination?.radiusMeters ?? null,
    cityArrival: cityDestination?.arrival ?? null,
    failureReason:
      evaluation.planned.status !== "failed"
        ? null
        : interruptionCause === "monster-defeat"
          ? /** @type {const} */ ("monster")
          : /** @type {const} */ ("supplies"),
    monsterContact: contactExecutes ? monsterContact?.contact ?? null : null,
    monsterContactResolution: contactExecutes ? contactResolution : null,
    planned: {
      ...evaluation.planned,
      segmentIndex: boundaryPosition.segmentIndex,
      routeDistanceKilometers:
        boundaryPosition.traveledDistanceMeters / 1_000,
      coordinate: boundaryPosition.coordinate,
    },
  };
}

/**
 * Re-evaluates live SIM-005 movement at the first GAME-003 boundary while
 * preserving the original route plan and ETA for forecast/inspection.
 * @param {ReturnType<typeof createFourSegmentRouteSnapshot>} route
 * @param {ReturnType<typeof createExpeditionOutcomeSnapshot>} outcome
 */
export function applyExpeditionOutcomeToRoute(route, outcome) {
  const evaluated = positionAtTime(
    route.authoritativeRoute,
    outcome.movementElapsedSeconds,
  );

  return {
    ...route,
    position: {
      ...evaluated,
      point: projectCoordinate(evaluated.coordinate),
    },
  };
}

/**
 * UI-003 combines the authoritative route position and SIM-006 supply model
 * into a presentation snapshot. Consumption stops at route arrival because
 * post-arrival activity is outside this checkpoint's scope.
 * @param {ReturnType<typeof createFourSegmentRouteSnapshot>} route
 * @param {SupplyStock} initialSupplies
 * @param {ConsumptionProfile} consumptionProfile
 * @param {ReturnType<typeof createDiscoveryDoctrineSnapshot> | ReturnType<typeof createDiscoveryResumeSnapshot> | null} [doctrine]
 * @param {ReturnType<typeof createExpeditionOutcomeSnapshot> | null} [outcome]
 */
export function createCaravanStatusSnapshot(
  route,
  initialSupplies,
  consumptionProfile,
  doctrine = null,
  outcome = null,
) {
  const routeCompletionSeconds =
    outcome?.cityArrival?.atSeconds ?? route.totalDurationSeconds;
  const stopLifecycle = outcome?.stopLifecycle ?? null;
  const scheduledIdleSeconds =
    stopLifecycle &&
    stopLifecycle.resumeAtSeconds !== null &&
    routeCompletionSeconds >
      stopLifecycle.stopAtRouteSeconds + EVENT_TIME_EPSILON_SECONDS
      ? stopLifecycle.idleDurationSeconds
      : 0;
  const expeditionDurationSeconds =
    routeCompletionSeconds + scheduledIdleSeconds;
  const expeditionDistanceMeters =
    (outcome?.cityArrival?.routeDistanceKilometers ??
      route.totalDistanceKilometers) * 1_000;
  const evaluatedAtSeconds = Math.min(
    outcome?.evaluatedAtSeconds ?? route.position.elapsedSeconds,
    expeditionDurationSeconds,
  );
  const supplies = outcome?.supplies ?? projectMixedActivitySupplies(
    initialSupplies,
    consumptionProfile,
    Math.min(route.position.elapsedSeconds, routeCompletionSeconds),
    0,
  );
  const movingFirstDepletion = timeToFirstDepletion(
    initialSupplies,
    consumptionProfile,
    "moving",
  );
  const firstDepletion = stopLifecycle
    ? stopLifecycle.planned.status === "failed"
      ? {
          atSeconds: stopLifecycle.planned.atSeconds,
          cause: stopLifecycle.planned.failureCause,
        }
      : { atSeconds: null, cause: null }
    : movingFirstDepletion;
  const atArrival = projectMixedActivitySupplies(
    initialSupplies,
    consumptionProfile,
    routeCompletionSeconds,
    scheduledIdleSeconds,
  );
  const routeProgress =
    expeditionDistanceMeters === 0
      ? 1
      : Math.min(
          1,
          route.position.traveledDistanceMeters / expeditionDistanceMeters,
        );

  return {
    doctrine,
    outcome,
    route: {
      status: route.position.status,
      segmentCount: route.authoritativeRoute.segments.length,
      segmentIndex: route.position.segmentIndex,
      segmentProgress: route.position.segmentProgress,
      progress: routeProgress,
      elapsedSeconds: route.position.elapsedSeconds,
      evaluatedAtSeconds,
      idleElapsedSeconds: outcome?.idleElapsedSeconds ?? 0,
      totalDurationSeconds: expeditionDurationSeconds,
      traveledDistanceKilometers:
        route.position.traveledDistanceMeters / 1_000,
      remainingDistanceKilometers:
        Math.max(
          0,
          expeditionDistanceMeters - route.position.traveledDistanceMeters,
        ) / 1_000,
    },
    supplies: {
      initialFoodUnits: initialSupplies.foodUnits,
      initialWaterUnits: initialSupplies.waterUnits,
      foodRemaining: supplies.foodRemaining,
      waterRemaining: supplies.waterRemaining,
      foodConsumed: supplies.foodConsumed,
      waterConsumed: supplies.waterConsumed,
      activity:
        outcome?.phase === "idle-at-stop"
          ? /** @type {const} */ ("idle")
          : /** @type {const} */ ("moving"),
      foodFraction: remainingFraction(
        supplies.foodRemaining,
        initialSupplies.foodUnits,
      ),
      waterFraction: remainingFraction(
        supplies.waterRemaining,
        initialSupplies.waterUnits,
      ),
      depleted: supplies.depleted,
      depletionCause: supplies.depleted ? supplies.depletionCause : null,
    },
    forecast: {
      canFinish: !atArrival.depleted,
      firstDepletionAtSeconds: firstDepletion.atSeconds,
      depletionCause: firstDepletion.cause,
      depletionBeforeOrAtArrival:
        firstDepletion.atSeconds !== null &&
        firstDepletion.atSeconds <= expeditionDurationSeconds,
      foodAtArrival: atArrival.foodRemaining,
      waterAtArrival: atArrival.waterRemaining,
    },
  };
}

/**
 * UI-004 builds a deterministic expedition timeline from existing route and
 * supply truth. GAME-003 trims it at the first authoritative pause, completion
 * or fatal-depletion boundary without mutating simulation state.
 * @param {ReturnType<typeof createFourSegmentRouteSnapshot>} route
 * @param {SupplyStock} initialSupplies
 * @param {ConsumptionProfile} consumptionProfile
 * @param {ReturnType<typeof createRumorSearchSnapshot> | null} [rumorSearch]
 * @param {ReturnType<typeof createDiscoveryDoctrineSnapshot> | null} [doctrine]
 * @param {ReturnType<typeof createExpeditionOutcomeSnapshot> | null} [outcome]
 * @param {ReturnType<typeof createDiscoveryResumeSnapshot> | null} [resume]
 * @param {ReturnType<typeof createDiscoveryStopLifecycleSnapshot> | null} [stopLifecycle]
 * @param {ReturnType<typeof createEmergencySupplyDoctrineSnapshot> | null} [supplyEmergency]
 * @param {ReturnType<typeof createDangerDetectionSnapshot> | null} [dangerDetection]
 * @param {ReturnType<typeof createDangerAvoidanceDoctrineSnapshot> | null} [dangerAvoidance]
 */
export function createExpeditionEventLogSnapshot(
  route,
  initialSupplies,
  consumptionProfile,
  rumorSearch = null,
  doctrine = null,
  outcome = null,
  resume = null,
  stopLifecycle = null,
  supplyEmergency = null,
  dangerDetection = null,
  dangerAvoidance = null,
) {
  /** @param {number} routeElapsedSeconds */
  const routeToExpeditionTime = (routeElapsedSeconds) =>
    stopLifecycle
      ? routeTimeToExpeditionTime(
          routeElapsedSeconds,
          stopLifecycle.stopAtRouteSeconds,
          stopLifecycle.idleDurationSeconds,
          stopLifecycle.resumeAtSeconds !== null,
        )
      : routeElapsedSeconds;
  const expeditionDurationSeconds = routeToExpeditionTime(
    route.totalDurationSeconds,
  );
  const movingFirstDepletion = timeToFirstDepletion(
    initialSupplies,
    consumptionProfile,
    "moving",
  );
  const firstDepletion = stopLifecycle
    ? stopLifecycle.planned.status === "failed"
      ? {
          atSeconds: stopLifecycle.planned.atSeconds,
          routeAtSeconds: stopLifecycle.planned.movementElapsedSeconds,
          cause: stopLifecycle.planned.failureCause,
          activity: stopLifecycle.failureActivity,
        }
      : {
          atSeconds: null,
          routeAtSeconds: null,
          cause: null,
          activity: null,
        }
    : {
        atSeconds: movingFirstDepletion.atSeconds,
        routeAtSeconds: movingFirstDepletion.atSeconds,
        cause: movingFirstDepletion.cause,
        activity: movingFirstDepletion.atSeconds === null
          ? null
          : /** @type {const} */ ("moving"),
      };
  /** @type {PlannedExpeditionEvent[]} */
  const events = [
    {
      id: "departure",
      kind: "departure",
      atSeconds: 0,
      segmentIndex: null,
      cause: null,
      distanceKilometers: 0,
      order: 0,
    },
  ];

  let cumulativeDistanceKilometers = 0;
  for (const segment of route.segments.slice(0, -1)) {
    cumulativeDistanceKilometers += segment.distanceKilometers;
    events.push({
      id: `segment-${String(segment.index + 1).padStart(2, "0")}`,
      kind: "segment-completed",
      atSeconds: routeToExpeditionTime(segment.etaEndSeconds),
      segmentIndex: segment.index,
      cause: null,
      distanceKilometers: cumulativeDistanceKilometers,
      order: 20,
    });
  }

  addLowSupplyEvents(
    events,
    initialSupplies,
    consumptionProfile,
    firstDepletion.atSeconds,
    expeditionDurationSeconds,
    stopLifecycle,
  );

  addRumorSearchEvent(
    events,
    rumorSearch,
    doctrine,
    resume,
    expeditionDurationSeconds,
    stopLifecycle,
    outcome,
    supplyEmergency,
    dangerAvoidance,
  );

  if (
    supplyEmergency?.triggerAtSeconds !== null &&
    supplyEmergency?.triggerAtSeconds !== undefined &&
    !supplyEmergency.blockedByEarlierPause &&
    !supplyEmergency.blockedByEarlierBoundary
  ) {
    events.push({
      id: "supplies-emergency-doctrine",
      kind: "supplies-emergency-doctrine",
      atSeconds: supplyEmergency.triggerAtSeconds,
      segmentIndex: supplyEmergency.triggerSegmentIndex,
      cause: supplyEmergency.threshold?.cause ?? null,
      distanceKilometers:
        supplyEmergency.triggerRouteDistanceKilometers,
      supplyEmergencyDoctrine: supplyEmergency.doctrine,
      supplyEmergencyActivity:
        supplyEmergency.triggerActivity ?? undefined,
      remainingFraction:
        supplyEmergency.threshold?.remainingFraction ?? undefined,
      returnDistanceKilometers:
        supplyEmergency.returnDistanceKilometers ?? undefined,
      order: 11,
    });
  }

  if (dangerDetection?.detection) {
    const detection = dangerDetection.detection;
    events.push({
      id: `danger-detected-${detection.monsterId}`,
      kind: "danger-detected",
      atSeconds: detection.expeditionElapsedSeconds,
      segmentIndex: detection.segmentIndex,
      cause: null,
      distanceKilometers: detection.routeDistanceKilometers,
      monsterId: detection.monsterId,
      monsterPower: detection.monsterPower,
      separationMeters: detection.separationMeters,
      detectionRadiusMeters: detection.detectionRadiusMeters,
      interactionRadiusMeters: detection.interactionRadiusMeters,
      dangerContactOrder: detection.contactOrder,
      secondsUntilContact: detection.secondsUntilContact,
      caravanActivity: detection.caravanActivity,
      order: detection.contactOrder === "at-contact" ? 19 : 17,
    });
  }

  if (
    dangerAvoidance?.decisionAtSeconds !== null &&
    dangerAvoidance?.decisionAtSeconds !== undefined &&
    (dangerAvoidance.planStatus === "continued" ||
      dangerAvoidance.planStatus === "avoided")
  ) {
    const detection = dangerAvoidance.detection;
    events.push({
      id: `danger-doctrine-${dangerAvoidance.doctrine.toLowerCase()}`,
      kind: "danger-doctrine-decision",
      atSeconds: dangerAvoidance.decisionAtSeconds,
      segmentIndex: dangerAvoidance.decisionSegmentIndex,
      cause: null,
      distanceKilometers:
        dangerAvoidance.decisionRouteDistanceKilometers,
      monsterId: detection?.monsterId,
      monsterPower: detection?.monsterPower,
      separationMeters: detection?.separationMeters,
      detectionRadiusMeters: detection?.detectionRadiusMeters,
      interactionRadiusMeters: detection?.interactionRadiusMeters,
      dangerAvoidanceDoctrine: dangerAvoidance.doctrine,
      dangerAvoidanceSide: dangerAvoidance.detourSide,
      detourAddedDistanceKilometers:
        dangerAvoidance.addedDistanceKilometers,
      caravanActivity: detection?.caravanActivity,
      order: 18,
    });
  }

  if (outcome?.monsterContact && outcome.monsterContactResolution) {
    events.push({
      id: `monster-contact-${outcome.monsterContact.monsterId}`,
      kind: "monster-contact",
      atSeconds: outcome.monsterContact.expeditionElapsedSeconds,
      segmentIndex: outcome.monsterContact.segmentIndex,
      cause: null,
      distanceKilometers: outcome.monsterContact.routeDistanceKilometers,
      monsterId: outcome.monsterContact.monsterId,
      monsterPower: outcome.monsterContact.monsterPower,
      separationMeters: outcome.monsterContact.separationMeters,
      playerPower: outcome.monsterContactResolution.playerPower,
      powerDelta: outcome.monsterContactResolution.powerDelta,
      powerResolutionStatus: outcome.monsterContactResolution.status,
      contactDoctrine: outcome.monsterContactResolution.doctrine,
      monsterSpeedMetersPerSecond:
        outcome.monsterContact.monsterSpeedMetersPerSecond,
      fleeSpeedMetersPerSecond:
        outcome.monsterContactResolution.fleeResolution
          ?.caravanSpeedMetersPerSecond,
      safeSeparationMeters:
        outcome.monsterContactResolution.fleeResolution
          ?.safeSeparationMeters,
      relativeSpeedMetersPerSecond:
        outcome.monsterContactResolution.fleeResolution
          ?.relativeSpeedMetersPerSecond,
      secondsToSafeSeparation:
        outcome.monsterContactResolution.fleeResolution
          ?.secondsToSafeSeparation,
      caravanActivity: outcome.monsterContact.caravanActivity,
      order: 18,
    });
  }

  if (
    firstDepletion.atSeconds !== null &&
    firstDepletion.atSeconds <=
      expeditionDurationSeconds + EVENT_TIME_EPSILON_SECONDS
  ) {
    const depletionPosition = positionAtTime(
      route.authoritativeRoute,
      firstDepletion.routeAtSeconds ?? firstDepletion.atSeconds,
    );
    events.push({
      id: "supplies-depleted",
      kind: "supplies-depleted",
      atSeconds: firstDepletion.atSeconds,
      segmentIndex: depletionPosition.segmentIndex,
      cause: firstDepletion.cause,
      failureActivity: firstDepletion.activity,
      distanceKilometers:
        depletionPosition.traveledDistanceMeters / 1_000,
      order: 30,
    });
  }

  if (outcome?.destinationCity) {
    if (outcome.cityArrival) {
      events.push({
        id: `arrival-${outcome.destinationCity.id}`,
        kind: "arrival",
        atSeconds: routeToExpeditionTime(outcome.cityArrival.atSeconds),
        segmentIndex: outcome.cityArrival.segmentIndex,
        cause: null,
        distanceKilometers: outcome.cityArrival.routeDistanceKilometers,
        cityId: outcome.destinationCity.id,
        cityName: outcome.destinationCity.name,
        cityRadiusMeters: outcome.cityArrivalRadiusMeters ?? undefined,
        distanceToCityMeters: outcome.cityArrival.distanceToCityMeters,
        arrivalKind: outcome.cityArrival.kind,
        order: 40,
      });
    } else {
      events.push({
        id: "route-ended-outside-city",
        kind: "route-ended",
        atSeconds: expeditionDurationSeconds,
        segmentIndex: null,
        cause: null,
        distanceKilometers: route.totalDistanceKilometers,
        cityId: outcome.destinationCity.id,
        cityName: outcome.destinationCity.name,
        cityRadiusMeters: outcome.cityArrivalRadiusMeters ?? undefined,
        distanceToCityMeters: greatCircleDistance(
          route.authoritativeRoute.end,
          outcome.destinationCity.position,
          route.authoritativeRoute.planetRadiusMeters,
        ),
        order: 40,
      });
    }
  } else {
    events.push({
      id: "arrival",
      kind: "arrival",
      atSeconds: expeditionDurationSeconds,
      segmentIndex: null,
      cause: null,
      distanceKilometers: route.totalDistanceKilometers,
      order: 40,
    });
  }
  const legacyStopAtSeconds =
    outcome === null && doctrine?.status === "stopped" && resume === null
      ? doctrine.decision?.decidedAtSeconds ?? null
      : null;
  const boundaryAtSeconds = outcome?.planned.atSeconds ?? legacyStopAtSeconds;
  const boundaryStatus = outcome?.planned.status ??
    (legacyStopAtSeconds === null ? null : "paused");
  const executionEvents =
    boundaryAtSeconds === null
      ? events
      : events.filter(
          (event) =>
            event.atSeconds <=
              boundaryAtSeconds + EVENT_TIME_EPSILON_SECONDS &&
            !(
              boundaryStatus === "failed" &&
              (event.kind === "arrival" ||
                event.kind === "route-ended" ||
                event.kind === "search-missed")
            ),
        );
  executionEvents.sort(
    (left, right) =>
      left.atSeconds - right.atSeconds ||
      left.order - right.order ||
      left.id.localeCompare(right.id),
  );

  const evaluatedAtSeconds = Math.min(
    outcome?.evaluatedAtSeconds ?? route.position.elapsedSeconds,
    expeditionDurationSeconds,
  );
  let activeEventIndex = -1;
  for (let index = 0; index < executionEvents.length; index += 1) {
    const event = executionEvents[index];
    if (
      event &&
      event.atSeconds <= evaluatedAtSeconds + EVENT_TIME_EPSILON_SECONDS
    ) {
      activeEventIndex = index;
    }
  }

  const presentedEvents = executionEvents.map((event, index) => ({
    id: event.id,
    kind: event.kind,
    atSeconds: event.atSeconds,
    segmentIndex: event.segmentIndex,
    cause: event.cause,
    objectId: event.objectId ?? null,
    objectKind: event.objectKind ?? null,
    doctrine: event.doctrine ?? null,
    monsterId: event.monsterId ?? null,
    monsterPower: event.monsterPower ?? null,
    separationMeters: event.separationMeters ?? null,
    detectionRadiusMeters: event.detectionRadiusMeters ?? null,
    interactionRadiusMeters: event.interactionRadiusMeters ?? null,
    dangerContactOrder: event.dangerContactOrder ?? null,
    secondsUntilContact: event.secondsUntilContact ?? null,
    dangerAvoidanceDoctrine: event.dangerAvoidanceDoctrine ?? null,
    dangerAvoidanceSide: event.dangerAvoidanceSide ?? null,
    detourAddedDistanceKilometers:
      event.detourAddedDistanceKilometers ?? null,
    playerPower: event.playerPower ?? null,
    powerDelta: event.powerDelta ?? null,
    powerResolutionStatus: event.powerResolutionStatus ?? null,
    contactDoctrine: event.contactDoctrine ?? null,
    monsterSpeedMetersPerSecond:
      event.monsterSpeedMetersPerSecond ?? null,
    fleeSpeedMetersPerSecond: event.fleeSpeedMetersPerSecond ?? null,
    safeSeparationMeters: event.safeSeparationMeters ?? null,
    relativeSpeedMetersPerSecond:
      event.relativeSpeedMetersPerSecond ?? null,
    secondsToSafeSeparation: event.secondsToSafeSeparation ?? null,
    caravanActivity: event.caravanActivity ?? null,
    resumeReason: event.resumeReason ?? null,
    cityId: event.cityId ?? null,
    cityName: event.cityName ?? null,
    cityRadiusMeters: event.cityRadiusMeters ?? null,
    distanceToCityMeters: event.distanceToCityMeters ?? null,
    arrivalKind: event.arrivalKind ?? null,
    idleDurationSeconds: event.idleDurationSeconds ?? null,
    failureActivity: event.failureActivity ?? null,
    supplyEmergencyDoctrine: event.supplyEmergencyDoctrine ?? null,
    supplyEmergencyActivity: event.supplyEmergencyActivity ?? null,
    remainingFraction: event.remainingFraction ?? null,
    returnDistanceKilometers: event.returnDistanceKilometers ?? null,
    distanceKilometers: event.distanceKilometers,
    occurred: index <= activeEventIndex,
    active: index === activeEventIndex,
  }));

  return {
    evaluatedAtSeconds,
    executionStatus:
      outcome === null
        ? legacyStopAtSeconds === null
          ? "running"
          : "stopped"
        : outcome.status === "in-progress"
          ? "running"
          : outcome.status,
    occurredCount: activeEventIndex + 1,
    totalCount: presentedEvents.length,
    nextEventId: presentedEvents[activeEventIndex + 1]?.id ?? null,
    events: presentedEvents,
  };
}

/**
 * @param {PlannedExpeditionEvent[]} events
 * @param {ReturnType<typeof createRumorSearchSnapshot> | null} rumorSearch
 * @param {ReturnType<typeof createDiscoveryDoctrineSnapshot> | null} doctrine
 * @param {ReturnType<typeof createDiscoveryResumeSnapshot> | null} resume
 * @param {number} routeDurationSeconds
 * @param {ReturnType<typeof createDiscoveryStopLifecycleSnapshot> | null} stopLifecycle
 * @param {ReturnType<typeof createExpeditionOutcomeSnapshot> | null} outcome
 * @param {ReturnType<typeof createEmergencySupplyDoctrineSnapshot> | null} supplyEmergency
 * @param {ReturnType<typeof createDangerAvoidanceDoctrineSnapshot> | null} dangerAvoidance
 */
function addRumorSearchEvent(
  events,
  rumorSearch,
  doctrine,
  resume,
  routeDurationSeconds,
  stopLifecycle,
  outcome,
  supplyEmergency,
  dangerAvoidance,
) {
  if (!rumorSearch) return;

  if (rumorSearch.status === "found" && rumorSearch.discovery) {
    events.push({
      id:
        rumorSearch.targetKnowledge === "known"
          ? "rumor-target-reobserved"
          : "rumor-target-discovered",
      kind:
        rumorSearch.targetKnowledge === "known"
          ? "known-target-observed"
          : "target-discovered",
      atSeconds: rumorSearch.discovery.atSeconds,
      segmentIndex: rumorSearch.discovery.segmentIndex,
      cause: null,
      distanceKilometers: rumorSearch.discovery.routeDistanceKilometers,
      objectKind: rumorSearch.rumor.targetKind,
      objectId: rumorSearch.serverTruth.target.id,
      order: 15,
    });

    if (doctrine?.decision) {
      events.push({
        id:
          doctrine.decision.doctrine === "STOP"
            ? "doctrine-stop"
            : "doctrine-mark-and-continue",
        kind: "doctrine-decision",
        atSeconds: doctrine.decision.decidedAtSeconds,
        segmentIndex: doctrine.decision.segmentIndex,
        cause: null,
        distanceKilometers: doctrine.decision.routeDistanceKilometers,
        objectKind: doctrine.decision.objectKind,
        doctrine: doctrine.decision.doctrine,
        order: 16,
      });
    }
    const resumeAtSeconds = stopLifecycle?.resumeAtSeconds ??
      resume?.resumeDecision.resumedAtSeconds ?? null;
    const resumeExecutes =
      resumeAtSeconds !== null &&
      !(
        stopLifecycle?.planned.status === "failed" &&
        stopLifecycle.planned.atSeconds <=
          resumeAtSeconds + EVENT_TIME_EPSILON_SECONDS
    );
    if (resume?.resumeDecision && resumeExecutes && resumeAtSeconds !== null) {
      const contactResume = Boolean(outcome?.stopInterruptedByContact);
      const supplyEmergencyResume = Boolean(
        outcome?.stopInterruptedBySupplyEmergency &&
        supplyEmergency?.triggerAtSeconds !== null &&
        supplyEmergency?.triggerAtSeconds !== undefined &&
        Math.abs(resumeAtSeconds - supplyEmergency.triggerAtSeconds) <=
          EVENT_TIME_EPSILON_SECONDS,
      );
      const dangerAvoidanceResume = Boolean(
        outcome?.stopInterruptedByDangerAvoidance &&
        dangerAvoidance?.decisionAtSeconds !== null &&
        dangerAvoidance?.decisionAtSeconds !== undefined &&
        Math.abs(resumeAtSeconds - dangerAvoidance.decisionAtSeconds) <=
          EVENT_TIME_EPSILON_SECONDS,
      );
      events.push({
        id: "discovery-route-resumed",
        kind: "route-resumed",
        atSeconds: resumeAtSeconds,
        segmentIndex: resume.resumeDecision.segmentIndex,
        cause: null,
        distanceKilometers:
          resume.resumeDecision.routeDistanceKilometers,
        objectId: resume.resumeDecision.objectId,
        objectKind: resume.resumeDecision.objectKind,
        idleDurationSeconds: stopLifecycle?.idleDurationSeconds ?? 0,
        resumeReason: contactResume
          ? "monster-contact"
          : supplyEmergencyResume
            ? "supply-emergency"
            : dangerAvoidanceResume
              ? "danger-avoidance"
            : "scheduled",
        order:
          contactResume || dangerAvoidanceResume
            ? 19
            : supplyEmergencyResume
              ? 18
              : 17,
      });
    }
    return;
  }

  if (rumorSearch.status === "missed") {
    events.push({
      id: "rumor-search-missed",
      kind: "search-missed",
      atSeconds: routeDurationSeconds,
      segmentIndex: null,
      cause: null,
      distanceKilometers: null,
      objectKind: rumorSearch.rumor.targetKind,
      order: 35,
    });
  }
}

/**
 * @param {PlannedExpeditionEvent[]} events
 * @param {SupplyStock} initialSupplies
 * @param {ConsumptionProfile} consumptionProfile
 * @param {number | null} firstDepletionAtSeconds
 * @param {number} routeDurationSeconds
 * @param {ReturnType<typeof createDiscoveryStopLifecycleSnapshot> | null} stopLifecycle
 */
function addLowSupplyEvents(
  events,
  initialSupplies,
  consumptionProfile,
  firstDepletionAtSeconds,
  routeDurationSeconds,
  stopLifecycle,
) {
  const foodAtSeconds = stopLifecycle
    ? lowSupplyAtSecondsAcrossStop(
        initialSupplies.foodUnits,
        consumptionProfile.moving.foodUnitsPerHour,
        consumptionProfile.idle.foodUnitsPerHour,
        stopLifecycle.stopAtRouteSeconds,
        stopLifecycle.idleDurationSeconds,
      )
    : lowSupplyAtSeconds(
    initialSupplies.foodUnits,
    consumptionProfile.moving.foodUnitsPerHour,
  );
  const waterAtSeconds = stopLifecycle
    ? lowSupplyAtSecondsAcrossStop(
        initialSupplies.waterUnits,
        consumptionProfile.moving.waterUnitsPerHour,
        consumptionProfile.idle.waterUnitsPerHour,
        stopLifecycle.stopAtRouteSeconds,
        stopLifecycle.idleDurationSeconds,
      )
    : lowSupplyAtSeconds(
    initialSupplies.waterUnits,
    consumptionProfile.moving.waterUnitsPerHour,
  );
  const warningLimit = Math.min(
    routeDurationSeconds,
    firstDepletionAtSeconds ?? Number.POSITIVE_INFINITY,
  );
  const foodIsRelevant = isRelevantWarning(foodAtSeconds, warningLimit);
  const waterIsRelevant = isRelevantWarning(waterAtSeconds, warningLimit);

  if (
    foodIsRelevant &&
    waterIsRelevant &&
    foodAtSeconds !== null &&
    waterAtSeconds !== null &&
    Math.abs(foodAtSeconds - waterAtSeconds) <= EVENT_TIME_EPSILON_SECONDS
  ) {
    events.push(lowSupplyEvent("both", foodAtSeconds));
    return;
  }

  if (foodIsRelevant && foodAtSeconds !== null) {
    events.push(lowSupplyEvent("food", foodAtSeconds));
  }
  if (waterIsRelevant && waterAtSeconds !== null) {
    events.push(lowSupplyEvent("water", waterAtSeconds));
  }
}

/** @param {number | null} atSeconds @param {number} warningLimit */
function isRelevantWarning(atSeconds, warningLimit) {
  return (
    atSeconds !== null &&
    atSeconds > EVENT_TIME_EPSILON_SECONDS &&
    atSeconds <= warningLimit + EVENT_TIME_EPSILON_SECONDS
  );
}

/** @param {"food" | "water" | "both"} cause @param {number} atSeconds */
function lowSupplyEvent(cause, atSeconds) {
  return {
    id: `supplies-low-${cause}`,
    kind: /** @type {const} */ ("supplies-low"),
    atSeconds,
    segmentIndex: null,
    cause,
    distanceKilometers: null,
    order: 10,
  };
}

/** @param {number} stock @param {number} ratePerHour */
function lowSupplyAtSeconds(stock, ratePerHour) {
  if (stock === 0 || ratePerHour === 0) return null;
  return (stock * (1 - LOW_SUPPLY_FRACTION) * 3_600) / ratePerHour;
}

/**
 * @param {number} stock
 * @param {number} movingRatePerHour
 * @param {number} idleRatePerHour
 * @param {number} stopAtSeconds
 * @param {number} idleDurationSeconds
 */
function lowSupplyAtSecondsAcrossStop(
  stock,
  movingRatePerHour,
  idleRatePerHour,
  stopAtSeconds,
  idleDurationSeconds,
) {
  if (stock === 0) return null;
  let remainingConsumption = stock * (1 - LOW_SUPPLY_FRACTION);
  const preStopConsumption =
    movingRatePerHour * (stopAtSeconds / 3_600);
  if (
    movingRatePerHour > 0 &&
    remainingConsumption <= preStopConsumption + EVENT_TIME_EPSILON_SECONDS
  ) {
    return (remainingConsumption * 3_600) / movingRatePerHour;
  }
  remainingConsumption -= preStopConsumption;

  const idleConsumption =
    idleRatePerHour * (idleDurationSeconds / 3_600);
  if (
    idleRatePerHour > 0 &&
    remainingConsumption <= idleConsumption + EVENT_TIME_EPSILON_SECONDS
  ) {
    return stopAtSeconds +
      (Math.max(0, remainingConsumption) * 3_600) / idleRatePerHour;
  }
  remainingConsumption -= idleConsumption;
  if (movingRatePerHour === 0) return null;
  return stopAtSeconds + idleDurationSeconds +
    (Math.max(0, remainingConsumption) * 3_600) / movingRatePerHour;
}

/**
 * Equirectangular projection does not preserve great-circle legs as straight
 * lines. Sampling the authoritative destination-point function keeps long UI
 * routes visibly spherical while bounding the amount of SVG data.
 * @param {ReturnType<typeof createRoutePlan>} route
 * @returns {WorldCoordinate[]}
 */
function sampleRouteCoordinates(
  route,
  targetMeters = ROUTE_SAMPLE_TARGET_METERS,
  maximumSamplesPerSegment = MAX_ROUTE_SAMPLES_PER_SEGMENT,
) {
  /** @type {WorldCoordinate[]} */
  const coordinates = [route.start];

  for (const segment of route.segments) {
    const sampleCount = Math.min(
      maximumSamplesPerSegment,
      Math.max(1, Math.ceil(segment.distanceMeters / targetMeters)),
    );
    for (let sampleIndex = 1; sampleIndex <= sampleCount; sampleIndex += 1) {
      const distanceMeters =
        (segment.distanceMeters * sampleIndex) / sampleCount;
      coordinates.push(
        destinationPoint(
          segment.start,
          segment.bearingDeg,
          distanceMeters,
          route.planetRadiusMeters,
        ),
      );
    }
  }

  return coordinates;
}

/** @param {import("../sim-core/dist/src/index.js").SearchRumor} rumor */
function rumorClueAreaPoints(rumor) {
  const outer = sampleBearingArc(
    rumor.bearingSector.minimumBearingDeg,
    rumor.bearingSector.maximumBearingDeg,
    rumor.distanceRange.maximumMeters,
  );
  const inner = sampleBearingArc(
    rumor.bearingSector.maximumBearingDeg,
    rumor.bearingSector.minimumBearingDeg,
    rumor.distanceRange.minimumMeters,
  );
  return [...outer, ...inner];
}

/**
 * @param {number} startBearingDeg
 * @param {number} endBearingDeg
 * @param {number} distanceMeters
 */
function sampleBearingArc(startBearingDeg, endBearingDeg, distanceMeters) {
  return Array.from({ length: RUMOR_SECTOR_SAMPLE_COUNT + 1 }, (_, index) => {
    const progress = index / RUMOR_SECTOR_SAMPLE_COUNT;
    return localPointFromBearingDistance(
      startBearingDeg + (endBearingDeg - startBearingDeg) * progress,
      distanceMeters,
    );
  });
}

/** @param {number} bearingDeg @param {number} distanceMeters */
function localPointFromBearingDistance(bearingDeg, distanceMeters) {
  const bearingRadians = (bearingDeg * Math.PI) / 180;
  const radiusPixels = distanceMeters * RUMOR_MAP_PIXELS_PER_METER;
  return {
    x: RUMOR_MAP_ORIGIN.x + Math.sin(bearingRadians) * radiusPixels,
    y: RUMOR_MAP_ORIGIN.y - Math.cos(bearingRadians) * radiusPixels,
  };
}

/**
 * Local north-up approximation around the rumor city. The 50 km clue is tiny
 * relative to the planet, so an equirectangular tangent projection is stable
 * and intentionally omits absolute coordinates.
 * @param {WorldCoordinate} origin
 * @param {WorldCoordinate} coordinate
 * @param {number} planetRadiusMeters
 */
function projectLocalCoordinate(origin, coordinate, planetRadiusMeters) {
  const degreesToRadians = Math.PI / 180;
  let longitudeDelta = coordinate.longitudeDeg - origin.longitudeDeg;
  if (longitudeDelta > 180) longitudeDelta -= 360;
  if (longitudeDelta < -180) longitudeDelta += 360;
  const eastMeters =
    longitudeDelta *
    degreesToRadians *
    planetRadiusMeters *
    Math.cos(origin.latitudeDeg * degreesToRadians);
  const northMeters =
    (coordinate.latitudeDeg - origin.latitudeDeg) *
    degreesToRadians *
    planetRadiusMeters;
  return {
    x: RUMOR_MAP_ORIGIN.x + eastMeters * RUMOR_MAP_PIXELS_PER_METER,
    y: RUMOR_MAP_ORIGIN.y - northMeters * RUMOR_MAP_PIXELS_PER_METER,
  };
}

/** @param {WorldCoordinate} start @param {WorldCoordinate} end */
function initialBearingDegrees(start, end) {
  const degreesToRadians = Math.PI / 180;
  const latitudeStart = start.latitudeDeg * degreesToRadians;
  const latitudeEnd = end.latitudeDeg * degreesToRadians;
  const longitudeDelta =
    (end.longitudeDeg - start.longitudeDeg) * degreesToRadians;
  const y = Math.sin(longitudeDelta) * Math.cos(latitudeEnd);
  const x =
    Math.cos(latitudeStart) * Math.sin(latitudeEnd) -
    Math.sin(latitudeStart) *
      Math.cos(latitudeEnd) *
      Math.cos(longitudeDelta);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/**
 * @param {WorldCoordinate} center
 * @param {WorldCoordinate} coordinate
 * @param {number} planetRadiusMeters
 * @param {number} metersPerPixel
 */
function projectContactZoomCoordinate(
  center,
  coordinate,
  planetRadiusMeters,
  metersPerPixel,
) {
  const distanceMeters = greatCircleDistance(
    center,
    coordinate,
    planetRadiusMeters,
  );
  const bearingRadians =
    (initialBearingDegrees(center, coordinate) * Math.PI) / 180;
  const distancePixels = distanceMeters / metersPerPixel;
  return {
    x:
      CONTACT_ZOOM_WIDTH / 2 +
      Math.sin(bearingRadians) * distancePixels,
    y:
      CONTACT_ZOOM_HEIGHT / 2 -
      Math.cos(bearingRadians) * distancePixels,
  };
}

/**
 * @param {number} startSeconds
 * @param {number} endSeconds
 * @param {number} sampleCount
 */
function sampleTimeRange(startSeconds, endSeconds, sampleCount) {
  if (startSeconds === endSeconds) return [startSeconds];
  return Array.from({ length: sampleCount + 1 }, (_, index) =>
    startSeconds + ((endSeconds - startSeconds) * index) / sampleCount,
  );
}

/**
 * @param {number} latitudeDeg
 * @param {number} longitudeDeg
 * @returns {ProjectedPoint}
 */
function projectDegrees(latitudeDeg, longitudeDeg) {
  if (!Number.isFinite(latitudeDeg) || latitudeDeg < -90 || latitudeDeg > 90) {
    throw new RangeError("latitudeDeg must be finite and between -90 and 90");
  }
  if (
    !Number.isFinite(longitudeDeg) ||
    longitudeDeg < -180 ||
    longitudeDeg > 180
  ) {
    throw new RangeError("longitudeDeg must be finite and between -180 and 180");
  }

  return {
    x: ((longitudeDeg + 180) / 360) * DEBUG_MAP_WIDTH,
    y: ((90 - latitudeDeg) / 180) * DEBUG_MAP_HEIGHT,
  };
}

/** @param {number} value @param {string} name */
function assertNonNegativeFinite(value, name) {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative finite number`);
  }
}

/** @param {number} value @param {string} name */
function assertPositiveFinite(value, name) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive finite number`);
  }
}

/** @param {number} remaining @param {number} initial */
function remainingFraction(remaining, initial) {
  return initial === 0 ? 0 : remaining / initial;
}
