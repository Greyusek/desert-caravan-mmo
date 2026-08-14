import {
  DEFAULT_TEST_PLANET_RADIUS_METERS,
  type BearingDegrees,
  type DistanceMeters,
  type WorldCoordinate,
  createWorldCoordinate,
  normalizeBearing,
} from "./types.js";

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

/**
 * SIM-002 — точка назначения на сфере по старту, азимуту и расстоянию.
 */
export function destinationPoint(
  start: WorldCoordinate,
  bearingDeg: BearingDegrees,
  distanceMeters: DistanceMeters,
  planetRadiusMeters = DEFAULT_TEST_PLANET_RADIUS_METERS,
): WorldCoordinate {
  assertPositiveRadius(planetRadiusMeters);
  assertNonNegativeDistance(distanceMeters);

  if (distanceMeters === 0) {
    return createWorldCoordinate(start.latitudeDeg, start.longitudeDeg);
  }

  const angularDistance = distanceMeters / planetRadiusMeters;
  const bearingRad = normalizeBearing(bearingDeg) * DEG_TO_RAD;
  const lat1 = start.latitudeDeg * DEG_TO_RAD;
  const lon1 = start.longitudeDeg * DEG_TO_RAD;

  const sinLat1 = Math.sin(lat1);
  const cosLat1 = Math.cos(lat1);
  const sinAngular = Math.sin(angularDistance);
  const cosAngular = Math.cos(angularDistance);

  const lat2 = Math.asin(
    sinLat1 * cosAngular + cosLat1 * sinAngular * Math.cos(bearingRad),
  );

  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(bearingRad) * sinAngular * cosLat1,
      cosAngular - sinLat1 * Math.sin(lat2),
    );

  return createWorldCoordinate(lat2 * RAD_TO_DEG, lon2 * RAD_TO_DEG);
}

/**
 * SIM-003 — кратчайшее расстояние по большой окружности (haversine).
 */
export function greatCircleDistance(
  a: WorldCoordinate,
  b: WorldCoordinate,
  planetRadiusMeters = DEFAULT_TEST_PLANET_RADIUS_METERS,
): DistanceMeters {
  assertPositiveRadius(planetRadiusMeters);

  const lat1 = a.latitudeDeg * DEG_TO_RAD;
  const lat2 = b.latitudeDeg * DEG_TO_RAD;
  const deltaLat = (b.latitudeDeg - a.latitudeDeg) * DEG_TO_RAD;
  const deltaLon = (b.longitudeDeg - a.longitudeDeg) * DEG_TO_RAD;

  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;

  // Защита от накопления floating-point ошибки около 0 и antipode.
  const clamped = Math.min(1, Math.max(0, haversine));
  const centralAngle = 2 * Math.atan2(Math.sqrt(clamped), Math.sqrt(1 - clamped));

  return planetRadiusMeters * centralAngle;
}

function assertPositiveRadius(radiusMeters: number): void {
  if (!Number.isFinite(radiusMeters) || radiusMeters <= 0) {
    throw new RangeError("planetRadiusMeters must be a positive finite number");
  }
}

function assertNonNegativeDistance(distanceMeters: number): void {
  if (!Number.isFinite(distanceMeters) || distanceMeters < 0) {
    throw new RangeError("distanceMeters must be a non-negative finite number");
  }
}
