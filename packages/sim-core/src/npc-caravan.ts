import { positionAtTime, type DurationSeconds, type RoutePlan } from "./route.js";
import type { DistanceMeters, WorldCoordinate } from "./types.js";

export const DEFAULT_NPC_CARAVAN_SPEED_METERS_PER_SECOND = 1.25;
export const DEFAULT_NPC_CARAVAN_VISION_RADIUS_METERS = 300;
export const DEFAULT_NPC_CARAVAN_INTERACTION_RADIUS_METERS = 500;

export interface NpcCaravan {
  readonly id: string;
  readonly kind: "npc-caravan";
  readonly originCityId: string;
  readonly destinationCityId: string;
  readonly departsAtSeconds: DurationSeconds;
  readonly visionRadiusMeters: DistanceMeters;
  readonly interactionRadiusMeters: DistanceMeters;
  readonly route: RoutePlan;
}

export type NpcCaravanTravelStatus = "scheduled" | "moving" | "arrived";

export interface NpcCaravanPosition {
  readonly coordinate: WorldCoordinate;
  readonly worldTimeSeconds: DurationSeconds;
  readonly routeElapsedSeconds: DurationSeconds;
  readonly status: NpcCaravanTravelStatus;
  readonly traveledDistanceMeters: DistanceMeters;
  readonly remainingDistanceMeters: DistanceMeters;
  readonly segmentIndex: number | null;
  readonly segmentProgress: number;
}

/**
 * LIVING-001 — projects an NPC traveller from authoritative world time by
 * reusing the exact RoutePlan and SIM-005 position solver used by expeditions.
 */
export function npcCaravanPositionAtWorldTime(
  caravan: NpcCaravan,
  worldTimeSeconds: DurationSeconds,
): NpcCaravanPosition {
  assertNonNegativeFinite(worldTimeSeconds, "worldTimeSeconds");
  assertNonNegativeFinite(caravan.departsAtSeconds, "caravan.departsAtSeconds");

  if (worldTimeSeconds < caravan.departsAtSeconds) {
    return {
      coordinate: caravan.route.start,
      worldTimeSeconds,
      routeElapsedSeconds: 0,
      status: "scheduled",
      traveledDistanceMeters: 0,
      remainingDistanceMeters: caravan.route.totalDistanceMeters,
      segmentIndex: null,
      segmentProgress: 0,
    };
  }

  const routeElapsedSeconds = worldTimeSeconds - caravan.departsAtSeconds;
  const position = positionAtTime(caravan.route, routeElapsedSeconds);

  return {
    coordinate: position.coordinate,
    worldTimeSeconds,
    routeElapsedSeconds,
    status: position.status,
    traveledDistanceMeters: position.traveledDistanceMeters,
    remainingDistanceMeters: position.remainingDistanceMeters,
    segmentIndex: position.segmentIndex,
    segmentProgress: position.segmentProgress,
  };
}

function assertNonNegativeFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative finite number`);
  }
}
