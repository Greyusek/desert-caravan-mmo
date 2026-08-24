import { destinationPoint, greatCircleDistance } from "./geometry.js";
import {
  DEFAULT_INTERACTION_RADIUS_METERS,
  DEFAULT_VISIBLE_TARGET_RADIUS_METERS,
  DEFAULT_WANDERING_MONSTER_SPEED_METERS_PER_SECOND,
  type WanderingMonster,
} from "./monster.js";
import { createRoutePlan, type RouteCommand } from "./route.js";
import {
  createWorldCoordinate,
  normalizeBearing,
  type WorldCoordinate,
} from "./types.js";

export interface City {
  readonly id: string;
  readonly name: string;
  readonly position: WorldCoordinate;
}

export interface CityStocks {
  readonly cityId: string;
  readonly foodUnits: number;
  readonly waterUnits: number;
}

export interface SeededWorld {
  readonly seed: string;
  readonly cities: readonly City[];
  readonly cityStocks: readonly CityStocks[];
  readonly staticObjects: readonly StaticWorldObject[];
  readonly wanderingMonsters: readonly WanderingMonster[];
}

export type StaticWorldObjectKind = "oasis" | "mine" | "ruins" | "cave";

export interface StaticWorldObject {
  readonly id: string;
  readonly kind: StaticWorldObjectKind;
  readonly position: WorldCoordinate;
}

export type StaticWorldObjectCounts = Partial<
  Readonly<Record<StaticWorldObjectKind, number>>
>;

export interface WorldGenerationOptions {
  readonly cityCount?: number;
  readonly staticObjectCounts?: StaticWorldObjectCounts;
  readonly wanderingMonsterCount?: number;
}

const DEFAULT_CITY_COUNT = 10;
const CITY_NAME_PREFIX = "City";
const STATIC_OBJECT_KINDS = ["oasis", "mine", "ruins", "cave"] as const;
const DEFAULT_STATIC_OBJECT_COUNT = 1;
const DEFAULT_WANDERING_MONSTER_COUNT = 1;
const WANDERING_MONSTER_MINIMUM_LEG_METERS = 4_000;
const WANDERING_MONSTER_MAXIMUM_LEG_METERS = 12_000;
const CITY_MINIMUM_STOCK_UNITS = 10_000;
const CITY_MAXIMUM_STOCK_UNITS = 50_000;

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
  const cityStocks = cities.map((city): CityStocks => {
    const stockRandom = mulberry32(hashSeed(`${seed}:city-stocks:${city.id}`));
    return {
      cityId: city.id,
      foodUnits: randomSafeIntegerInRange(
        stockRandom,
        CITY_MINIMUM_STOCK_UNITS,
        CITY_MAXIMUM_STOCK_UNITS,
      ),
      waterUnits: randomSafeIntegerInRange(
        stockRandom,
        CITY_MINIMUM_STOCK_UNITS,
        CITY_MAXIMUM_STOCK_UNITS,
      ),
    };
  });

  const staticObjects = STATIC_OBJECT_KINDS.flatMap((kind) => {
    const count = options.staticObjectCounts?.[kind] ?? DEFAULT_STATIC_OBJECT_COUNT;
    assertStaticObjectCount(count, kind);

    // A stream per kind prevents counts in one category (or cities) from
    // perturbing the positions generated for any other category.
    const kindRandom = mulberry32(hashSeed(`${seed}:static-object:${kind}`));
    return Array.from({ length: count }, (_, index): StaticWorldObject => ({
      id: `${kind}-${String(index + 1).padStart(2, "0")}`,
      kind,
      position: createWorldCoordinate(
        randomInRange(kindRandom, -70, 70),
        randomInRange(kindRandom, -180, 180),
      ),
    }));
  });

  const wanderingMonsterCount =
    options.wanderingMonsterCount ?? DEFAULT_WANDERING_MONSTER_COUNT;
  assertWanderingMonsterCount(wanderingMonsterCount);

  const wanderingMonsters = Array.from(
    { length: wanderingMonsterCount },
    (_, index): WanderingMonster => createWanderingMonster(seed, index),
  );

  return { seed, cities, cityStocks, staticObjects, wanderingMonsters };
}

function assertStaticObjectCount(count: number, kind: StaticWorldObjectKind): void {
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new RangeError(`staticObjectCounts.${kind} must be a non-negative safe integer`);
  }
}

function assertWanderingMonsterCount(count: number): void {
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new RangeError(
      "wanderingMonsterCount must be a non-negative safe integer",
    );
  }
}

function createWanderingMonster(seed: string, index: number): WanderingMonster {
  const sequence = index + 1;
  const random = mulberry32(hashSeed(`${seed}:wandering-monster:${sequence}`));
  const start = createWorldCoordinate(
    randomInRange(random, -60, 60),
    randomInRange(random, -180, 180),
  );
  const firstBearing = randomInRange(random, 0, 360);
  const firstDistance = randomInRange(
    random,
    WANDERING_MONSTER_MINIMUM_LEG_METERS,
    WANDERING_MONSTER_MAXIMUM_LEG_METERS,
  );
  const secondBearing = normalizeBearing(
    firstBearing + randomInRange(random, 70, 160),
  );
  const secondDistance = randomInRange(
    random,
    WANDERING_MONSTER_MINIMUM_LEG_METERS,
    WANDERING_MONSTER_MAXIMUM_LEG_METERS,
  );
  const firstEnd = destinationPoint(start, firstBearing, firstDistance);
  const secondEnd = destinationPoint(firstEnd, secondBearing, secondDistance);
  const closingDistance = greatCircleDistance(secondEnd, start);
  const commands: readonly RouteCommand[] = [
    { bearingDeg: firstBearing, distanceMeters: firstDistance },
    { bearingDeg: secondBearing, distanceMeters: secondDistance },
    {
      bearingDeg: initialBearingDegrees(secondEnd, start),
      distanceMeters: closingDistance,
    },
  ];

  return {
    id: `wandering-monster-${String(sequence).padStart(2, "0")}`,
    kind: "wandering-monster",
    power: index % 2 === 0 ? 90 : 110,
    visionRadiusMeters: DEFAULT_VISIBLE_TARGET_RADIUS_METERS,
    interactionRadiusMeters: DEFAULT_INTERACTION_RADIUS_METERS,
    patrolRoute: createRoutePlan(
      start,
      commands,
      DEFAULT_WANDERING_MONSTER_SPEED_METERS_PER_SECOND,
    ),
  };
}

function initialBearingDegrees(
  start: WorldCoordinate,
  destination: WorldCoordinate,
): number {
  const degreesToRadians = Math.PI / 180;
  const radiansToDegrees = 180 / Math.PI;
  const startLatitude = start.latitudeDeg * degreesToRadians;
  const destinationLatitude = destination.latitudeDeg * degreesToRadians;
  const longitudeDelta =
    (destination.longitudeDeg - start.longitudeDeg) * degreesToRadians;
  const y = Math.sin(longitudeDelta) * Math.cos(destinationLatitude);
  const x =
    Math.cos(startLatitude) * Math.sin(destinationLatitude) -
    Math.sin(startLatitude) *
      Math.cos(destinationLatitude) *
      Math.cos(longitudeDelta);

  if (Math.abs(x) + Math.abs(y) < Number.EPSILON) return 0;
  return normalizeBearing(Math.atan2(y, x) * radiansToDegrees);
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

function randomSafeIntegerInRange(
  random: () => number,
  minimum: number,
  maximum: number,
): number {
  return Math.floor(randomInRange(random, minimum, maximum + 1));
}
