import assert from "node:assert/strict";
import test from "node:test";

import { createPlayerSessionController } from "../dist/src/index.js";

const PREPARATION_SEED = "player-preparation-test";

test("PLAYER-PREP-001: preparation projects the accepted caravan deployment zone", () => {
  const view = createPlayerSessionController(PREPARATION_SEED).getView();
  const formation = view.preparation?.formation;

  assert.ok(formation);
  assert.equal(formation.mode, "fixed");
  assert.equal(formation.accepted, true);
  assert.equal(formation.columns, 2);
  assert.equal(formation.rows, 8);
  assert.deepEqual(
    formation.combatants.map((unit) => [
      unit.memberRef,
      unit.role,
      unit.position,
      unit.health,
      unit.maxHealth,
      unit.movementCells,
      unit.attackRangeCells,
      unit.attackDamage,
    ]),
    [
      ["member:guard", "guard", { column: 0, row: 0 }, 12, 12, 2, 1, 4],
      ["member:skirmisher", "skirmisher", { column: 0, row: 1 }, 8, 8, 3, 3, 2],
    ],
  );
});

test("PLAYER-PREP-001: existing cargo becomes physical projected baggage", () => {
  const view = createPlayerSessionController(PREPARATION_SEED).getView();

  assert.deepEqual(view.preparation?.formation.baggage, [
    {
      ref: "baggage:1",
      goodId: "ore",
      units: 5,
      position: { column: 0, row: 2 },
      durability: 6,
      maxDurability: 6,
    },
    {
      ref: "baggage:2",
      goodId: "medicine",
      units: 2,
      position: { column: 0, row: 3 },
      durability: 6,
      maxDurability: 6,
    },
  ]);
});

test("PLAYER-PREP-001: a market purchase updates the same cargo and deployment", () => {
  const controller = createPlayerSessionController(PREPARATION_SEED);
  const action = controller
    .getView()
    .availableActions.find(
      (candidate) => candidate.kind === "BUY_GOOD" && candidate.goodId === "food",
    );
  assert.ok(action);

  const updated = controller.dispatch(action).getView();
  const baggage = updated.preparation?.formation.baggage;
  assert.equal(updated.caravan.cargo.usedCargoUnits, 11.2);
  assert.deepEqual(
    baggage?.map((unit) => [unit.goodId, unit.units, unit.position]),
    [
      ["food", 1, { column: 0, row: 2 }],
      ["medicine", 2, { column: 0, row: 3 }],
      ["ore", 5, { column: 0, row: 4 }],
    ],
  );
});

test("PLAYER-PREP-001: fixed formation exposes no invented reposition action", () => {
  const view = createPlayerSessionController(PREPARATION_SEED).getView();

  assert.equal(
    view.availableActions.some((action) =>
      ["MOVE_MEMBER", "SET_FORMATION"].includes(action.kind),
    ),
    false,
  );
  assert.match(view.preparation?.formation.reason ?? "", /not available yet/);
});

test("PLAYER-PREP-001: formation closes in travel and leaks no hostile truth", () => {
  const travelling = createPlayerSessionController(PREPARATION_SEED)
    .dispatch({
      kind: "SELECT_DESTINATION",
      destinationRef: "place:north-camp",
    })
    .dispatch({ kind: "START_JOURNEY" })
    .getView();

  assert.equal(travelling.preparation, null);
  const payload = JSON.stringify(
    createPlayerSessionController(PREPARATION_SEED).getView().preparation,
  ).toLowerCase();
  for (const forbidden of [
    PREPARATION_SEED,
    "monster",
    "hostile",
    "battlefield",
    "battleid",
    "source",
    "costbasiscredits",
  ]) {
    assert.equal(payload.includes(forbidden.toLowerCase()), false, forbidden);
  }
});
