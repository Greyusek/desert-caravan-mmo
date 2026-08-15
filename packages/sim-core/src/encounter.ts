import { greatCircleDistance } from "./geometry.js";
import { DEFAULT_INTERACTION_RADIUS_METERS } from "./monster.js";
import { positionAtTime, type DurationSeconds, type RoutePlan } from "./route.js";
import type { DistanceMeters, WorldCoordinate } from "./types.js";

export type RouteMotionMode = "finite" | "cyclic";

export interface RouteMotion {
  readonly route: RoutePlan;
  readonly startsAtSeconds: DurationSeconds;
  readonly mode: RouteMotionMode;
}

export interface EncounterSearchWindow {
  readonly startSeconds: DurationSeconds;
  readonly endSeconds: DurationSeconds;
}

export interface MovingEncounter {
  readonly atSeconds: DurationSeconds;
  readonly separationMeters: DistanceMeters;
  readonly firstPosition: WorldCoordinate;
  readonly secondPosition: WorldCoordinate;
  readonly firstRouteElapsedSeconds: DurationSeconds;
  readonly secondRouteElapsedSeconds: DurationSeconds;
}

export const ENCOUNTER_TIME_TOLERANCE_SECONDS = 1e-6;
export const ENCOUNTER_DISTANCE_TOLERANCE_METERS = 1e-6;

interface MotionSample {
  readonly atSeconds: DurationSeconds;
  readonly coordinate: WorldCoordinate;
  readonly separationMeters: DistanceMeters;
  readonly positionDotProduct: number;
}

interface SearchInterval {
  readonly left: MotionSample;
  readonly right: MotionSample;
}

