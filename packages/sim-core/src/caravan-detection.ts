import {
  findFirstMovingEncounter,
  type EncounterSearchWindow,
  type RouteMotion,
} from "./encounter.js";
import type { NpcCaravan } from "./npc-caravan.js";
import type { DurationSeconds } from "./route.js";
import type { DistanceMeters } from "./types.js";

export interface CaravanDetectionSubject {
  readonly id: string;
  readonly visionRadiusMeters: DistanceMeters;
  readonly motion: RouteMotion;
}

export interface CaravanSighting {
  readonly observerId: string;
  readonly targetId: string;
  readonly atWorldTimeSeconds: DurationSeconds;
  readonly separationMeters: DistanceMeters;
  readonly observerRouteElapsedSeconds: DurationSeconds;
  readonly targetRouteElapsedSeconds: DurationSeconds;
}

export interface AsymmetricCaravanDetections {
  readonly firstDetectsSecond: CaravanSighting | null;
  readonly secondDetectsFirst: CaravanSighting | null;
}

export function createNpcCaravanDetectionSubject(
  caravan: NpcCaravan,
): CaravanDetectionSubject {
  return {
    id: caravan.id,
    visionRadiusMeters: caravan.visionRadiusMeters,
    motion: {
      route: caravan.route,
      startsAtSeconds: caravan.departsAtSeconds,
      mode: "finite",
    },
  };
}

/**
 * LIVING-002 — evaluates each observer independently. The continuous movement
 * solver receives the observer's own vision radius, so detection need not be
 * reciprocal. Player-facing sightings intentionally omit server coordinates.
 */
export function findAsymmetricCaravanDetections(
  first: CaravanDetectionSubject,
  second: CaravanDetectionSubject,
  searchWindow: EncounterSearchWindow,
): AsymmetricCaravanDetections {
  validateSubject(first, "first");
  validateSubject(second, "second");
  if (first.id === second.id) {
    throw new RangeError("caravan detection subjects must have unique ids");
  }

  return {
    firstDetectsSecond: findSighting(first, second, searchWindow),
    secondDetectsFirst: findSighting(second, first, searchWindow),
  };
}

function findSighting(
  observer: CaravanDetectionSubject,
  target: CaravanDetectionSubject,
  searchWindow: EncounterSearchWindow,
): CaravanSighting | null {
  const encounter = findFirstMovingEncounter(
    observer.motion,
    target.motion,
    searchWindow,
    observer.visionRadiusMeters,
  );
  if (!encounter) return null;

  return {
    observerId: observer.id,
    targetId: target.id,
    atWorldTimeSeconds: encounter.atSeconds,
    separationMeters: encounter.separationMeters,
    observerRouteElapsedSeconds: encounter.firstRouteElapsedSeconds,
    targetRouteElapsedSeconds: encounter.secondRouteElapsedSeconds,
  };
}

function validateSubject(subject: CaravanDetectionSubject, name: string): void {
  if (subject.id.length === 0) {
    throw new RangeError(`${name}.id must not be empty`);
  }
  if (!Number.isFinite(subject.visionRadiusMeters) || subject.visionRadiusMeters < 0) {
    throw new RangeError(
      `${name}.visionRadiusMeters must be a non-negative finite number`,
    );
  }
}
