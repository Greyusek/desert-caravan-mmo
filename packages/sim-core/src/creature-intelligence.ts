import { approximateTravelDirection } from "./caravan-track.js";
import type { PersistentCreatureState } from "./creature-persistence.js";
import type { DurationSeconds } from "./route.js";
import { rumorAge, type WorldRumorAge } from "./world-rumor.js";

export type CreatureStrengthEstimate = "weak" | "dangerous" | "overwhelming";

export type CreatureObservedColor =
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "cyan"
  | "blue"
  | "violet"
  | "white"
  | "black"
  | "unknown";

export interface CreatureColorIntelligence {
  readonly armorColor: CreatureObservedColor;
  readonly physicalAttackColor: CreatureObservedColor;
  readonly magicColor: CreatureObservedColor;
}

export interface CreatureIntelligenceReportInput {
  readonly state: PersistentCreatureState;
  readonly recordedAtWorldTimeSeconds: DurationSeconds;
  readonly abilities: readonly string[];
  readonly colors: CreatureColorIntelligence;
}

/** Coordinate-free creature intelligence safe for player knowledge. */
export interface CreatureIntelligenceReport {
  readonly id: string;
  readonly kind: "creature-intelligence";
  readonly creatureId: string;
  readonly speciesId: string;
  readonly observedAtWorldTimeSeconds: DurationSeconds;
  readonly recordedAtWorldTimeSeconds: DurationSeconds;
  readonly approximateAge: WorldRumorAge;
  readonly approximateDirection: ReturnType<typeof approximateTravelDirection>;
  readonly strength: CreatureStrengthEstimate;
  readonly abilities: readonly string[];
  readonly colors: CreatureColorIntelligence;
}

/**
 * HISTORY-003 — projects a persistent creature observation into deliberately
 * limited player-facing intelligence. Position and route never cross this API.
 * Color values are observations only; System 256 interaction math stays gated.
 */
export function createCreatureIntelligenceReport(
  input: CreatureIntelligenceReportInput,
): CreatureIntelligenceReport {
  const observedAt = input.state.lastSimulatedAtWorldTimeSeconds;
  assertNonNegativeFinite(
    input.recordedAtWorldTimeSeconds,
    "recordedAtWorldTimeSeconds",
  );
  if (input.recordedAtWorldTimeSeconds < observedAt) {
    throw new RangeError("recordedAtWorldTimeSeconds must not precede observation");
  }
  const abilities = [...new Set(input.abilities)].sort(compareRaw);
  if (abilities.length !== input.abilities.length) {
    throw new RangeError("abilities must be unique");
  }
  for (const ability of abilities) {
    assertNonEmptyString(ability, "ability");
  }
  assertColor(input.colors.armorColor, "colors.armorColor");
  assertColor(input.colors.physicalAttackColor, "colors.physicalAttackColor");
  assertColor(input.colors.magicColor, "colors.magicColor");
  const segment =
    input.state.monster.patrolRoute.segments[currentSegmentIndex(input.state)];
  if (!segment) throw new RangeError("creature patrol must contain a segment");
  const identity = `${input.state.id}:${observedAt}:${input.recordedAtWorldTimeSeconds}`;
  return {
    id: `creature-intel-${hashSeed(identity).toString(16).padStart(8, "0")}`,
    kind: "creature-intelligence",
    creatureId: input.state.id,
    speciesId: input.state.speciesId,
    observedAtWorldTimeSeconds: observedAt,
    recordedAtWorldTimeSeconds: input.recordedAtWorldTimeSeconds,
    approximateAge: rumorAge(input.recordedAtWorldTimeSeconds - observedAt),
    approximateDirection: approximateTravelDirection(segment.bearingDeg),
    strength: estimateCreatureStrength(input.state.monster.power),
    abilities,
    colors: { ...input.colors },
  };
}

export function estimateCreatureStrength(power: number): CreatureStrengthEstimate {
  if (!Number.isFinite(power) || power < 0) {
    throw new RangeError("power must be a non-negative finite number");
  }
  if (power <= 90) return "weak";
  if (power <= 110) return "dangerous";
  return "overwhelming";
}

function currentSegmentIndex(state: PersistentCreatureState): number {
  const duration = state.monster.patrolRoute.totalDurationSeconds;
  if (!(duration > 0)) throw new RangeError("creature patrol must have duration");
  const elapsed = state.survivalSeconds % duration;
  const segment = state.monster.patrolRoute.segments.find(
    (candidate) => elapsed < candidate.etaEndSeconds,
  );
  return segment?.index ?? state.monster.patrolRoute.segments.length - 1;
}

function assertColor(value: string, name: string): void {
  const colors: readonly CreatureObservedColor[] = [
    "red", "orange", "yellow", "green", "cyan", "blue", "violet",
    "white", "black", "unknown",
  ];
  if (!colors.includes(value as CreatureObservedColor)) {
    throw new RangeError(`${name} is invalid`);
  }
}

function compareRaw(first: string, second: string): number {
  return first < second ? -1 : first > second ? 1 : 0;
}

function assertNonEmptyString(value: string, name: string): void {
  if (typeof value !== "string" || value.length === 0) {
    throw new RangeError(`${name} must not be empty`);
  }
}

function assertNonNegativeFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative finite number`);
  }
}

function hashSeed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
