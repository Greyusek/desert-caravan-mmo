import { destinationPoint, greatCircleDistance } from "./geometry.js";
import type { DurationSeconds, ResolvedRouteSegment, RoutePlan } from "./route.js";
import {
  type DistanceMeters,
  type WorldCoordinate,
  normalizeBearing,
} from "./types.js";
import type { StaticWorldObject } from "./world.js";

export const DEFAULT_CONCEALED_DISCOVERY_RADIUS_METERS = 150;

export interface StaticObjectDiscovery {
  readonly object: StaticWorldObject;
  readonly segmentIndex: number;
  readonly routeDistanceMeters: DistanceMeters;
  readonly elapsedSeconds: DurationSeconds;
  readonly caravanPosition: WorldCoordinate;
  readonly distanceToObjectMeters: DistanceMeters;
}

interface IndexedDiscovery {
  readonly inputIndex: number;
  readonly discovery: StaticObjectDiscovery;
}

interface UnitVector {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

const DEG_TO_RAD = Math.PI / 180;
const TWO_PI = 2 * Math.PI;
const ANGULAR_EPSILON = 1e-12;
const DISTANCE_EPSILON_METERS = 1e-7;

/**
 * WORLD-003 / SIM-007 — returns the first real route entry into every
 * static object's concealed-discovery radius.
 *
 * This is an authoritative simulation result, not a player-facing DTO: the
 * returned object still contains its hidden server coordinate.
 */
export function discoverStaticObjectsAlongRoute(
  route: RoutePlan,
  staticObjects: readonly StaticWorldObject[],
  detectionRadiusMeters: DistanceMeters = DEFAULT_CONCEALED_DISCOVERY_RADIUS_METERS,
): readonly StaticObjectDiscovery[] {
  assertDetectionRadius(detectionRadiusMeters);

  const angularRadius = Math.min(
    detectionRadiusMeters / route.planetRadiusMeters,
    Math.PI,
  );
  const discoveries: IndexedDiscovery[] = [];

  staticObjects.forEach((object, inputIndex) => {
    for (const segment of route.segments) {
      const angularDistanceInsideSegment = firstEntryAngularDistance(
        segment,
        object.position,
        angularRadius,
        route.planetRadiusMeters,
      );
      if (angularDistanceInsideSegment === null) continue;

      const distanceInsideSegment = Math.min(
        segment.distanceMeters,
        Math.max(0, angularDistanceInsideSegment * route.planetRadiusMeters),
      );
      const caravanPosition = destinationPoint(
        segment.start,
        segment.bearingDeg,
        distanceInsideSegment,
        route.planetRadiusMeters,
      );

      discoveries.push({
        inputIndex,
        discovery: {
          object,
          segmentIndex: segment.index,
          routeDistanceMeters:
            segment.cumulativeDistanceStartMeters + distanceInsideSegment,
          elapsedSeconds:
            segment.etaStartSeconds + distanceInsideSegment / route.speedMetersPerSecond,
          caravanPosition,
          distanceToObjectMeters: greatCircleDistance(
            caravanPosition,
            object.position,
            route.planetRadiusMeters,
          ),
        },
      });
      break;
    }
  });

  return discoveries
    .sort(
      (first, second) =>
        first.discovery.routeDistanceMeters - second.discovery.routeDistanceMeters ||
        first.inputIndex - second.inputIndex,
    )
    .map(({ discovery }) => discovery);
}

function firstEntryAngularDistance(
  segment: ResolvedRouteSegment,
  objectPosition: WorldCoordinate,
  angularRadius: number,
  planetRadiusMeters: number,
): number | null {
  const startVector = coordinateToUnitVector(segment.start);
  const tangentVector = routeTangentUnitVector(segment.start, segment.bearingDeg);
  const objectVector = coordinateToUnitVector(objectPosition);
  const cosineRadius = Math.cos(angularRadius);
  const startDot = dot(startVector, objectVector);

  const startDistanceMeters = greatCircleDistance(
    segment.start,
    objectPosition,
    planetRadiusMeters,
  );
  if (
    startDistanceMeters <=
    angularRadius * planetRadiusMeters + DISTANCE_EPSILON_METERS
  ) {
    return 0;
  }

  const segmentAngularLength = segment.distanceMeters / planetRadiusMeters;
  if (segmentAngularLength <= ANGULAR_EPSILON) return null;

  // A route point at angular distance t is start*cos(t) + tangent*sin(t).
  // Its dot product with the object is therefore a sinusoid. Solving the
  // threshold interval gives the first radius entry without route sampling.
  const cosineCoefficient = startDot;
  const sineCoefficient = dot(tangentVector, objectVector);
  const amplitude = Math.min(1, Math.hypot(cosineCoefficient, sineCoefficient));
  if (amplitude <= ANGULAR_EPSILON) return null;

  const threshold = cosineRadius / amplitude;
  if (threshold > 1 + ANGULAR_EPSILON) return null;
  if (threshold <= -1) return 0;

  const halfWidth = Math.acos(clamp(threshold, -1, 1));
  const phase = Math.atan2(sineCoefficient, cosineCoefficient);
  let intervalNumber = Math.ceil(-(phase + halfWidth) / TWO_PI);

  while (true) {
    const center = phase + intervalNumber * TWO_PI;
    const intervalStart = center - halfWidth;
    const intervalEnd = center + halfWidth;

    if (intervalStart > segmentAngularLength + ANGULAR_EPSILON) return null;
    if (intervalEnd >= -ANGULAR_EPSILON) {
      return clamp(Math.max(0, intervalStart), 0, segmentAngularLength);
    }

    intervalNumber += 1;
  }
}

function coordinateToUnitVector(coordinate: WorldCoordinate): UnitVector {
  const latitude = coordinate.latitudeDeg * DEG_TO_RAD;
  const longitude = coordinate.longitudeDeg * DEG_TO_RAD;
  const cosineLatitude = Math.cos(latitude);
  return {
    x: cosineLatitude * Math.cos(longitude),
    y: cosineLatitude * Math.sin(longitude),
    z: Math.sin(latitude),
  };
}

function routeTangentUnitVector(
  coordinate: WorldCoordinate,
  bearingDeg: number,
): UnitVector {
  const latitude = coordinate.latitudeDeg * DEG_TO_RAD;
  const longitude = coordinate.longitudeDeg * DEG_TO_RAD;
  const bearing = normalizeBearing(bearingDeg) * DEG_TO_RAD;
  const cosineBearing = Math.cos(bearing);
  const sineBearing = Math.sin(bearing);

  const north = {
    x: -Math.sin(latitude) * Math.cos(longitude),
    y: -Math.sin(latitude) * Math.sin(longitude),
    z: Math.cos(latitude),
  };
  const east = {
    x: -Math.sin(longitude),
    y: Math.cos(longitude),
    z: 0,
  };

  return {
    x: north.x * cosineBearing + east.x * sineBearing,
    y: north.y * cosineBearing + east.y * sineBearing,
    z: north.z * cosineBearing + east.z * sineBearing,
  };
}

function dot(first: UnitVector, second: UnitVector): number {
  return first.x * second.x + first.y * second.y + first.z * second.z;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function assertDetectionRadius(radiusMeters: number): void {
  if (!Number.isFinite(radiusMeters) || radiusMeters < 0) {
    throw new RangeError("detectionRadiusMeters must be a non-negative finite number");
  }
}
