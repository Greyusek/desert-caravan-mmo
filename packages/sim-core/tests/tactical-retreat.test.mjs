import test from "node:test";
import assert from "node:assert/strict";
import {
  createTacticalBattlefield,
  createTacticalBattleState,
  deployTacticalUnits,
  evaluateTacticalRetreat,
  executeTacticalRetreat,
} from "../dist/src/index.js";

function battle() {
  const field = createTacticalBattlefield("checkpoint-67", {
    width: 9,
    height: 2,
    deploymentDepth: 2,
  });
  return createTacticalBattleState(
    field,
    deployTacticalUnits(field, [
      { id: "guard", side: "caravan", unitClass: "guard", source: { kind: "caravan-member", id: "member-1" } },
      { id: "scout", side: "caravan", unitClass: "skirmisher", source: { kind: "caravan-member", id: "member-2" } },
      { id: "beast", side: "hostile", unitClass: "monster", source: { kind: "persistent-creature", id: "creature-1" } },
    ]),
  );
}

test("TACTICAL-005: a side at its edge with safe separation may retreat", () => {
  const evaluation = evaluateTacticalRetreat(battle(), "caravan");
  assert.equal(evaluation.eligible, true);
  assert.equal(evaluation.exitEdge, "west");
  assert.ok(evaluation.minimumSeparationCells >= 4);
});

test("TACTICAL-005: every living retreating unit must reach its exit edge", () => {
  const state = battle();
  const moved = {
    ...state,
    units: state.units.map((unit) => unit.id === "scout" ? { ...unit, position: { x: 1, y: 1 } } : unit),
  };
  assert.deepEqual(evaluateTacticalRetreat(moved, "caravan").blockedReason, "not-at-retreat-edge");
  assert.throws(() => executeTacticalRetreat(moved, "caravan"), /not-at-retreat-edge/);
});

test("TACTICAL-005: an enemy inside required separation blocks retreat", () => {
  const state = battle();
  const threatened = {
    ...state,
    units: state.units.map((unit) => unit.id === "beast" ? { ...unit, position: { x: 3, y: 0 } } : unit),
  };
  const evaluation = evaluateTacticalRetreat(threatened, "caravan");
  assert.equal(evaluation.minimumSeparationCells, 3);
  assert.equal(evaluation.blockedReason, "unsafe-separation");
});

test("TACTICAL-005: retreat is an explicit action only on that side's turn", () => {
  const state = { ...battle(), activeSide: "hostile" };
  assert.equal(evaluateTacticalRetreat(state, "caravan").blockedReason, "wrong-turn");
});

test("TACTICAL-005: escaped units preserve health and are not casualties", () => {
  const state = battle();
  const outcome = executeTacticalRetreat(state, "caravan");
  assert.deepEqual(outcome.escapedUnits.map((unit) => [unit.id, unit.health]), [["guard", 12], ["scout", 8]]);
  assert.deepEqual(outcome.casualties, []);
  assert.equal(outcome.finalBattleState.status, "complete");
  assert.equal(outcome.finalBattleState.winner, "hostile");
});

test("TACTICAL-005: hostile side uses the east edge under the same rules", () => {
  const initial = battle();
  const state = {
    ...initial,
    activeSide: "hostile",
    units: initial.units.map((unit) =>
      unit.id === "beast" ? { ...unit, position: { x: 8, y: 0 } } : unit,
    ),
  };
  const outcome = executeTacticalRetreat(state, "hostile");
  assert.equal(outcome.exitEdge, "east");
  assert.equal(outcome.winningSide, "caravan");
  assert.deepEqual(outcome.escapedUnits.map((unit) => unit.id), ["beast"]);
});

test("TACTICAL-005: completed battle and invalid separation reject retreat", () => {
  const state = battle();
  assert.equal(evaluateTacticalRetreat({ ...state, status: "complete", winner: "caravan" }, "caravan").blockedReason, "battle-complete");
  assert.throws(() => evaluateTacticalRetreat(state, "caravan", 0), RangeError);
});

test("TACTICAL-005: identical state reproduces evaluation and outcome", () => {
  assert.deepEqual(evaluateTacticalRetreat(battle(), "caravan"), evaluateTacticalRetreat(battle(), "caravan"));
  assert.deepEqual(executeTacticalRetreat(battle(), "caravan"), executeTacticalRetreat(battle(), "caravan"));
});
