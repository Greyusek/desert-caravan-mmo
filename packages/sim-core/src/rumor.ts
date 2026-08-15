import { destinationPoint } from "./geometry.js";
import type { DistanceMeters } from "./types.js";
import type { City, StaticWorldObject, StaticWorldObjectKind } from "./world.js";

export const DEFAULT_RUMOR_MINIMUM_DISTANCE_METERS = 30_000;
export const DEFAULT_RUMOR_MAXIMUM_DISTANCE_METERS = 50_000;
export const DEFAULT_RUMOR_SECTOR_CENTER_BEARING_DEG = 315;
export const DEFAULT_RUMOR_SECTOR_HALF_WIDTH_DEG = 22.5;

export type RumorInformationQuality = "rough";
export type RumorBearingSectorName = "northwest";

export interface RumorBearingSector {
  readonly name: RumorBearingSectorName;
  readonly centerBearingDeg: number;
  readonly minimumBearingDeg: number;
  readonly maximumBearingDeg: number;
}

export interface RumorDistanceRange {
  readonly minimumMeters: DistanceMeters;
  readonly maximumMeters: DistanceMeters;
}

/** Player-facing knowledge. It deliberately contains no target coordinate. */
export interface SearchRumor {
  readonly id: string;
  readonly originCityId: string;
  readonly targetKind: StaticWorldObjectKind;
  readonly bearingSector: RumorBearingSector;
  readonly distanceRange: RumorDistanceRange;
  readonly informationQuality: RumorInformationQuality;
}

/**
 * Authoritative scenario data. `serverTruth` must never be sent to a normal
 * player client; the debug overlay consumes it only to verify the search loop.
 */
export interface RumorSearchScenario {
  readonly rumor: SearchRumor;
  readonly serverTruth: {
    readonly target: StaticWorldObject;
    readonly exactBearingDeg: number;
    readonly exactDistanceMeters: DistanceMeters;
  };
}

const TARGET_KIND: StaticWorldObjectKind = "mine";
const TARGET_BEARING_MINIMUM_DEG = 300;
const TARGET_BEARING_MAXIMUM_DEG = 330;
const TARGET_DISTANCE_MINIMUM_METERS = 32_000;
const TARGET_DISTANCE_MAXIMUM_METERS = 48_000;

/**
 * GAME-001 — creates one reproducible local search scenario around a city.
 *
 * The clue stays deliberately coarse (northwest, 30–50 km), while a namespaced
 * PRNG chooses the hidden mine inside that sector. Changing other world-layer
 * counts cannot perturb this target.
 */
export function createRumorSearchScenario(
  seed: string,
  originCity: City,
): RumorSearchScenario {
  if (seed.length === 0) {
    throw new RangeError("seed must not be empty");
  }
  if (originCity.id.length === 0) {
    throw new RangeError("originCity.id must not be empty");
  }

  const random = mulberry32(
    hashSeed(`${seed}:game-001:rumor:${originCity.id}:${TARGET_KIND}`),
  );
  const exactBearingDeg = randomInRange(
    random,
    TARGET_BEARING_MINIMUM_DEG,
    TARGET_BEARING_MAXIMUM_DEG,
  );
  const exactDistanceMeters = randomInRange(
    random,
    TARGET_DISTANCE_MINIMUM_METERS,
    TARGET_DISTANCE_MAXIMUM_METERS,
  );
  const target: StaticWorldObject = {
    id: `rumor-${TARGET_KIND}-${originCity.id}`,
    kind: TARGET_KIND,
    position: destinationPoint(
      originCity.position,
      exactBearingDeg,
      exactDistanceMeters,
    ),
  };

  return {
    rumor: {
      id: `rumor-${originCity.id}-01`,
      originCityId: originCity.id,
      targetKind: TARGET_KIND,
      bearingSector: {
        name: "northwest",
        centerBearingDeg: DEFAULT_RUMOR_SECTOR_CENTER_BEARING_DEG,
        minimumBearingDeg:
          DEFAULT_RUMOR_SECTOR_CENTER_BEARING_DEG -
          DEFAULT_RUMOR_SECTOR_HALF_WIDTH_DEG,
        maximumBearingDeg:
          DEFAULT_RUMOR_SECTOR_CENTER_BEARING_DEG +
          DEFAULT_RUMOR_SECTOR_HALF_WIDTH_DEG,
      },
      distanceRange: {
        minimumMeters: DEFAULT_RUMOR_MINIMUM_DISTANCE_METERS,
        maximumMeters: DEFAULT_RUMOR_MAXIMUM_DISTANCE_METERS,
      },
      informationQuality: "rough",
    },
    serverTruth: {
      target,
      exactBearingDeg,
      exactDistanceMeters,
    },
  };
}

/** FNV-1a over UTF-16 code units, matching the world generator convention. */
function hashSeed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function randomInRange(
  random: () => number,
  minimum: number,
  maximum: number,
): number {
  return minimum + random() * (maximum - minimum);
}
