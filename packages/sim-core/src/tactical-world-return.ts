import type { PersistentCreatureState } from "./creature-persistence.js";
import type { TacticalBattleState } from "./tactical-combat.js";
import type { TacticalCargoOutcome } from "./tactical-cargo.js";
import type { TacticalUnit, TacticalUnitClass } from "./tactical-unit.js";
import type { TradeCaravanState, TradeCargoHold, TradeCargoStack } from "./trade-route.js";

export type WorldCombatantStatus = "alive" | "dead";

export interface WorldCaravanMemberState {
  readonly id: string;
  readonly unitClass: Exclude<TacticalUnitClass, "monster">;
  readonly health: number;
  readonly maxHealth: number;
  readonly status: WorldCombatantStatus;
}

export interface PersistentCreatureCombatState {
  readonly creature: PersistentCreatureState;
  readonly health: number;
  readonly maxHealth: number;
  readonly status: WorldCombatantStatus;
}

export interface AppliedTacticalBattleResult {
  readonly battleId: string;
  readonly winner: "caravan" | "hostile";
  readonly survivorSourceIds: readonly string[];
  readonly casualtySourceIds: readonly string[];
  readonly capturedCargo: TradeCargoHold;
  readonly destroyedCargo: readonly TradeCargoStack[];
}

export interface TacticalWorldState {
  readonly caravan: TradeCaravanState;
  readonly members: readonly WorldCaravanMemberState[];
  readonly creature: PersistentCreatureCombatState;
  readonly appliedBattleIds: readonly string[];
  readonly battleResults: readonly AppliedTacticalBattleResult[];
}

export function createTacticalWorldState(
  caravan: TradeCaravanState,
  deployedUnits: readonly TacticalUnit[],
  creature: PersistentCreatureState,
): TacticalWorldState {
  const caravanUnits = deployedUnits.filter((unit) => unit.source.kind === "caravan-member");
  const creatureUnit = deployedUnits.find((unit) => unit.source.kind === "persistent-creature");
  if (!creatureUnit || creatureUnit.source.id !== creature.id) {
    throw new RangeError("deployed persistent creature must match creature state id");
  }
  if (caravanUnits.length === 0) throw new RangeError("world caravan requires combat members");
  const memberIds = caravanUnits.map((unit) => unit.source.id);
  if (new Set(memberIds).size !== memberIds.length) throw new RangeError("caravan member source ids must be unique");
  return {
    caravan: cloneCaravan(caravan),
    members: caravanUnits.map((unit) => ({
      id: unit.source.id,
      unitClass: unit.unitClass as Exclude<TacticalUnitClass, "monster">,
      health: unit.health,
      maxHealth: unit.stats.maxHealth,
      status: unit.health > 0 ? "alive" : "dead",
    })),
    creature: {
      creature,
      health: creatureUnit.health,
      maxHealth: creatureUnit.stats.maxHealth,
      status: creatureUnit.health > 0 ? "alive" : "dead",
    },
    appliedBattleIds: [],
    battleResults: [],
  };
}

/** TACTICAL-006 — applies one complete battle to global state exactly once. */
export function applyTacticalBattleToWorld(
  state: TacticalWorldState,
  battleId: string,
  battle: TacticalBattleState,
  cargo: TacticalCargoOutcome,
): TacticalWorldState {
  if (battleId.length === 0) throw new RangeError("battleId must not be empty");
  if (state.appliedBattleIds.includes(battleId)) throw new RangeError(`battle already applied: ${battleId}`);
  if (battle.status !== "complete" || battle.winner === null) throw new RangeError("only a complete battle can return to world");
  if (cargo.winner !== battle.winner) throw new RangeError("cargo winner must match battle winner");
  assertCargoSourceMatches(state.caravan.cargo, cargo);

  const unitBySource = new Map(battle.units.map((unit) => [`${unit.source.kind}:${unit.source.id}`, unit]));
  const members = state.members.map((member) => {
    if (member.status === "dead") {
      if (unitBySource.has(`caravan-member:${member.id}`)) throw new RangeError(`dead member cannot reappear: ${member.id}`);
      return member;
    }
    const unit = unitBySource.get(`caravan-member:${member.id}`);
    if (!unit) throw new RangeError(`battle missing caravan member: ${member.id}`);
    return { ...member, health: unit.health, status: unit.health > 0 ? "alive" as const : "dead" as const };
  });
  const creatureKey = `persistent-creature:${state.creature.creature.id}`;
  if (state.creature.status === "dead" && unitBySource.has(creatureKey)) {
    throw new RangeError(`dead creature cannot reappear: ${state.creature.creature.id}`);
  }
  const creatureUnit = unitBySource.get(creatureKey);
  if (state.creature.status === "alive" && !creatureUnit) throw new RangeError("battle missing persistent creature");
  const creature = state.creature.status === "dead" || !creatureUnit
    ? state.creature
    : { ...state.creature, health: creatureUnit.health, status: creatureUnit.health > 0 ? "alive" as const : "dead" as const };

  const sourceUnits = [...members.map((member) => ({ id: member.id, status: member.status })), { id: creature.creature.id, status: creature.status }];
  const result: AppliedTacticalBattleResult = {
    battleId,
    winner: battle.winner,
    survivorSourceIds: sourceUnits.filter((entry) => entry.status === "alive").map((entry) => entry.id),
    casualtySourceIds: sourceUnits.filter((entry) => entry.status === "dead").map((entry) => entry.id),
    capturedCargo: cloneCargo(cargo.capturedCargo),
    destroyedCargo: cargo.destroyedStacks.map((stack) => ({ ...stack })),
  };
  return {
    caravan: { ...cloneCaravan(state.caravan), cargo: cloneCargo(cargo.caravanCargo) },
    members,
    creature,
    appliedBattleIds: [...state.appliedBattleIds, battleId],
    battleResults: [...state.battleResults, result],
  };
}

function assertCargoSourceMatches(source: TradeCargoHold, outcome: TacticalCargoOutcome): void {
  const accounted = [...outcome.caravanCargo.stacks, ...outcome.capturedCargo.stacks, ...outcome.destroyedStacks]
    .map((stack) => ({ ...stack }))
    .sort((a, b) => a.goodId.localeCompare(b.goodId));
  const expected = source.stacks.map((stack) => ({ ...stack })).sort((a, b) => a.goodId.localeCompare(b.goodId));
  if (JSON.stringify(accounted) !== JSON.stringify(expected)) throw new RangeError("cargo outcome must account for current caravan cargo exactly");
}

function cloneCargo(cargo: TradeCargoHold): TradeCargoHold {
  return { capacityCargoUnits: cargo.capacityCargoUnits, stacks: cargo.stacks.map((stack) => ({ ...stack })) };
}

function cloneCaravan(caravan: TradeCaravanState): TradeCaravanState {
  return { ...caravan, cargo: cloneCargo(caravan.cargo), journal: [...caravan.journal] };
}
