// @ts-check

import {
  createRoutePlan,
  destinationPoint,
  generateSeededWorld,
  kilometers,
  positionAtTime,
  wanderingMonsterPositionAtTime,
} from "../sim-core/dist/src/index.js";

/** @typedef {import("../sim-core/dist/src/index.js").WorldCoordinate} WorldCoordinate */

/**
 * @typedef {object} DebugRouteCommand
 * @property {number} bearingDeg
 * @property {number} distanceKilometers
 */

export const DEBUG_MAP_WIDTH = 1_000;
export const DEBUG_MAP_HEIGHT = 500;
const ROUTE_SAMPLE_TARGET_METERS = 100_000;
const MAX_ROUTE_SAMPLES_PER_SEGMENT = 64;

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
