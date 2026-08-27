import {
  npcCaravanPositionAtWorldTime,
  type NpcCaravan,
} from "./npc-caravan.js";
import type { DurationSeconds } from "./route.js";
import type { WorldCoordinate } from "./types.js";

export const CARAVAN_REMAINS_FULL_DEGRADATION_SECONDS = 7 * 24 * 60 * 60;

export type CaravanDestructionCause =
  | "monster-contact"
  | "caravan-contact"
  | "supply-depletion";
export type CaravanRemainsCondition = "fresh" | "weathered" | "ruined";

/** Temporary minimal value stub, not a production inventory or economy. */
export interface MinimalCaravanLoot {
  readonly foodUnits: number;
  readonly waterUnits: number;
  readonly salvageUnits: number;
}

/** Permanent authoritative world object. Position stays server-side. */
export interface CaravanRemains {
  readonly id: string;
  readonly kind: "caravan-remains";
  readonly sourceCaravanId: string;
  readonly position: WorldCoordinate;
  readonly destroyedAtWorldTimeSeconds: DurationSeconds;
  readonly destructionCause: CaravanDestructionCause;
  readonly initialLoot: MinimalCaravanLoot;
  readonly recoveredLoot: MinimalCaravanLoot;
}

export interface ProjectedCaravanRemains {
  readonly remains: CaravanRemains;
  readonly worldTimeSeconds: DurationSeconds;
  readonly ageSeconds: DurationSeconds;
  readonly integrityFraction: number;
  readonly condition: CaravanRemainsCondition;
  readonly naturallyRemainingLoot: MinimalCaravanLoot;
  readonly availableLoot: MinimalCaravanLoot;
  readonly permanentlyPresent: true;
}

export interface CaravanLootRecovery {
  readonly remains: CaravanRemains;
  readonly recovered: MinimalCaravanLoot;
  readonly worldTimeSeconds: DurationSeconds;
}

/**
 * CONSEQUENCE-001 — converts one destroyed NPC into permanent world remains at
 * its exact authoritative position. The generated loot is a deterministic,
 * deliberately tiny stub used only to prove physical consequences.
 */
export function createNpcCaravanRemains(
  worldSeed: string,
  caravan: NpcCaravan,
  destroyedAtWorldTimeSeconds: DurationSeconds,
  destructionCause: CaravanDestructionCause,
): CaravanRemains {
  if (worldSeed.length === 0) {
    throw new RangeError("worldSeed must not be empty");
  }
  if (caravan.id.length === 0) {
    throw new RangeError("caravan.id must not be empty");
  }
  assertNonNegativeFinite(
    destroyedAtWorldTimeSeconds,
    "destroyedAtWorldTimeSeconds",
  );
  assertDestructionCause(destructionCause);
  const position = npcCaravanPositionAtWorldTime(
    caravan,
    destroyedAtWorldTimeSeconds,
  ).coordinate;
  const sourceKey = `${worldSeed}:consequence-001:${caravan.id}:${destroyedAtWorldTimeSeconds}:${destructionCause}`;
  const random = mulberry32(hashSeed(sourceKey));
  const initialLoot: MinimalCaravanLoot = {
    foodUnits: randomInteger(random, 4, 9),
    waterUnits: randomInteger(random, 3, 8),
    salvageUnits: randomInteger(random, 2, 5),
  };

  return {
    id: `remains-${hashSeed(sourceKey).toString(16).padStart(8, "0")}`,
    kind: "caravan-remains",
    sourceCaravanId: caravan.id,
    position,
    destroyedAtWorldTimeSeconds,
    destructionCause,
    initialLoot,
    recoveredLoot: zeroLoot(),
  };
}