interface UnitVector {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

const DEG_TO_RAD = Math.PI / 180;
const CYCLIC_ROUTE_CLOSURE_TOLERANCE_METERS = 0.001;
const DOT_PRODUCT_EPSILON = 1e-14;

/**
 * SIM-008 — finds the first instant at which two route-backed entities are
 * simultaneously inside an encounter radius.
 *
 * Times are absolute simulation seconds. Finite routes are active from their
 * own start through arrival; cyclic routes repeat indefinitely and therefore
 * require the caller-provided finite search window.
 */
export function findFirstMovingEncounter(
  first: RouteMotion,
  second: RouteMotion,
  searchWindow: EncounterSearchWindow,
  encounterRadiusMeters: DistanceMeters = DEFAULT_INTERACTION_RADIUS_METERS,
): MovingEncounter | null {
  validateMotion(first, "first");
  validateMotion(second, "second");
  validateSearchWindow(searchWindow);
  assertNonNegativeFinite(encounterRadiusMeters, "encounterRadiusMeters");

  if (first.route.planetRadiusMeters !== second.route.planetRadiusMeters) {
    throw new RangeError("moving routes must use the same planetRadiusMeters");
  }

  const effectiveStart = Math.max(
    searchWindow.startSeconds,
    first.startsAtSeconds,
    second.startsAtSeconds,
  );
  const effectiveEnd = Math.min(
    searchWindow.endSeconds,
    motionActiveEnd(first),
    motionActiveEnd(second),
  );

  if (effectiveStart > effectiveEnd) return null;

  const firstInstant = sampleMotions(first, second, effectiveStart);
  if (isInsideEncounter(firstInstant, encounterRadiusMeters)) {
    return buildEncounter(first, second, firstInstant);
  }
  if (effectiveStart === effectiveEnd) return null;

  let intervalStart = effectiveStart;
  while (intervalStart < effectiveEnd) {
    const intervalEnd = Math.min(
      effectiveEnd,
      nextSegmentBoundaryAfter(first, intervalStart),
      nextSegmentBoundaryAfter(second, intervalStart),
    );

    if (!(intervalEnd > intervalStart)) {
      throw new RangeError("route segment times must advance within the search window");
    }

    const encounterSample = findFirstEntryInsideSmoothInterval(
      first,
      second,
      intervalStart,
      intervalEnd,
      encounterRadiusMeters,
    );
    if (encounterSample) {
      return buildEncounter(first, second, encounterSample);
    }

    intervalStart = intervalEnd;
  }

  return null;
}

function findFirstEntryInsideSmoothInterval(
  first: RouteMotion,
  second: RouteMotion,
  startSeconds: DurationSeconds,
  endSeconds: DurationSeconds,
  encounterRadiusMeters: DistanceMeters,
): MotionSample | null {
  const planetRadiusMeters = first.route.planetRadiusMeters;
  const angularRadius = Math.min(encounterRadiusMeters / planetRadiusMeters, Math.PI);
  const thresholdDotProduct = Math.cos(angularRadius);
  const maximumAngularSpeed =
    (first.route.speedMetersPerSecond + second.route.speedMetersPerSecond) /
    planetRadiusMeters;
  const secondDerivativeBound = maximumAngularSpeed ** 2;

  const left = sampleMotions(first, second, startSeconds);
  const right = sampleMotions(first, second, endSeconds);
  const pending: SearchInterval[] = [{ left, right }];

  while (pending.length > 0) {
    const interval = pending.pop();
    if (!interval) break;

    if (isInsideEncounter(interval.left, encounterRadiusMeters)) {
      return interval.left;
    }

    const widthSeconds = interval.right.atSeconds - interval.left.atSeconds;
    const maximumPossibleDotProduct =
      Math.max(
        interval.left.positionDotProduct,
        interval.right.positionDotProduct,
      ) +
      (secondDerivativeBound * widthSeconds ** 2) / 8;

    // For a twice-differentiable function, linear interpolation can differ
    // from the real value by at most max(|f''|) * width² / 8. This lets us
    // discard intervals that cannot reach the radius without fixed-rate
    // route sampling.
    if (maximumPossibleDotProduct < thresholdDotProduct - DOT_PRODUCT_EPSILON) {
      continue;
    }

    if (
      widthSeconds <= ENCOUNTER_TIME_TOLERANCE_SECONDS &&
      maximumAngularSpeed * widthSeconds <= Math.PI / 4
    ) {
      const leafEntry = findFirstEntryInsideLeaf(
        first,
        second,
        interval.left,
        interval.right,
        encounterRadiusMeters,
      );
      if (leafEntry) return leafEntry;
      continue;
    }

    const midpoint = sampleMotions(
      first,
      second,
      interval.left.atSeconds + widthSeconds / 2,
    );

    // Stack order is intentional: the earlier half is searched first.
    pending.push({ left: midpoint, right: interval.right });
    pending.push({ left: interval.left, right: midpoint });
  }

  return null;
}

function findFirstEntryInsideLeaf(
  first: RouteMotion,
  second: RouteMotion,
  left: MotionSample,
  right: MotionSample,
  encounterRadiusMeters: DistanceMeters,
): MotionSample | null {
  const midpoint = sampleMotions(
    first,
    second,
    left.atSeconds + (right.atSeconds - left.atSeconds) / 2,
  );
  const closest = minimizeSeparation(
    first,
    second,
    left.atSeconds,
    right.atSeconds,
  );
  const candidate = [left, midpoint, closest, right].reduce((best, sample) =>
    sample.separationMeters < best.separationMeters ? sample : best,
  );

  if (!isInsideEncounter(candidate, encounterRadiusMeters)) return null;
  if (isInsideEncounter(left, encounterRadiusMeters)) return left;

  let outside = left.atSeconds;
  let inside = candidate.atSeconds;
  let insideSample = candidate;

  while (inside - outside > ENCOUNTER_TIME_TOLERANCE_SECONDS) {
    const midpointSeconds = outside + (inside - outside) / 2;
    const sample = sampleMotions(first, second, midpointSeconds);
    if (isInsideEncounter(sample, encounterRadiusMeters)) {
      inside = midpointSeconds;
      insideSample = sample;
    } else {
      outside = midpointSeconds;
    }
  }

  return insideSample;
}

function minimizeSeparation(
  first: RouteMotion,
  second: RouteMotion,
  startSeconds: DurationSeconds,
  endSeconds: DurationSeconds,
): MotionSample {
  const goldenRatio = (Math.sqrt(5) - 1) / 2;
  let left = startSeconds;
  let right = endSeconds;
  let firstTime = right - goldenRatio * (right - left);
  let secondTime = left + goldenRatio * (right - left);
  let firstSample = sampleMotions(first, second, firstTime);
  let secondSample = sampleMotions(first, second, secondTime);

  for (let iteration = 0; iteration < 32; iteration += 1) {
    if (firstSample.separationMeters <= secondSample.separationMeters) {
      right = secondTime;
      secondTime = firstTime;
      secondSample = firstSample;
      firstTime = right - goldenRatio * (right - left);
      firstSample = sampleMotions(first, second, firstTime);
    } else {
      left = firstTime;
      firstTime = secondTime;
      firstSample = secondSample;
      secondTime = left + goldenRatio * (right - left);
      secondSample = sampleMotions(first, second, secondTime);
    }
  }

  return firstSample.separationMeters <= secondSample.separationMeters
    ? firstSample
    : secondSample;
}

function sampleMotions(
  first: RouteMotion,
  second: RouteMotion,
  atSeconds: DurationSeconds,
): MotionSample {
  const firstCoordinate = coordinateAtAbsoluteTime(first, atSeconds);
  const secondCoordinate = coordinateAtAbsoluteTime(second, atSeconds);
  const firstVector = coordinateToUnitVector(firstCoordinate);
  const secondVector = coordinateToUnitVector(secondCoordinate);

  return {
    atSeconds,
    coordinate: firstCoordinate,
    separationMeters: greatCircleDistance(
      firstCoordinate,
      secondCoordinate,
      first.route.planetRadiusMeters,
    ),
    positionDotProduct:
      firstVector.x * secondVector.x +
      firstVector.y * secondVector.y +
      firstVector.z * secondVector.z,
  };
}

function buildEncounter(
  first: RouteMotion,
  second: RouteMotion,
  sample: MotionSample,
): MovingEncounter {
  const secondPosition = coordinateAtAbsoluteTime(second, sample.atSeconds);
  return {
    atSeconds: sample.atSeconds,
    separationMeters: sample.separationMeters,
    firstPosition: sample.coordinate,
    secondPosition,
    firstRouteElapsedSeconds: sample.atSeconds - first.startsAtSeconds,
    secondRouteElapsedSeconds: sample.atSeconds - second.startsAtSeconds,
  };
}

function coordinateAtAbsoluteTime(
  motion: RouteMotion,
  atSeconds: DurationSeconds,
): WorldCoordinate {
  const elapsedSeconds = atSeconds - motion.startsAtSeconds;
  const routeElapsedSeconds =
    motion.mode === "cyclic"
      ? elapsedSeconds % motion.route.totalDurationSeconds
      : elapsedSeconds;
  return positionAtTime(motion.route, routeElapsedSeconds).coordinate;
}

function nextSegmentBoundaryAfter(
  motion: RouteMotion,
  atSeconds: DurationSeconds,
): DurationSeconds {
  const elapsedSeconds = atSeconds - motion.startsAtSeconds;

  if (motion.mode === "finite") {
    for (const segment of motion.route.segments) {
      const boundary = motion.startsAtSeconds + segment.etaEndSeconds;
      if (boundary > atSeconds) return boundary;
    }
    return Number.POSITIVE_INFINITY;
  }

  const periodSeconds = motion.route.totalDurationSeconds;
  const cycleIndex = Math.floor(elapsedSeconds / periodSeconds);
  const cycleStartSeconds = motion.startsAtSeconds + cycleIndex * periodSeconds;

  for (const segment of motion.route.segments) {
    const boundary = cycleStartSeconds + segment.etaEndSeconds;
    if (boundary > atSeconds) return boundary;
  }

  return cycleStartSeconds + periodSeconds + firstPositiveSegmentEnd(motion.route);
}

function firstPositiveSegmentEnd(route: RoutePlan): DurationSeconds {
  for (const segment of route.segments) {
    if (segment.etaEndSeconds > 0) return segment.etaEndSeconds;
  }
  throw new RangeError("cyclic route must have a positive duration");
}

function motionActiveEnd(motion: RouteMotion): DurationSeconds {
  return motion.mode === "cyclic"
    ? Number.POSITIVE_INFINITY
    : motion.startsAtSeconds + motion.route.totalDurationSeconds;
}

function isInsideEncounter(
  sample: MotionSample,
  encounterRadiusMeters: DistanceMeters,
): boolean {
  return (
    sample.separationMeters <=
    encounterRadiusMeters + ENCOUNTER_DISTANCE_TOLERANCE_METERS
  );
}

function validateMotion(motion: RouteMotion, name: string): void {
  assertNonNegativeFinite(motion.startsAtSeconds, `${name}.startsAtSeconds`);
  if (motion.mode !== "finite" && motion.mode !== "cyclic") {
    throw new RangeError(`${name}.mode must be finite or cyclic`);
  }

  if (motion.mode === "cyclic") {
    if (
      !Number.isFinite(motion.route.totalDurationSeconds) ||
      motion.route.totalDurationSeconds <= 0
    ) {
      throw new RangeError(`${name}.route must have a positive duration when cyclic`);
    }

    const closureDistance = greatCircleDistance(
      motion.route.start,
      motion.route.end,
      motion.route.planetRadiusMeters,
    );
    if (closureDistance > CYCLIC_ROUTE_CLOSURE_TOLERANCE_METERS) {
      throw new RangeError(`${name}.route must be closed when cyclic`);
    }
  }
}

function validateSearchWindow(searchWindow: EncounterSearchWindow): void {
  assertNonNegativeFinite(searchWindow.startSeconds, "searchWindow.startSeconds");
  assertNonNegativeFinite(searchWindow.endSeconds, "searchWindow.endSeconds");
  if (searchWindow.endSeconds < searchWindow.startSeconds) {
    throw new RangeError("searchWindow.endSeconds must not precede startSeconds");
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

function assertNonNegativeFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative finite number`);
  }
}
