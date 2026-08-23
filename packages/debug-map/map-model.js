// @ts-check

import {
  DEFAULT_CITY_ARRIVAL_RADIUS_METERS,
  DEFAULT_CONCEALED_DISCOVERY_RADIUS_METERS,
  DEFAULT_FLEE_SAFE_SEPARATION_MULTIPLIER,
  DEFAULT_PLAYER_POWER,
  canSurviveDuration,
  createRoutePlan,
  createRumorSearchScenario,
  destinationPoint,
  discoverStaticObjectsAlongRoute,
  evaluateExpeditionOutcome,
  evaluateStaticObjectDiscoveryDoctrine,
  findFirstCityArrival,
  findFirstExpeditionMonsterContact,
  generateSeededWorld,
  greatCircleDistance,
  kilometers,
  positionAtTime,
  projectSupplies,
  resolveMonsterPowerContact,
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
 * @typedef {"departure" | "segment-completed" | "supplies-low" | "supplies-depleted" | "target-discovered" | "doctrine-decision" | "monster-contact" | "search-missed" | "route-ended" | "arrival"} ExpeditionEventKind
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
 * @property {import("../sim-core/dist/src/index.js").StaticObjectDiscoveryDoctrine} [doctrine]
 * @property {string} [monsterId]
 * @property {number} [monsterPower]
 * @property {number} [separationMeters]
 * @property {number} [playerPower]
 * @property {number} [powerDelta]
 * @property {import("../sim-core/dist/src/index.js").PowerContactResolutionStatus} [powerResolutionStatus]
 * @property {import("../sim-core/dist/src/index.js").StrongMonsterContactDoctrine | null} [contactDoctrine]
 * @property {number} [monsterSpeedMetersPerSecond]
 * @property {number} [fleeSpeedMetersPerSecond]
 * @property {number} [safeSeparationMeters]
 * @property {number} [relativeSpeedMetersPerSecond]
 * @property {number | null} [secondsToSafeSeparation]
 * @property {string} [cityId]
 * @property {string} [cityName]
 * @property {number} [cityRadiusMeters]
 * @property {number} [distanceToCityMeters]
 * @property {import("../sim-core/dist/src/index.js").CityArrivalKind} [arrivalKind]
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

  return {
    seed: world.seed,
    elapsedSeconds,
    cities: world.cities.map((city) => ({
      id: city.id,
      name: city.name,
      position: city.position,
      point: projectCoordinate(city.position),
    })),
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
 * GAME-004 exposes the first finite-caravan/cyclic-patrol SIM-008 contact to
 * the browser without moving encounter authority into the UI.
 * @param {ReturnType<typeof createFourSegmentRouteSnapshot>} route
 * @param {ReturnType<typeof createDebugMapSnapshot>["monsters"][number]} monster
 */
export function createMonsterContactSnapshot(route, monster) {
  const contact = findFirstExpeditionMonsterContact(
    route.authoritativeRoute,
    monster.authoritativeMonster,
  );

  if (!contact) {
    return {
      status: /** @type {const} */ ("clear"),
      evaluatedAtSeconds: Math.min(
        route.position.elapsedSeconds,
        route.totalDurationSeconds,
      ),
      contact: null,
    };
  }

  const routePosition = positionAtTime(
    route.authoritativeRoute,
    contact.expeditionElapsedSeconds,
  );
  const evaluatedAtSeconds = Math.min(
    route.position.elapsedSeconds,
    route.totalDurationSeconds,
  );

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
  const evaluated = positionAtTime(route, elapsedSeconds);
  const coordinates = sampleRouteCoordinates(route);

  return {
    start: route.start,
    end: route.end,
    speedKilometersPerHour,
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
 */
export function createRumorSearchSnapshot(seed, originCity, route) {
  const scenario = createRumorSearchScenario(seed, originCity);
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
  const evaluation = evaluateStaticObjectDiscoveryDoctrine(
    rumorSearch.serverTruth.plannedDiscovery,
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
 * GAME-006/007 composes route ETA, supplies, discovery STOP and the first moving
 * contact with Power plus an explicit movement-based FLEE resolution. A weak
 * monster is defeated automatically; against a stronger monster a strictly
 * faster caravan escapes and continues, while an equal/slower caravan fails.
 * @param {ReturnType<typeof createFourSegmentRouteSnapshot>} route
 * @param {SupplyStock} initialSupplies
 * @param {ConsumptionProfile} consumptionProfile
 * @param {ReturnType<typeof createDiscoveryDoctrineSnapshot> | null} [doctrine]
 * @param {ReturnType<typeof createMonsterContactSnapshot> | null} [monsterContact]
 * @param {import("../sim-core/dist/src/index.js").StrongMonsterContactDoctrine} [strongMonsterDoctrine]
 * @param {number} [fleeSpeedMetersPerSecond]
 * @param {ReturnType<typeof createCityArrivalSnapshot> | null} [cityDestination]
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
  const baselineEvaluation = evaluateExpeditionOutcome(
    route.authoritativeRoute,
    initialSupplies,
    consumptionProfile,
    route.position.elapsedSeconds,
    doctrinePauseAtSeconds,
    completionAtSeconds,
  );
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
  const contactExecutes =
    monsterPauseAtSeconds !== null &&
    monsterPauseAtSeconds <
      route.totalDurationSeconds - EVENT_TIME_EPSILON_SECONDS &&
    (monsterPauseAtSeconds <
      baselineEvaluation.planned.atSeconds - EVENT_TIME_EPSILON_SECONDS ||
      (Math.abs(
        monsterPauseAtSeconds - baselineEvaluation.planned.atSeconds,
      ) <= EVENT_TIME_EPSILON_SECONDS &&
        baselineEvaluation.planned.status === "paused"));
  const contactDisposition = contactExecutes
    ? contactResolution?.routeDisposition ?? null
    : null;

  let evaluation = baselineEvaluation;
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

  if (contactDisposition === "pause" && monsterPauseAtSeconds !== null) {
    evaluation = evaluateExpeditionOutcome(
      route.authoritativeRoute,
      initialSupplies,
      consumptionProfile,
      route.position.elapsedSeconds,
      monsterPauseAtSeconds,
      completionAtSeconds,
    );
    interruptionCause = /** @type {const} */ ("monster-contact");
  } else if (contactDisposition === "fail" && monsterPauseAtSeconds !== null) {
    const occurred =
      route.position.elapsedSeconds + EVENT_TIME_EPSILON_SECONDS >=
      monsterPauseAtSeconds;
    /** @type {"failed" | "in-progress"} */
    const contactStatus = occurred ? "failed" : "in-progress";
    evaluation = {
      status: contactStatus,
      evaluatedAtSeconds: route.position.elapsedSeconds,
      movementElapsedSeconds: occurred
        ? monsterPauseAtSeconds
        : route.position.elapsedSeconds,
      planned: {
        status: /** @type {const} */ ("failed"),
        atSeconds: monsterPauseAtSeconds,
        failureCause: null,
      },
      endedAtSeconds: occurred ? monsterPauseAtSeconds : null,
      failureCause: null,
      terminal: occurred,
    };
    interruptionCause = /** @type {const} */ ("monster-defeat");
  }
  const boundaryPosition = positionAtTime(
    route.authoritativeRoute,
    evaluation.planned.atSeconds,
  );

  return {
    ...evaluation,
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
 * @param {ReturnType<typeof createDiscoveryDoctrineSnapshot> | null} [doctrine]
 * @param {ReturnType<typeof createExpeditionOutcomeSnapshot> | null} [outcome]
 */
export function createCaravanStatusSnapshot(
  route,
  initialSupplies,
  consumptionProfile,
  doctrine = null,
  outcome = null,
) {
  const expeditionDurationSeconds =
    outcome?.cityArrival?.atSeconds ?? route.totalDurationSeconds;
  const expeditionDistanceMeters =
    (outcome?.cityArrival?.routeDistanceKilometers ??
      route.totalDistanceKilometers) * 1_000;
  const evaluatedAtSeconds = Math.min(
    route.position.elapsedSeconds,
    expeditionDurationSeconds,
  );
  const supplies = projectSupplies(
    initialSupplies,
    consumptionProfile,
    "moving",
    evaluatedAtSeconds,
  );
  const firstDepletion = timeToFirstDepletion(
    initialSupplies,
    consumptionProfile,
    "moving",
  );
  const atArrival = projectSupplies(
    initialSupplies,
    consumptionProfile,
    "moving",
    expeditionDurationSeconds,
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
      segmentIndex: route.position.segmentIndex,
      segmentProgress: route.position.segmentProgress,
      progress: routeProgress,
      elapsedSeconds: route.position.elapsedSeconds,
      evaluatedAtSeconds,
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
      canFinish: canSurviveDuration(
        initialSupplies,
        consumptionProfile,
        "moving",
        expeditionDurationSeconds,
      ),
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
 */
export function createExpeditionEventLogSnapshot(
  route,
  initialSupplies,
  consumptionProfile,
  rumorSearch = null,
  doctrine = null,
  outcome = null,
) {
  const firstDepletion = timeToFirstDepletion(
    initialSupplies,
    consumptionProfile,
    "moving",
  );
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
      atSeconds: segment.etaEndSeconds,
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
    route.totalDurationSeconds,
  );

  addRumorSearchEvent(
    events,
    rumorSearch,
    doctrine,
    route.totalDurationSeconds,
  );

  if (outcome?.monsterContact && outcome.monsterContactResolution) {
    events.push({
      id: `monster-contact-${outcome.monsterContact.monsterId}`,
      kind: "monster-contact",
      atSeconds: outcome.monsterContact.expeditionElapsedSeconds,
      segmentIndex: outcome.planned.segmentIndex,
      cause: null,
      distanceKilometers: outcome.planned.routeDistanceKilometers,
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
      order: 17,
    });
  }

  if (
    firstDepletion.atSeconds !== null &&
    firstDepletion.atSeconds <=
      route.totalDurationSeconds + EVENT_TIME_EPSILON_SECONDS
  ) {
    const depletionPosition = positionAtTime(
      route.authoritativeRoute,
      firstDepletion.atSeconds,
    );
    events.push({
      id: "supplies-depleted",
      kind: "supplies-depleted",
      atSeconds: firstDepletion.atSeconds,
      segmentIndex: depletionPosition.segmentIndex,
      cause: firstDepletion.cause,
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
        atSeconds: outcome.cityArrival.atSeconds,
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
        atSeconds: route.totalDurationSeconds,
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
      atSeconds: route.totalDurationSeconds,
      segmentIndex: null,
      cause: null,
      distanceKilometers: route.totalDistanceKilometers,
      order: 40,
    });
  }
  const legacyStopAtSeconds =
    outcome === null && doctrine?.status === "stopped"
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
    route.position.elapsedSeconds,
    route.totalDurationSeconds,
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
    objectKind: event.objectKind ?? null,
    doctrine: event.doctrine ?? null,
    monsterId: event.monsterId ?? null,
    monsterPower: event.monsterPower ?? null,
    separationMeters: event.separationMeters ?? null,
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
    cityId: event.cityId ?? null,
    cityName: event.cityName ?? null,
    cityRadiusMeters: event.cityRadiusMeters ?? null,
    distanceToCityMeters: event.distanceToCityMeters ?? null,
    arrivalKind: event.arrivalKind ?? null,
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
 * @param {number} routeDurationSeconds
 */
function addRumorSearchEvent(
  events,
  rumorSearch,
  doctrine,
  routeDurationSeconds,
) {
  if (!rumorSearch) return;

  if (rumorSearch.status === "found" && rumorSearch.discovery) {
    events.push({
      id: "rumor-target-discovered",
      kind: "target-discovered",
      atSeconds: rumorSearch.discovery.atSeconds,
      segmentIndex: rumorSearch.discovery.segmentIndex,
      cause: null,
      distanceKilometers: rumorSearch.discovery.routeDistanceKilometers,
      objectKind: rumorSearch.rumor.targetKind,
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
 */
function addLowSupplyEvents(
  events,
  initialSupplies,
  consumptionProfile,
  firstDepletionAtSeconds,
  routeDurationSeconds,
) {
  const foodAtSeconds = lowSupplyAtSeconds(
    initialSupplies.foodUnits,
    consumptionProfile.moving.foodUnitsPerHour,
  );
  const waterAtSeconds = lowSupplyAtSeconds(
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
