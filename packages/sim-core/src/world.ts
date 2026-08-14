import { createWorldCoordinate, type WorldCoordinate } from "./types.js";

export interface City {
  readonly id: string;
  readonly name: string;
  readonly position: WorldCoordinate;
}

export interface SeededWorld {
  readonly seed: string;
  readonly cities: readonly City[];
}

export interface WorldGenerationOptions {
  readonly cityCount?: number;
}

const DEFAULT_CITY_COUNT = 10;
const CITY_NAME_PREFIX = "City";

/**
 * WORLD-001 — creates the first reproducible world layer.
 *
 * The generator is deliberately independent from server storage. A seed and the
 * same options always produce the same ordered city list.
 */
export function generateSeededWorld(
  seed: string,
  options: WorldGenerationOptions = {},
): SeededWorld {
  if (seed.length === 0) {
    throw new RangeError("seed must not be empty");
  }

  const cityCount = options.cityCount ?? DEFAULT_CITY_COUNT;
  if (!Number.isSafeInteger(cityCount) || cityCount <= 0) {
    throw new RangeError("cityCount must be a positive safe integer");
  }

  const random = mulberry32(hashSeed(seed));
  const cities = Array.from({ length: cityCount }, (_, index): City => ({
    id: `city-${String(index + 1).padStart(2, "0")}`,
    name: `${CITY_NAME_PREFIX} ${String(index + 1).padStart(2, "0")}`,
    position: createWorldCoordinate(
      randomInRange(random, -70, 70),
      randomInRange(random, -180, 180),
    ),
  }));

  return { seed, cities };
}

/** FNV-1a over UTF-16 code units, kept local so world generation stays dependency-free. */
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

function randomInRange(random: () => number, minimum: number, maximum: number): number {
  return minimum + random() * (maximum - minimum);
}
