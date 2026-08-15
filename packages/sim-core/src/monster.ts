import { greatCircleDistance } from "./geometry.js";
import { positionAtTime, type DurationSeconds, type RoutePlan } from "./route.js";
import type { DistanceMeters, WorldCoordinate } from "./types.js";

export const DEFAULT_WANDERING_MONSTER_SPEED_METERS_PER_SECOND = 1.5;
export const DEFAULT_VISIBLE_TARGET_RADIUS_METERS = 300;
export const DEFAULT_INTERACTION_RADIUS_METERS = 500;

export interface WanderingMonster {
  readonly id: string;
  readonly kind: "wandering-monster";
  readonly power: number;
  readonly visionRadiusMeters: DistanceMeters;
  readonly interactionRadiusMeters: DistanceMeters;
  readonly patrolRoute: RoutePlan;
}

export interface WanderingMonsterPosition {
  readonly coordinate: WorldCoordinate;
  readonly elapsedSeconds: DurationSeconds;
  readonly cycleIndex: number;
  readonly cycleElapsedSeconds: DurationSeconds;
  readonly segmentIndex: number;
  readonly segmentProgress: number;
  readonly traveledDistanceInCycleMeters: DistanceMeters;
  readonly remainingDistanceInCycleMeters: DistanceMeters;
}

const ROUTE_CLOSURE_TOLERANCE_METERS = 0.001;

/**
 * WORLD-004 — evaluates a wandering monster on a physically closed patrol loop.
 * The monster never teleports from the route end back to its start: generated
 * patrols contain an explicit closing great-circle segment.
 */
export function wanderingMonsterPositionAtTime(
  monster: WanderingMonster,
  elapsedSeconds: DurationSeconds,
): WanderingMonsterPosition {
  assertNonNegativeFinite(elapsedSeconds, "elapsedSeconds");

  const route = monster.patrolRoute;
  if (route.totalDurationSeconds <= 0) {
    throw new RangeError("patrolRoute must have a positive duration");
  }

  const closureDistance = greatCircleDistance(
    route.start,
    route.end,
    route.planetRadiusMeters,
  );
  if (closureDistance > ROUTE_CLOSURE_TOLERANCE_METERS) {
    throw new RangeError("patrolRoute must be a closed cyclic route");
  }

  const cycleIndex = Math.floor(elapsedSeconds / route.totalDurationSeconds);
  const cycleElapsedSeconds = elapsedSeconds % route.totalDurationSeconds;
  const routePosition = positionAtTime(route, cycleElapsedSeconds);

  if (routePosition.segmentIndex === null) {
    throw new RangeError("patrolRoute must contain a moving segment");
  }

  return {
    coordinate: routePosition.coordinate,
    elapsedSeconds,
    cycleIndex,
    cycleElapsedSeconds,
    segmentIndex: routePosition.segmentIndex,
    segmentProgress: routePosition.segmentProgress,
    traveledDistanceInCycleMeters: routePosition.traveledDistanceMeters,
    remainingDistanceInCycleMeters: routePosition.remainingDistanceMeters,
  };
}

function assertNonNegativeFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative finite number`);
  }
}
