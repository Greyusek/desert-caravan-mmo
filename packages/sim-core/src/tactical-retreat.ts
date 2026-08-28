import { cellDistance, type TacticalBattleState } from "./tactical-combat.js";
import type { TacticalSide } from "./tactical-battlefield.js";
import type { TacticalUnit } from "./tactical-unit.js";

export const DEFAULT_TACTICAL_RETREAT_SEPARATION_CELLS = 4;

export type TacticalRetreatBlockReason =
  | "battle-complete"
  | "wrong-turn"
  | "no-living-units"
  | "not-at-retreat-edge"
  | "unsafe-separation";

export interface TacticalRetreatEvaluation {
  readonly eligible: boolean;
  readonly side: TacticalSide;
  readonly exitEdge: "west" | "east";
  readonly requiredSeparationCells: number;
  readonly minimumSeparationCells: number | null;
  readonly blockedReason: TacticalRetreatBlockReason | null;
  readonly retreatingUnitIds: readonly string[];
}

export interface TacticalRetreatOutcome {
  readonly status: "retreat-succeeded";
  readonly retreatingSide: TacticalSide;
  readonly winningSide: TacticalSide;
  readonly exitEdge: "west" | "east";
  readonly requiredSeparationCells: number;
  readonly minimumSeparationCells: number;
  readonly escapedUnits: readonly TacticalUnit[];
  readonly casualties: readonly TacticalUnit[];
  readonly finalBattleState: TacticalBattleState;
}

export function evaluateTacticalRetreat(
  state: TacticalBattleState,
  side: TacticalSide,
  requiredSeparationCells = DEFAULT_TACTICAL_RETREAT_SEPARATION_CELLS,
): TacticalRetreatEvaluation {
  assertSide(side);
  assertPositiveInteger(requiredSeparationCells, "requiredSeparationCells");
  const exitEdge: "west" | "east" = side === "caravan" ? "west" : "east";
  const retreating = livingUnits(state, side);
  const enemies = livingUnits(state, oppositeSide(side));
  const minimumSeparationCells = minimumSeparation(retreating, enemies);
  const base = {
    side,
    exitEdge,
    requiredSeparationCells,
    minimumSeparationCells,
    retreatingUnitIds: retreating.map((unit) => unit.id),
  };
  if (state.status !== "active") {
    return { ...base, eligible: false, blockedReason: "battle-complete" };
  }
  if (state.activeSide !== side) {
    return { ...base, eligible: false, blockedReason: "wrong-turn" };
  }
  if (retreating.length === 0) {
    return { ...base, eligible: false, blockedReason: "no-living-units" };
  }
  const edgeX = side === "caravan" ? 0 : state.battlefield.width - 1;
  if (retreating.some((unit) => unit.position.x !== edgeX)) {
    return { ...base, eligible: false, blockedReason: "not-at-retreat-edge" };
  }
  if (
    minimumSeparationCells === null ||
    minimumSeparationCells < requiredSeparationCells
  ) {
    return { ...base, eligible: false, blockedReason: "unsafe-separation" };
  }
  return { ...base, eligible: true, blockedReason: null };
}

/** TACTICAL-005 — exits living units without converting them into casualties. */
export function executeTacticalRetreat(
  state: TacticalBattleState,
  side: TacticalSide,
  requiredSeparationCells = DEFAULT_TACTICAL_RETREAT_SEPARATION_CELLS,
): TacticalRetreatOutcome {
  const evaluation = evaluateTacticalRetreat(
    state,
    side,
    requiredSeparationCells,
  );
  if (!evaluation.eligible || evaluation.minimumSeparationCells === null) {
    throw new RangeError(`tactical retreat blocked: ${evaluation.blockedReason}`);
  }
  const escapedUnits = livingUnits(state, side).map(cloneUnit);
  const winningSide = oppositeSide(side);
  return {
    status: "retreat-succeeded",
    retreatingSide: side,
    winningSide,
    exitEdge: evaluation.exitEdge,
    requiredSeparationCells,
    minimumSeparationCells: evaluation.minimumSeparationCells,
    escapedUnits,
    casualties: [],
    finalBattleState: {
      ...state,
      status: "complete",
      winner: winningSide,
      units: state.units.map(cloneUnit),
    },
  };
}

function livingUnits(
  state: TacticalBattleState,
  side: TacticalSide,
): readonly TacticalUnit[] {
  return state.units.filter((unit) => unit.side === side && unit.health > 0);
}

function minimumSeparation(
  retreating: readonly TacticalUnit[],
  enemies: readonly TacticalUnit[],
): number | null {
  if (retreating.length === 0 || enemies.length === 0) return null;
  let minimum = Number.POSITIVE_INFINITY;
  for (const unit of retreating) {
    for (const enemy of enemies) {
      minimum = Math.min(minimum, cellDistance(unit.position, enemy.position));
    }
  }
  return minimum;
}

function cloneUnit(unit: TacticalUnit): TacticalUnit {
  return {
    ...unit,
    source: { ...unit.source },
    position: { ...unit.position },
    stats: { ...unit.stats },
  };
}

function oppositeSide(side: TacticalSide): TacticalSide {
  return side === "caravan" ? "hostile" : "caravan";
}

function assertSide(side: TacticalSide): void {
  if (side !== "caravan" && side !== "hostile") {
    throw new RangeError("side must be caravan or hostile");
  }
}

function assertPositiveInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive safe integer`);
  }
}
