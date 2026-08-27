import {
  wanderingMonsterPositionAtTime,
  type WanderingMonster,
} from "./monster.js";
import type { DurationSeconds } from "./route.js";
import type { DistanceMeters, WorldCoordinate } from "./types.js";

export const DETAILED_CREATURE_SIMULATION_RADIUS_METERS = 5_000;
export const REGIONAL_CREATURE_SIMULATION_RADIUS_METERS = 50_000;
export const CREATURE_POPULATION_DAY_SECONDS = 24 * 60 * 60;

export type CreatureSimulationDetail =
  | "detailed"
  | "regional"
  | "population";

export interface PersistentCreatureState {
  readonly id: string;
  readonly speciesId: string;
  readonly monster: WanderingMonster;
  readonly bornAtWorldTimeSeconds: DurationSeconds;
  readonly lastSimulatedAtWorldTimeSeconds: DurationSeconds;
  readonly detailLevel: CreatureSimulationDetail;
  readonly position: WorldCoordinate;
  readonly survivalSeconds: DurationSeconds;
  readonly travelledDistanceMeters: DistanceMeters;
}

export interface CreaturePopulationState {
  readonly id: string;
  readonly speciesId: string;
  readonly regionId: string;
  readonly lastSimulatedAtWorldTimeSeconds: DurationSeconds;
  readonly detailLevel: "population";
  readonly exactIndividuals: number;
  readonly individuals: number;
  readonly carryingCapacity: number;
  readonly dailyGrowthRate: number;
}

export function selectCreatureSimulationDetail(
  observerDistanceMeters: DistanceMeters,
): CreatureSimulationDetail {
  assertNonNegativeFinite(observerDistanceMeters, "observerDistanceMeters");
  if (observerDistanceMeters <= DETAILED_CREATURE_SIMULATION_RADIUS_METERS) {
    return "detailed";
  }
  if (observerDistanceMeters <= REGIONAL_CREATURE_SIMULATION_RADIUS_METERS) {
    return "regional";
  }
  return "population";
}

export function createPersistentCreatureState(
  monster: WanderingMonster,
  speciesId: string,
  bornAtWorldTimeSeconds: DurationSeconds = 0,
): PersistentCreatureState {
  assertNonEmptyString(monster.id, "monster.id");
  assertNonEmptyString(speciesId, "speciesId");
  assertNonNegativeFinite(
    bornAtWorldTimeSeconds,
    "bornAtWorldTimeSeconds",
  );
  const projection = wanderingMonsterPositionAtTime(monster, 0);
  return {
    id: `persistent-${monster.id}`,
    speciesId,
    monster,
    bornAtWorldTimeSeconds,
    lastSimulatedAtWorldTimeSeconds: bornAtWorldTimeSeconds,
    detailLevel: "detailed",
    position: projection.coordinate,
    survivalSeconds: 0,
    travelledDistanceMeters: 0,
  };
}

/**
 * HISTORY-002 — catches one identity up directly from absolute world time.
 * Patrol position is projected by the existing cyclic route solver, so the
 * result does not depend on frame frequency or previous detail level.
 */
export function catchUpPersistentCreature(
  state: PersistentCreatureState,
  worldTimeSeconds: DurationSeconds,
  detailLevel: CreatureSimulationDetail,
): PersistentCreatureState {
  assertCreatureState(state);
  assertNonNegativeFinite(worldTimeSeconds, "worldTimeSeconds");
  assertDetailLevel(detailLevel);
  if (worldTimeSeconds < state.lastSimulatedAtWorldTimeSeconds) {
    throw new RangeError("worldTimeSeconds must not rewind creature state");
  }
  const survivalSeconds = worldTimeSeconds - state.bornAtWorldTimeSeconds;
  const projection = wanderingMonsterPositionAtTime(
    state.monster,
    survivalSeconds,
  );
  return {
    ...state,
    lastSimulatedAtWorldTimeSeconds: worldTimeSeconds,
    detailLevel,
    position: projection.coordinate,
    survivalSeconds,
    travelledDistanceMeters:
      state.monster.patrolRoute.speedMetersPerSecond * survivalSeconds,
  };
}

