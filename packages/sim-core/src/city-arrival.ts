import { destinationPoint, greatCircleDistance } from "./geometry.js";
import type { DurationSeconds, ResolvedRouteSegment, RoutePlan } from "./route.js";
import {
  type DistanceMeters,
  type WorldCoordinate,
  normalizeBearing,
} from "./types.js";
import type { City } from "./world.js";

/** Technical MVP boundary; city footprint/economy remain outside GAME-007. */
export const DEFAULT_CITY_ARRIVAL_RADIUS_METERS = 500;

export type CityArrivalKind = "entry" | "reentry";

export interface CityArrival {
  readonly city: City;
  readonly radiusMeters: DistanceMeters;
  readonly kind: CityArrivalKind;
  readonly segmentIndex: number;
  readonly routeDistanceMeters: DistanceMeters;
  readonly elapsedSeconds: DurationSeconds;
  readonly caravanPosition: WorldCoordinate;
  readonly distanceToCityMeters: DistanceMeters;
}

interface UnitVector {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

interface AngularInterval {
  readonly start: number;
  readonly end: number;
}

const DEG_TO_RAD = Math.PI / 180;
const TWO_PI = 2 * Math.PI;
const ANGULAR_EPSILON = 1e-12;
const DISTANCE_EPSILON_METERS = 1e-7;

/**
 * GAME-007 — finds the first continuous route entry into a real city's radius.
 *
 * When the expedition starts inside its destination (the normal return-to-origin
 * case), T+0 is deliberately ignored. The route must first leave the radius and
 * then cross it again before an authoritative arrival exists.
 */
export function findFirstCityArrival(
  route: RoutePlan,
  city: City,
  radiusMeters: DistanceMeters = DEFAULT_CITY_ARRIVAL_RADIUS_METERS,
): CityArrival | null {
  assertArrivalRadius(radiusMeters);

  const angularRadius = Math.min(
    radiusMeters / route.planetRadiusMeters,
    Math.PI,
  );
  const startedInside = isInsideRadius(
    route.start,
    city.position,
    radiusMeters,
    route.planetRadiusMeters,
  );
  let hasBeenOutside = !startedInside;

  for (const segment of route.segments) {
    const angularLength = segment.distanceMeters / route.planetRadiusMeters;
    if (angularLength <= ANGULAR_EPSILON) continue;

    const intervals = insideIntervals(
      segment,
      city.position,
      angularRadius,
      angularLength,
    );
    let cursor = 0;

    for (const interval of intervals) {
      if (interval.start > cursor + ANGULAR_EPSILON) {
        hasBeenOutside = true;
      }

      if (hasBeenOutside) {
        return createArrival(
          route,
          city,
          radiusMeters,
          segment,
          interval.start,
          startedInside ? "reentry" : "entry",
        );
      }

      cursor = Math.max(cursor, interval.end);
    }

    if (cursor < angularLength - ANGULAR_EPSILON) {
      hasBeenOutside = true;
    }
  }

  return null;
}

function createArrival(
  route: RoutePlan,
  city: City,
  radiusMeters: DistanceMeters,
  segment: ResolvedRouteSegment,
  angularDistanceInsideSegment: number,
  kind: CityArrivalKind,
): CityArrival {
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

  return {
    city,
    radiusMeters,
    kind,
    segmentIndex: segment.index,
    routeDistanceMeters:
      segment.cumulativeDistanceStartMeters + distanceInsideSegment,
    elapsedSeconds:
      segment.etaStartSeconds +
      distanceInsideSegment / route.speedMetersPerSecond,
    caravanPosition,
    distanceToCityMeters: greatCircleDistance(
      caravanPosition,
      city.position,
      route.planetRadiusMeters,
    ),
  };
}

/** Returns every exact interval where this great-circle leg is inside. */
function insideIntervals(
  segment: ResolvedRouteSegment,
  target: WorldCoordinate,
  angularRadius: number,
  segmentAngularLength: number,
): readonly AngularInterval[] {
  const startVector = coordinateToUnitVector(segment.start);
  const tangentVector = routeTangentUnitVector(segment.start, segment.bearingDeg);
  const targetVector = coordinateToUnitVector(target);
  const cosineCoefficient = dot(startVector, targetVector);
  const sineCoefficient = dot(tangentVector, targetVector);
  const amplitude = Math.min(1, Math.hypot(cosineCoefficient, sineCoefficient));
  const cosineRadius = Math.cos(angularRadius);

  if (amplitude <= ANGULAR_EPSILON) {
    return cosineRadius <= ANGULAR_EPSILON
      ? [{ start: 0, end: segmentAngularLength }]
      : [];
  }
  if (cosineRadius > amplitude + ANGULAR_EPSILON) return [];
  if (cosineRadius <= -amplitude + ANGULAR_EPSILON) {
    return [{ start: 0, end: segmentAngularLength }];
  }

  const halfWidth = Math.acos(clamp(cosineRadius / amplitude, -1, 1));
  const phase = Math.atan2(sineCoefficient, cosineCoefficient);
  let intervalNumber = Math.ceil(-(phase + halfWidth) / TWO_PI);
  const intervals: AngularInterval[] = [];

  while (true) {
    const center = phase + intervalNumber * TWO_PI;
    const intervalStart = center - halfWidth;
    const intervalEnd = center + halfWidth;
    if (intervalStart > segmentAngularLength + ANGULAR_EPSILON) break;

    if (intervalEnd >= -ANGULAR_EPSILON) {
      intervals.push({
        start: clamp(intervalStart, 0, segmentAngularLength),
        end: clamp(intervalEnd, 0, segmentAngularLength),
      });
    }
    intervalNumber += 1;
  }

  return intervals;
}

function isInsideRadius(
  coordinate: WorldCoordinate,
  target: WorldCoordinate,
  radiusMeters: number,
  planetRadiusMeters: number,
): boolean {
  return (
    greatCircleDistance(coordinate, target, planetRadiusMeters) <=
    radiusMeters + DISTANCE_EPSILON_METERS
  );
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

function assertArrivalRadius(radiusMeters: number): void {
  if (!Number.isFinite(radiusMeters) || radiusMeters < 0) {
    throw new RangeError(
      "cityArrivalRadiusMeters must be a non-negative finite number",
    );
  }
}
