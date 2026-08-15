// @ts-check

import {
  canSurviveDuration,
  createRoutePlan,
  destinationPoint,
  generateSeededWorld,
  kilometers,
  positionAtTime,
  projectSupplies,
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
const ROUTE_SAMPLE_TARGET_METERS = 100_000;
const MAX_ROUTE_SAMPLES_PER_SEGMENT = 64;
const LOW_SUPPLY_FRACTION = 0.25;
const EVENT_TIME_EPSILON_SECONDS = 1e-9;

/**
 * @typedef {"departure" | "segment-completed" | "supplies-low" | "supplies-depleted" | "arrival"} ExpeditionEventKind
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
 */
export function createDebugMapSnapshot(seed, elapsedSeconds = 0) {
  assertNonNegativeFinite(elapsedSeconds, "elapsedSeconds");
  const world = generateSeededWorld(seed);

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
      };
    }),
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
  };
}

/**
 * UI-003 combines the authoritative route position and SIM-006 supply model
 * into a presentation snapshot. Consumption stops at route arrival because
 * post-arrival activity is outside this checkpoint's scope.
 * @param {ReturnType<typeof createFourSegmentRouteSnapshot>} route
 * @param {SupplyStock} initialSupplies
 * @param {ConsumptionProfile} consumptionProfile
 */
export function createCaravanStatusSnapshot(
  route,
  initialSupplies,
  consumptionProfile,
) {
  const evaluatedAtSeconds = Math.min(
    route.position.elapsedSeconds,
    route.totalDurationSeconds,
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
    route.totalDurationSeconds,
  );
  const totalDistanceMeters = route.totalDistanceKilometers * 1_000;
  const routeProgress =
    totalDistanceMeters === 0
      ? 1
      : route.position.traveledDistanceMeters / totalDistanceMeters;

  return {
    route: {
      status: route.position.status,
      segmentIndex: route.position.segmentIndex,
      segmentProgress: route.position.segmentProgress,
      progress: routeProgress,
      elapsedSeconds: route.position.elapsedSeconds,
      evaluatedAtSeconds,
      totalDurationSeconds: route.totalDurationSeconds,
      traveledDistanceKilometers:
        route.position.traveledDistanceMeters / 1_000,
      remainingDistanceKilometers:
        route.position.remainingDistanceMeters / 1_000,
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
        route.totalDurationSeconds,
      ),
      firstDepletionAtSeconds: firstDepletion.atSeconds,
      depletionCause: firstDepletion.cause,
      depletionBeforeOrAtArrival:
        firstDepletion.atSeconds !== null &&
        firstDepletion.atSeconds <= route.totalDurationSeconds,
      foodAtArrival: atArrival.foodRemaining,
      waterAtArrival: atArrival.waterRemaining,
    },
  };
}

/**
 * UI-004 builds a deterministic expedition timeline from existing route and
 * supply truth. It describes milestones and forecasts only; it does not apply
 * death, stop movement, or mutate simulation state.
 * @param {ReturnType<typeof createFourSegmentRouteSnapshot>} route
 * @param {SupplyStock} initialSupplies
 * @param {ConsumptionProfile} consumptionProfile
 */
export function createExpeditionEventLogSnapshot(
  route,
  initialSupplies,
  consumptionProfile,
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

  if (
    firstDepletion.atSeconds !== null &&
    firstDepletion.atSeconds <=
      route.totalDurationSeconds + EVENT_TIME_EPSILON_SECONDS
  ) {
    events.push({
      id: "supplies-depleted",
      kind: "supplies-depleted",
      atSeconds: firstDepletion.atSeconds,
      segmentIndex: null,
      cause: firstDepletion.cause,
      distanceKilometers: null,
      order: 30,
    });
  }

  events.push({
    id: "arrival",
    kind: "arrival",
    atSeconds: route.totalDurationSeconds,
    segmentIndex: null,
    cause: null,
    distanceKilometers: route.totalDistanceKilometers,
    order: 40,
  });
  events.sort(
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
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    if (
      event &&
      event.atSeconds <= evaluatedAtSeconds + EVENT_TIME_EPSILON_SECONDS
    ) {
      activeEventIndex = index;
    }
  }

  const presentedEvents = events.map((event, index) => ({
    id: event.id,
    kind: event.kind,
    atSeconds: event.atSeconds,
    segmentIndex: event.segmentIndex,
    cause: event.cause,
    distanceKilometers: event.distanceKilometers,
    occurred: index <= activeEventIndex,
    active: index === activeEventIndex,
  }));

  return {
    evaluatedAtSeconds,
    occurredCount: activeEventIndex + 1,
    totalCount: presentedEvents.length,
    nextEventId: presentedEvents[activeEventIndex + 1]?.id ?? null,
    events: presentedEvents,
  };
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
function sampleRouteCoordinates(route) {
  /** @type {WorldCoordinate[]} */
  const coordinates = [route.start];

  for (const segment of route.segments) {
    const sampleCount = Math.min(
      MAX_ROUTE_SAMPLES_PER_SEGMENT,
      Math.max(1, Math.ceil(segment.distanceMeters / ROUTE_SAMPLE_TARGET_METERS)),
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
