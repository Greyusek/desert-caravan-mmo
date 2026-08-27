import { destinationPoint } from "./geometry.js";
import {
  npcCaravanPositionAtWorldTime,
  type NpcCaravan,
} from "./npc-caravan.js";
import type { DurationSeconds } from "./route.js";
import {
  normalizeBearing,
  type BearingDegrees,
  type DistanceMeters,
  type WorldCoordinate,
} from "./types.js";

export const NPC_CARAVAN_TRACK_SPACING_METERS = 500;
export const FRESH_TRACK_MAX_AGE_SECONDS = 60 * 60;
export const RECENT_TRACK_MAX_AGE_SECONDS = 6 * 60 * 60;
export const OLD_TRACK_MAX_AGE_SECONDS = 24 * 60 * 60;

export type ApproximateTrackAge =
  | "fresh"
  | "recent"
  | "old"
  | "weathered";

export type ApproximateTravelDirection =
  | "north"
  | "northeast"
  | "east"
  | "southeast"
  | "south"
  | "southwest"
  | "west"
  | "northwest";

/** Authoritative world object. Its position must remain server-side. */
export interface NpcCaravanTrackMark {
  readonly id: string;
  readonly kind: "npc-caravan-track";
  readonly sourceCaravanId: string;
  readonly ordinal: number;
  readonly position: WorldCoordinate;
  readonly passedAtWorldTimeSeconds: DurationSeconds;
  readonly routeDistanceMeters: DistanceMeters;
  readonly travelBearingDeg: BearingDegrees;
}

/** Coordinate-free clue safe to add to player-facing knowledge later. */
export interface ObservedCaravanTrack {
  readonly trackId: string;
  readonly kind: "caravan-track";
  readonly observedAtWorldTimeSeconds: DurationSeconds;
  readonly approximateAge: ApproximateTrackAge;
  readonly approximateDirection: ApproximateTravelDirection;
}

/**
 * LIVING-003 — derives stable physical marks only from the prefix an NPC has
 * actually travelled at authoritative world time. Marks are anchored to fixed
 * route-distance intervals, so advancing time only appends new marks.
 */
export function deriveNpcCaravanTrackMarks(
  caravan: NpcCaravan,
  worldTimeSeconds: DurationSeconds,
): readonly NpcCaravanTrackMark[] {
  if (caravan.id.length === 0) {
    throw new RangeError("caravan.id must not be empty");
  }
  const projection = npcCaravanPositionAtWorldTime(caravan, worldTimeSeconds);
  const markCount = Math.floor(
    (projection.traveledDistanceMeters + 1e-7) /
      NPC_CARAVAN_TRACK_SPACING_METERS,
  );
  const marks: NpcCaravanTrackMark[] = [];

  for (let ordinal = 1; ordinal <= markCount; ordinal += 1) {
    const routeDistanceMeters =
      ordinal * NPC_CARAVAN_TRACK_SPACING_METERS;
    const segment = caravan.route.segments.find(
      (candidate) =>
        routeDistanceMeters <= candidate.cumulativeDistanceEndMeters + 1e-7,
    );
    if (!segment) {
      throw new Error("track distance must resolve to an authoritative segment");
    }
    const distanceInsideSegment = Math.max(
      0,
      routeDistanceMeters - segment.cumulativeDistanceStartMeters,
    );
    marks.push({
      id: `npc-track-${opaqueSourceKey(caravan.id)}-${ordinal}`,
      kind: "npc-caravan-track",
      sourceCaravanId: caravan.id,
      ordinal,
      position: destinationPoint(
        segment.start,
        segment.bearingDeg,
        distanceInsideSegment,
        caravan.route.planetRadiusMeters,
      ),
      passedAtWorldTimeSeconds:
        caravan.departsAtSeconds +
        routeDistanceMeters / caravan.route.speedMetersPerSecond,
      routeDistanceMeters,
      travelBearingDeg: segment.bearingDeg,
    });
  }

  return marks;
}

/** Converts server truth into deliberately coarse player-facing information. */
export function observeCaravanTrack(
  mark: NpcCaravanTrackMark,
  observedAtWorldTimeSeconds: DurationSeconds,
): ObservedCaravanTrack {
  assertNonNegativeFinite(
    observedAtWorldTimeSeconds,
    "observedAtWorldTimeSeconds",
  );
  assertNonNegativeFinite(
    mark.passedAtWorldTimeSeconds,
    "mark.passedAtWorldTimeSeconds",
  );
  if (observedAtWorldTimeSeconds < mark.passedAtWorldTimeSeconds) {
    throw new RangeError(
      "observedAtWorldTimeSeconds must not precede the track",
    );
  }

  return {
    trackId: mark.id,
    kind: "caravan-track",
    observedAtWorldTimeSeconds,
    approximateAge: approximateTrackAge(
      observedAtWorldTimeSeconds - mark.passedAtWorldTimeSeconds,
    ),
    approximateDirection: approximateTravelDirection(mark.travelBearingDeg),
  };
}

export function approximateTrackAge(
  ageSeconds: DurationSeconds,
): ApproximateTrackAge {
  assertNonNegativeFinite(ageSeconds, "ageSeconds");
  if (ageSeconds < FRESH_TRACK_MAX_AGE_SECONDS) return "fresh";
  if (ageSeconds < RECENT_TRACK_MAX_AGE_SECONDS) return "recent";
  if (ageSeconds < OLD_TRACK_MAX_AGE_SECONDS) return "old";
  return "weathered";
}

export function approximateTravelDirection(
  bearingDeg: BearingDegrees,
): ApproximateTravelDirection {
  if (!Number.isFinite(bearingDeg)) {
    throw new TypeError("bearingDeg must be a finite number");
  }
  const sectors: readonly ApproximateTravelDirection[] = [
    "north",
    "northeast",
    "east",
    "southeast",
    "south",
    "southwest",
    "west",
    "northwest",
  ];
  return sectors[Math.round(normalizeBearing(bearingDeg) / 45) % 8] ?? "north";
}

function opaqueSourceKey(sourceId: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < sourceId.length; index += 1) {
    hash ^= sourceId.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function assertNonNegativeFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative finite number`);
  }
}