/** Projects decay without deleting the world object, even after all loot is gone. */
export function projectCaravanRemainsAtWorldTime(
  remains: CaravanRemains,
  worldTimeSeconds: DurationSeconds,
): ProjectedCaravanRemains {
  assertNonNegativeFinite(worldTimeSeconds, "worldTimeSeconds");
  assertNonNegativeFinite(
    remains.destroyedAtWorldTimeSeconds,
    "remains.destroyedAtWorldTimeSeconds",
  );
  if (worldTimeSeconds < remains.destroyedAtWorldTimeSeconds) {
    throw new RangeError("worldTimeSeconds must not precede destruction");
  }
  assertLoot(remains.initialLoot, "remains.initialLoot");
  assertLoot(remains.recoveredLoot, "remains.recoveredLoot");

  const ageSeconds = worldTimeSeconds - remains.destroyedAtWorldTimeSeconds;
  const integrityFraction = Math.max(
    0,
    1 - ageSeconds / CARAVAN_REMAINS_FULL_DEGRADATION_SECONDS,
  );
  const naturallyRemainingLoot = scaleLoot(
    remains.initialLoot,
    integrityFraction,
  );
  const availableLoot = subtractLoot(
    naturallyRemainingLoot,
    remains.recoveredLoot,
  );
  const condition: CaravanRemainsCondition =
    integrityFraction >= 0.75
      ? "fresh"
      : integrityFraction > 0
        ? "weathered"
        : "ruined";

  return {
    remains,
    worldTimeSeconds,
    ageSeconds,
    integrityFraction,
    condition,
    naturallyRemainingLoot,
    availableLoot,
    permanentlyPresent: true,
  };
}

/** Recovers all currently available stub loot; repeating it yields zero. */
export function recoverCaravanRemainsLoot(
  remains: CaravanRemains,
  worldTimeSeconds: DurationSeconds,
): CaravanLootRecovery {
  const projection = projectCaravanRemainsAtWorldTime(
    remains,
    worldTimeSeconds,
  );
  const recovered = projection.availableLoot;
  return {
    remains: {
      ...remains,
      recoveredLoot: addLoot(remains.recoveredLoot, recovered),
    },
    recovered,
    worldTimeSeconds,
  };
}

function scaleLoot(
  loot: MinimalCaravanLoot,
  fraction: number,
): MinimalCaravanLoot {
  return {
    foodUnits: Math.floor(loot.foodUnits * fraction + 1e-9),
    waterUnits: Math.floor(loot.waterUnits * fraction + 1e-9),
    salvageUnits: Math.floor(loot.salvageUnits * fraction + 1e-9),
  };
}

function subtractLoot(
  left: MinimalCaravanLoot,
  right: MinimalCaravanLoot,
): MinimalCaravanLoot {
  return {
    foodUnits: Math.max(0, left.foodUnits - right.foodUnits),
    waterUnits: Math.max(0, left.waterUnits - right.waterUnits),
    salvageUnits: Math.max(0, left.salvageUnits - right.salvageUnits),
  };
}

function addLoot(
  left: MinimalCaravanLoot,
  right: MinimalCaravanLoot,
): MinimalCaravanLoot {
  return {
    foodUnits: left.foodUnits + right.foodUnits,
    waterUnits: left.waterUnits + right.waterUnits,
    salvageUnits: left.salvageUnits + right.salvageUnits,
  };
}

function zeroLoot(): MinimalCaravanLoot {
  return { foodUnits: 0, waterUnits: 0, salvageUnits: 0 };
}

function assertDestructionCause(
  value: string,
): asserts value is CaravanDestructionCause {
  if (
    value !== "monster-contact" &&
    value !== "caravan-contact" &&
    value !== "supply-depletion"
  ) {
    throw new RangeError("destructionCause is invalid");
  }
}

function assertLoot(loot: MinimalCaravanLoot, name: string): void {
  for (const [key, value] of Object.entries(loot)) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new RangeError(`${name}.${key} must be a non-negative safe integer`);
    }
  }
}

function assertNonNegativeFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative finite number`);
  }
}

function randomInteger(
  random: () => number,
  minimum: number,
  maximum: number,
): number {
  return minimum + Math.floor(random() * (maximum - minimum + 1));
}

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
