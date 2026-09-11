// @ts-check

import { TRADE_GOOD_LABELS } from "./city-model.js";

const ROLE_LABELS = Object.freeze({
  guard: "Страж",
  skirmisher: "Застрельщик",
});

/**
 * PLAYER-PREP-001 presents only the formation accepted by the tactical core.
 * The browser assigns labels and layout metadata, but never changes positions
 * or decides whether a deployment is legal.
 * @param {import("../sim-core/dist/src/index.js").PlayerSessionView} view
 */
export function createPreparationScreenState(view) {
  if (!view.preparation) {
    throw new RangeError("preparation screen requires an available formation");
  }
  const formation = view.preparation.formation;
  if (formation.mode !== "fixed" || formation.accepted !== true) {
    throw new RangeError("preparation screen requires an accepted fixed formation");
  }

  const occupied = new Set();
  const members = formation.combatants.map((combatant) => {
    assertPosition(combatant.position, formation.columns, formation.rows);
    claimCell(occupied, combatant.position);
    const member = view.caravan.members.find(
      (candidate) => candidate.ref === combatant.memberRef,
    );
    if (!member || member.role !== combatant.role) {
      throw new RangeError(`formation member is not carried: ${combatant.memberRef}`);
    }
    return {
      ...combatant,
      label: ROLE_LABELS[combatant.role],
      status: member.status,
    };
  });
  const baggage = formation.baggage.map((unit) => {
    assertPosition(unit.position, formation.columns, formation.rows);
    claimCell(occupied, unit.position);
    return {
      ...unit,
      label: TRADE_GOOD_LABELS[unit.goodId],
    };
  });
  const cells = [];
  for (let row = 0; row < formation.rows; row += 1) {
    for (let column = 0; column < formation.columns; column += 1) {
      const combatant = members.find(
        (unit) => unit.position.column === column && unit.position.row === row,
      );
      const cargo = baggage.find(
        (unit) => unit.position.column === column && unit.position.row === row,
      );
      cells.push({
        column,
        row,
        occupant: combatant
          ? { kind: "combatant", ref: combatant.memberRef, label: combatant.label }
          : cargo
            ? { kind: "baggage", ref: cargo.ref, label: cargo.label }
            : null,
      });
    }
  }

  return deepFreeze({
    mode: formation.mode,
    accepted: formation.accepted,
    reason: formation.reason,
    editable: false,
    columns: formation.columns,
    rows: formation.rows,
    supplies: { ...view.caravan.supplies },
    cargo: { ...view.caravan.cargo },
    members,
    baggage,
    cells,
  });
}

/** @param {{ column: number, row: number }} position @param {number} columns @param {number} rows */
function assertPosition(position, columns, rows) {
  if (
    !Number.isSafeInteger(position.column) ||
    !Number.isSafeInteger(position.row) ||
    position.column < 0 ||
    position.column >= columns ||
    position.row < 0 ||
    position.row >= rows
  ) {
    throw new RangeError("formation position is outside the projected zone");
  }
}

/** @param {Set<string>} occupied @param {{ column: number, row: number }} position */
function claimCell(occupied, position) {
  const key = `${position.column}:${position.row}`;
  if (occupied.has(key)) throw new RangeError(`formation cell is occupied: ${key}`);
  occupied.add(key);
}

/** @template T @param {T} value @returns {T} */
function deepFreeze(value) {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
