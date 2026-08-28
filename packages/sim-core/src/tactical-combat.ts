import {
  isCellInsideBattlefield,
  type TacticalBattlefield,
  type TacticalCell,
  type TacticalSide,
} from "./tactical-battlefield.js";
import type { TacticalUnit } from "./tactical-unit.js";

export type TacticalBattleStatus = "active" | "complete";
export type TacticalCommand =
  | { readonly kind: "MOVE"; readonly unitId: string; readonly to: TacticalCell }
  | { readonly kind: "ATTACK"; readonly unitId: string; readonly targetUnitId: string }
  | { readonly kind: "WAIT"; readonly unitId: string };

export type TacticalCombatEvent =
  | {
      readonly sequence: number;
      readonly kind: "moved";
      readonly side: TacticalSide;
      readonly unitId: string;
      readonly from: TacticalCell;
      readonly to: TacticalCell;
    }
  | {
      readonly sequence: number;
      readonly kind: "attacked";
      readonly side: TacticalSide;
      readonly unitId: string;
      readonly targetUnitId: string;
      readonly damage: number;
      readonly targetHealth: number;
      readonly targetDefeated: boolean;
    }
  | {
      readonly sequence: number;
      readonly kind: "waited";
      readonly side: TacticalSide;
      readonly unitId: string;
    };

export interface TacticalBattleState {
  readonly battlefield: TacticalBattlefield;
  readonly units: readonly TacticalUnit[];
  readonly activeSide: TacticalSide;
  readonly turn: number;
  readonly status: TacticalBattleStatus;
  readonly winner: TacticalSide | null;
  readonly events: readonly TacticalCombatEvent[];
}

export function createTacticalBattleState(
  battlefield: TacticalBattlefield,
  units: readonly TacticalUnit[],
  firstSide: TacticalSide = "caravan",
): TacticalBattleState {
  assertSide(firstSide);
  assertUnitSet(battlefield, units);
  if (!hasLivingSide(units, "caravan") || !hasLivingSide(units, "hostile")) {
    throw new RangeError("battle must start with one living unit on each side");
  }
  return {
    battlefield,
    units: units.map(cloneUnit),
    activeSide: firstSide,
    turn: 1,
    status: "active",
    winner: null,
    events: [],
  };
}

/** TACTICAL-003 — resolves one authoritative command without hidden randomness. */
export function executeTacticalCommand(
  state: TacticalBattleState,
  command: TacticalCommand,
): TacticalBattleState {
  if (state.status !== "active") throw new Error("battle is already complete");
  const actorIndex = findLivingUnitIndex(state.units, command.unitId);
  const actor = state.units[actorIndex];
  if (actor === undefined) throw new Error("living actor must exist");
  if (actor.side !== state.activeSide) {
    throw new RangeError(`it is ${state.activeSide}'s turn`);
  }

  const sequence = state.events.length + 1;
  let units = state.units.map(cloneUnit);
  let event: TacticalCombatEvent;
  if (command.kind === "MOVE") {
    assertCell(command.to, "command.to");
    if (!isCellInsideBattlefield(state.battlefield, command.to)) {
      throw new RangeError("move target must be inside battlefield");
    }
    if (unitAt(units, command.to) !== undefined) {
      throw new RangeError("move target cell is occupied");
    }
    const distance = cellDistance(actor.position, command.to);
    if (distance < 1 || distance > actor.stats.movementCells) {
      throw new RangeError("move exceeds unit movement allowance");
    }
    units[actorIndex] = { ...actor, position: { ...command.to } };
    event = {
      sequence,
      kind: "moved",
      side: actor.side,
      unitId: actor.id,
      from: { ...actor.position },
      to: { ...command.to },
    };
  } else if (command.kind === "ATTACK") {
    const targetIndex = findLivingUnitIndex(units, command.targetUnitId);
    const target = units[targetIndex];
    if (target === undefined) throw new Error("living target must exist");
    if (target.side === actor.side) throw new RangeError("cannot attack an ally");
    if (cellDistance(actor.position, target.position) > actor.stats.attackRangeCells) {
      throw new RangeError("target is outside attack range");
    }
    const targetHealth = Math.max(0, target.health - actor.stats.attackDamage);
    units[targetIndex] = { ...target, health: targetHealth };
    event = {
      sequence,
      kind: "attacked",
      side: actor.side,
      unitId: actor.id,
      targetUnitId: target.id,
      damage: actor.stats.attackDamage,
      targetHealth,
      targetDefeated: targetHealth === 0,
    };
  } else if (command.kind === "WAIT") {
    event = {
      sequence,
      kind: "waited",
      side: actor.side,
      unitId: actor.id,
    };
  } else {
    throw new RangeError("command kind must be MOVE, ATTACK or WAIT");
  }

  const caravanAlive = hasLivingSide(units, "caravan");
  const hostileAlive = hasLivingSide(units, "hostile");
  const winner = caravanAlive && !hostileAlive ? "caravan" : !caravanAlive && hostileAlive ? "hostile" : null;
  return {
    battlefield: state.battlefield,
    units,
    activeSide: winner === null ? oppositeSide(state.activeSide) : state.activeSide,
    turn: state.turn + 1,
    status: winner === null ? "active" : "complete",
    winner,
    events: [...state.events, event],
  };
}

export function cellDistance(left: TacticalCell, right: TacticalCell): number {
  assertCell(left, "left");
  assertCell(right, "right");
  return Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
}

function assertUnitSet(
  battlefield: TacticalBattlefield,
  units: readonly TacticalUnit[],
): void {
  const ids = new Set<string>();
  const cells = new Set<string>();
  for (const unit of units) {
    if (ids.has(unit.id)) throw new RangeError(`duplicate unit id: ${unit.id}`);
    if (!isCellInsideBattlefield(battlefield, unit.position)) {
      throw new RangeError(`unit outside battlefield: ${unit.id}`);
    }
    if (!Number.isInteger(unit.health) || unit.health < 0 || unit.health > unit.stats.maxHealth) {
      throw new RangeError(`invalid unit health: ${unit.id}`);
    }
    const key = `${unit.position.x},${unit.position.y}`;
    if (unit.health > 0 && cells.has(key)) throw new RangeError(`occupied cell: ${key}`);
    ids.add(unit.id);
    if (unit.health > 0) cells.add(key);
  }
}

function findLivingUnitIndex(units: readonly TacticalUnit[], id: string): number {
  const index = units.findIndex((unit) => unit.id === id && unit.health > 0);
  if (index < 0) throw new RangeError(`living tactical unit not found: ${id}`);
  return index;
}

function unitAt(units: readonly TacticalUnit[], cell: TacticalCell): TacticalUnit | undefined {
  return units.find(
    (unit) => unit.health > 0 && unit.position.x === cell.x && unit.position.y === cell.y,
  );
}

function hasLivingSide(units: readonly TacticalUnit[], side: TacticalSide): boolean {
  return units.some((unit) => unit.side === side && unit.health > 0);
}

function cloneUnit(unit: TacticalUnit): TacticalUnit {
  return { ...unit, source: { ...unit.source }, position: { ...unit.position }, stats: { ...unit.stats } };
}

function oppositeSide(side: TacticalSide): TacticalSide {
  return side === "caravan" ? "hostile" : "caravan";
}

function assertSide(side: TacticalSide): void {
  if (side !== "caravan" && side !== "hostile") throw new RangeError("invalid tactical side");
}

function assertCell(cell: TacticalCell, name: string): void {
  if (!Number.isInteger(cell.x) || !Number.isInteger(cell.y)) {
    throw new TypeError(`${name} coordinates must be integers`);
  }
}
