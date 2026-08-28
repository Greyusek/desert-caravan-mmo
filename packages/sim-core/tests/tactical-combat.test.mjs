import test from "node:test";
import assert from "node:assert/strict";
import {
  createTacticalBattlefield,
  createTacticalBattleState,
  deployTacticalUnits,
  executeTacticalCommand,
} from "../dist/src/index.js";

function battle() {
  const field = createTacticalBattlefield("checkpoint-65", {
    width: 7,
    height: 2,
    deploymentDepth: 2,
  });
  const units = deployTacticalUnits(field, [
    { id: "guard", side: "caravan", unitClass: "guard", source: { kind: "caravan-member", id: "member-1" } },
    { id: "archer", side: "caravan", unitClass: "skirmisher", source: { kind: "caravan-member", id: "member-2" } },
    { id: "beast", side: "hostile", unitClass: "monster", source: { kind: "persistent-creature", id: "creature-1" } },
  ]);
  return createTacticalBattleState(field, units);
}

test("TACTICAL-003: battle begins with explicit alternating server turn", () => {
  const state = battle();
  assert.equal(state.activeSide, "caravan");
  assert.equal(state.turn, 1);
  assert.equal(state.status, "active");
});

test("TACTICAL-003: movement uses class allowance and physical occupancy", () => {
  const moved = executeTacticalCommand(battle(), { kind: "MOVE", unitId: "archer", to: { x: 3, y: 1 } });
  assert.deepEqual(moved.units.find((unit) => unit.id === "archer").position, { x: 3, y: 1 });
  assert.equal(moved.activeSide, "hostile");
  assert.equal(moved.events[0].kind, "moved");
});

test("TACTICAL-003: movement rejects range, bounds and occupied cells", () => {
  assert.throws(() => executeTacticalCommand(battle(), { kind: "MOVE", unitId: "guard", to: { x: 4, y: 0 } }), RangeError);
  assert.throws(() => executeTacticalCommand(battle(), { kind: "MOVE", unitId: "guard", to: { x: -1, y: 0 } }), RangeError);
  assert.throws(() => executeTacticalCommand(battle(), { kind: "MOVE", unitId: "guard", to: { x: 0, y: 1 } }), RangeError);
});

test("TACTICAL-003: ranged attack applies explicit damage", () => {
  let state = executeTacticalCommand(battle(), { kind: "MOVE", unitId: "archer", to: { x: 3, y: 1 } });
  state = executeTacticalCommand(state, { kind: "MOVE", unitId: "beast", to: { x: 5, y: 1 } });
  state = executeTacticalCommand(state, { kind: "ATTACK", unitId: "archer", targetUnitId: "beast" });
  assert.equal(state.units.find((unit) => unit.id === "beast").health, 8);
  assert.deepEqual(state.events[2], { sequence: 3, kind: "attacked", side: "caravan", unitId: "archer", targetUnitId: "beast", damage: 2, targetHealth: 8, targetDefeated: false });
});

test("TACTICAL-003: attacks reject wrong turn, allies and range", () => {
  const state = battle();
  assert.throws(() => executeTacticalCommand(state, { kind: "ATTACK", unitId: "beast", targetUnitId: "guard" }), RangeError);
  assert.throws(() => executeTacticalCommand(state, { kind: "ATTACK", unitId: "guard", targetUnitId: "archer" }), RangeError);
  assert.throws(() => executeTacticalCommand(state, { kind: "ATTACK", unitId: "archer", targetUnitId: "beast" }), RangeError);
});

test("TACTICAL-003: zero health removes a unit and completes the battle", () => {
  let state = battle();
  const beastIndex = state.units.findIndex((unit) => unit.id === "beast");
  const units = state.units.map((unit, index) => index === beastIndex ? { ...unit, position: { x: 1, y: 0 }, health: 4 } : unit);
  state = { ...state, units };
  state = executeTacticalCommand(state, { kind: "ATTACK", unitId: "guard", targetUnitId: "beast" });
  assert.equal(state.status, "complete");
  assert.equal(state.winner, "caravan");
  assert.equal(state.units[beastIndex].health, 0);
  assert.throws(() => executeTacticalCommand(state, { kind: "WAIT", unitId: "guard" }), Error);
});

test("TACTICAL-003: WAIT advances turn without inventing movement", () => {
  const state = executeTacticalCommand(battle(), { kind: "WAIT", unitId: "guard" });
  assert.equal(state.activeSide, "hostile");
  assert.equal(state.events[0].kind, "waited");
});

test("TACTICAL-003: identical commands reproduce complete server truth", () => {
  const commands = [
    { kind: "MOVE", unitId: "archer", to: { x: 3, y: 1 } },
    { kind: "MOVE", unitId: "beast", to: { x: 5, y: 1 } },
    { kind: "ATTACK", unitId: "archer", targetUnitId: "beast" },
  ];
  const run = () => commands.reduce((state, command) => executeTacticalCommand(state, command), battle());
  assert.deepEqual(run(), run());
});
