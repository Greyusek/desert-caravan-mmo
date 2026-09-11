import assert from "node:assert/strict";
import test from "node:test";

import { createPlayerSessionController } from "../../sim-core/dist/src/index.js";
import { createPreparationScreenState } from "../preparation-model.js";

const controller = createPlayerSessionController("player-preparation-model-test");
const view = controller.getView();

test("PLAYER-PREP-001 UI: projected positions become a read-only zone", () => {
  const state = createPreparationScreenState(view);

  assert.equal(state.editable, false);
  assert.equal(state.accepted, true);
  assert.equal(state.cells.length, 16);
  assert.deepEqual(
    state.cells.filter((cell) => cell.occupant).map((cell) => cell.occupant?.kind),
    ["combatant", "combatant", "baggage", "baggage"],
  );
});

test("PLAYER-PREP-001 UI: members retain projected combat stats and labels", () => {
  const state = createPreparationScreenState(view);

  assert.deepEqual(
    state.members.map((member) => [
      member.label,
      member.health,
      member.movementCells,
      member.attackRangeCells,
      member.attackDamage,
    ]),
    [
      ["Страж", 12, 2, 1, 4],
      ["Застрельщик", 8, 3, 3, 2],
    ],
  );
  assert.equal(Object.isFrozen(state), true);
  assert.equal(Object.isFrozen(state.cells), true);
});

test("PLAYER-PREP-001 UI: market changes flow into the same baggage manifest", () => {
  const buyFood = view.availableActions.find(
    (action) => action.kind === "BUY_GOOD" && action.goodId === "food",
  );
  assert.ok(buyFood);
  const state = createPreparationScreenState(
    controller.dispatch(buyFood).getView(),
  );

  assert.equal(state.cargo.usedCargoUnits, 11.2);
  assert.deepEqual(
    state.baggage.map((unit) => [unit.label, unit.units]),
    [
      ["Еда", 1],
      ["Лекарства", 2],
      ["Руда", 5],
    ],
  );
});

test("PLAYER-PREP-001 UI: unavailable and overlapping formations are rejected", () => {
  const travelling = controller
    .dispatch({ kind: "SELECT_DESTINATION", destinationRef: "place:north-camp" })
    .dispatch({ kind: "START_JOURNEY" })
    .getView();
  assert.throws(
    () => createPreparationScreenState(travelling),
    /requires an available formation/,
  );

  const overlapping = structuredClone(view);
  overlapping.preparation.formation.baggage[0].position = { column: 0, row: 0 };
  assert.throws(
    () => createPreparationScreenState(overlapping),
    /formation cell is occupied/,
  );
});
