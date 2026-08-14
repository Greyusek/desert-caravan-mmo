import {
  DEFAULT_TEST_PLANET_RADIUS_METERS,
  type BearingDegrees,
  type DistanceMeters,
  type WorldCoordinate,
  normalizeBearing,
} from "./types.js";
import { destinationPoint } from "./geometry.js";

export type DurationSeconds = number;
export type SpeedMetersPerSecond = number;

export interface RouteCommand {
  readonly bearingDeg: BearingDegrees;
  readonly distanceMeters: DistanceMeters;
}

export interface ResolvedRouteSegment {
  readonly index: number;
  readonly start: WorldCoordinate;
  readonly end: WorldCoordinate;
  readonly bearingDeg: BearingDegrees;
  readonly distanceMeters: DistanceMeters;
  readonly durationSeconds: DurationSeconds;
  readonly cumulativeDistanceStartMeters: DistanceMeters;
  readonly cumulativeDistanceEndMeters: DistanceMeters;
  readonly etaStartSeconds: DurationSeconds;
  readonly etaEndSeconds: DurationSeconds;
}

export interface RoutePlan {
  readonly start: WorldCoordinate;
  readonly end: WorldCoordinate;
  readonly speedMetersPerSecond: SpeedMetersPerSecond;
  readonly planetRadiusMeters: number;
  readonly segments: readonly ResolvedRouteSegment[];
  readonly totalDistanceMeters: DistanceMeters;
  readonly totalDurationSeconds: DurationSeconds;
}

export type RoutePositionStatus = "moving" | "arrived";

export interface RoutePosition {
  readonly coordinate: WorldCoordinate;
  readonly status: RoutePositionStatus;
  readonly elapsedSeconds: DurationSeconds;
  readonly traveledDistanceMeters: DistanceMeters;
  readonly remainingDistanceMeters: DistanceMeters;
  readonly segmentIndex: number | null;
  readonly segmentProgress: number;
}

/**
 * SIM-004 — превращает команды «азимут + расстояние» в реальный составной маршрут.
 * ETA хранится как смещение в секундах от старта экспедиции.
 */
export function createRoutePlan(
  start: WorldCoordinate,
  commands: readonly RouteCommand[],
  speedMetersPerSecond: SpeedMetersPerSecond,
  planetRadiusMeters = DEFAULT_TEST_PLANET_RADIUS_METERS,
): RoutePlan {
  assertPositiveFinite(speedMetersPerSecond, "speedMetersPerSecond");
  assertPositiveFinite(planetRadiusMeters, "planetRadiusMeters");

  if (commands.length === 0) {
    throw new RangeError("Route must contain at least one segment");
  }

  const segments: ResolvedRouteSegment[] = [];
  let current = start;
  let cumulativeDistance = 0;
  let cumulativeDuration = 0;

  commands.forEach((command, index) => {
    assertNonNegativeFinite(command.distanceMeters, `commands[${index}].distanceMeters`);

    const bearingDeg = normalizeBearing(command.bearingDeg);
    const distanceMeters = command.distanceMeters;
    const durationSeconds = distanceMeters / speedMetersPerSecond;
    const end = destinationPoint(
      current,
      bearingDeg,
      distanceMeters,
      planetRadiusMeters,
    );

    const segment: ResolvedRouteSegment = {
      index,
      start: current,
      end,
      bearingDeg,
      distanceMeters,
      durationSeconds,
      cumulativeDistanceStartMeters: cumulativeDistance,
      cumulativeDistanceEndMeters: cumulativeDistance + distanceMeters,
      etaStartSeconds: cumulativeDuration,
      etaEndSeconds: cumulativeDuration + durationSeconds,
    };

    segments.push(segment);
    current = end;
    cumulativeDistance += distanceMeters;
    cumulativeDuration += durationSeconds;
  });

  return {
    start,
    end: current,
    speedMetersPerSecond,
    planetRadiusMeters,
    segments,
    totalDistanceMeters: cumulativeDistance,
    totalDurationSeconds: cumulativeDuration,
  };
}

/**
 * SIM-005 — положение каравана в любой момент T после старта.
 * Серверу не нужно обновлять координату каждую секунду: она вычисляется по маршруту и времени.
 */
export function positionAtTime(
  route: RoutePlan,
  elapsedSeconds: DurationSeconds,
): RoutePosition {
  assertNonNegativeFinite(elapsedSeconds, "elapsedSeconds");

  if (elapsedSeconds >= route.totalDurationSeconds) {
    return {
      coordinate: route.end,
      status: "arrived",
      elapsedSeconds,
      traveledDistanceMeters: route.totalDistanceMeters,
      remainingDistanceMeters: 0,
      segmentIndex: null,
      segmentProgress: 1,
    };
  }

  const segment = route.segments.find(
    (candidate) => elapsedSeconds < candidate.etaEndSeconds,
  );

  // В нормальном RoutePlan этот случай возможен только при наборе нулевых сегментов.
  if (!segment) {
    return {
      coordinate: route.end,
      status: "arrived",
      elapsedSeconds,
      traveledDistanceMeters: route.totalDistanceMeters,
      remainingDistanceMeters: 0,
      segmentIndex: null,
      segmentProgress: 1,
    };
  }

  const secondsInsideSegment = Math.max(0, elapsedSeconds - segment.etaStartSeconds);
  const distanceInsideSegment = Math.min(
    segment.distanceMeters,
    secondsInsideSegment * route.speedMetersPerSecond,
  );
  const segmentProgress =
    segment.distanceMeters === 0 ? 1 : distanceInsideSegment / segment.distanceMeters;

  const coordinate = destinationPoint(
    segment.start,
    segment.bearingDeg,
    distanceInsideSegment,
    route.planetRadiusMeters,
  );

  const traveledDistanceMeters = Math.min(
    route.totalDistanceMeters,
    segment.cumulativeDistanceStartMeters + distanceInsideSegment,
  );

  return {
    coordinate,
    status: "moving",
    elapsedSeconds,
    traveledDistanceMeters,
    remainingDistanceMeters: Math.max(0, route.totalDistanceMeters - traveledDistanceMeters),
    segmentIndex: segment.index,
    segmentProgress,
  };
}

function assertPositiveFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive finite number`);
  }
}

function assertNonNegativeFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative finite number`);
  }
}