export function createCreaturePopulationState(
  speciesId: string,
  regionId: string,
  individuals: number,
  carryingCapacity: number,
  dailyGrowthRate: number,
  worldTimeSeconds: DurationSeconds = 0,
): CreaturePopulationState {
  assertNonEmptyString(speciesId, "speciesId");
  assertNonEmptyString(regionId, "regionId");
  assertNonNegativeFinite(worldTimeSeconds, "worldTimeSeconds");
  if (!Number.isSafeInteger(individuals) || individuals < 0) {
    throw new RangeError("individuals must be a non-negative safe integer");
  }
  if (!Number.isSafeInteger(carryingCapacity) || carryingCapacity <= 0) {
    throw new RangeError("carryingCapacity must be a positive safe integer");
  }
  if (individuals > carryingCapacity) {
    throw new RangeError("individuals must not exceed carryingCapacity");
  }
  if (!Number.isFinite(dailyGrowthRate)) {
    throw new RangeError("dailyGrowthRate must be finite");
  }
  return {
    id: `population-${regionId}-${speciesId}`,
    speciesId,
    regionId,
    lastSimulatedAtWorldTimeSeconds: worldTimeSeconds,
    detailLevel: "population",
    exactIndividuals: individuals,
    individuals,
    carryingCapacity,
    dailyGrowthRate,
  };
}

/** Closed-form logistic catch-up composes across any update cadence. */
export function catchUpCreaturePopulation(
  state: CreaturePopulationState,
  worldTimeSeconds: DurationSeconds,
): CreaturePopulationState {
  assertPopulationState(state);
  assertNonNegativeFinite(worldTimeSeconds, "worldTimeSeconds");
  if (worldTimeSeconds < state.lastSimulatedAtWorldTimeSeconds) {
    throw new RangeError("worldTimeSeconds must not rewind population state");
  }
  const elapsedDays =
    (worldTimeSeconds - state.lastSimulatedAtWorldTimeSeconds) /
    CREATURE_POPULATION_DAY_SECONDS;
  const exactIndividuals = logisticProjection(
    state.exactIndividuals,
    state.carryingCapacity,
    state.dailyGrowthRate,
    elapsedDays,
  );
  return {
    ...state,
    lastSimulatedAtWorldTimeSeconds: worldTimeSeconds,
    exactIndividuals,
    individuals: Math.max(0, Math.floor(exactIndividuals + 1e-9)),
  };
}

function logisticProjection(
  initial: number,
  capacity: number,
  rate: number,
  elapsedDays: number,
): number {
  if (initial === 0 || elapsedDays === 0 || rate === 0) return initial;
  const ratio = (capacity - initial) / initial;
  return capacity / (1 + ratio * Math.exp(-rate * elapsedDays));
}

function assertCreatureState(state: PersistentCreatureState): void {
  assertNonEmptyString(state.id, "state.id");
  assertNonEmptyString(state.speciesId, "state.speciesId");
  assertNonNegativeFinite(
    state.bornAtWorldTimeSeconds,
    "state.bornAtWorldTimeSeconds",
  );
  assertNonNegativeFinite(
    state.lastSimulatedAtWorldTimeSeconds,
    "state.lastSimulatedAtWorldTimeSeconds",
  );
}

function assertPopulationState(state: CreaturePopulationState): void {
  assertNonEmptyString(state.id, "state.id");
  if (!Number.isFinite(state.exactIndividuals) || state.exactIndividuals < 0) {
    throw new RangeError("state.exactIndividuals must be non-negative and finite");
  }
  if (
    !Number.isSafeInteger(state.carryingCapacity) ||
    state.carryingCapacity <= 0
  ) {
    throw new RangeError("state.carryingCapacity must be a positive safe integer");
  }
  if (!Number.isFinite(state.dailyGrowthRate)) {
    throw new RangeError("state.dailyGrowthRate must be finite");
  }
}

function assertDetailLevel(
  value: string,
): asserts value is CreatureSimulationDetail {
  if (
    value !== "detailed" &&
    value !== "regional" &&
    value !== "population"
  ) {
    throw new RangeError("detailLevel is invalid");
  }
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
