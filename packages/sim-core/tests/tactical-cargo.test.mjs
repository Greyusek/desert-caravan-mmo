import test from "node:test";
import assert from "node:assert/strict";
import {
  createTacticalBattlefield,
  damageTacticalBaggage,
  deployTacticalCargo,
  deployTacticalUnits,
  resolveTacticalCargoOutcome,
} from "../dist/src/index.js";

const cargo = {
  capacityCargoUnits: 20,
  stacks: [
    { goodId: "ore", units: 5, costBasisCredits: 110 },
    { goodId: "medicine", units: 2, costBasisCredits: 80 },
  ],
};

function deployment() {
  const battlefield = createTacticalBattlefield("checkpoint-66");
  const combatants = deployTacticalUnits(battlefield, [
    { id: "guard", side: "caravan", unitClass: "guard", source: { kind: "caravan-member", id: "member-1" } },
    { id: "monster", side: "hostile", unitClass: "monster", source: { kind: "persistent-creature", id: "creature-1" } },
  ]);
  return deployTacticalCargo(battlefield, cargo, combatants);
}

test("TACTICAL-004: existing cargo stacks become physical unoccupied baggage units", () => {
  const result = deployment();
  assert.equal(result.baggageUnits.length, cargo.stacks.length);
  assert.deepEqual(result.baggageUnits.map((unit) => unit.cargoStack), cargo.stacks);
  assert.equal(new Set(result.baggageUnits.map((unit) => `${unit.position.x},${unit.position.y}`)).size, 2);
  assert.equal(result.sourceUsedCargoUnits, 10.2);
});

test("TACTICAL-004: caravan victory preserves every intact stack", () => {
  const outcome = resolveTacticalCargoOutcome(deployment(), "caravan");
  assert.deepEqual(outcome.caravanCargo, cargo);
  assert.deepEqual(outcome.capturedCargo.stacks, []);
  assert.deepEqual(outcome.destroyedStacks, []);
});

test("TACTICAL-004: hostile victory captures but does not duplicate intact cargo", () => {
  const outcome = resolveTacticalCargoOutcome(deployment(), "hostile");
  assert.deepEqual(outcome.caravanCargo.stacks, []);
  assert.deepEqual(outcome.capturedCargo, cargo);
  assert.deepEqual(outcome.destroyedStacks, []);
});

test("TACTICAL-004: destroyed baggage removes exactly its physical stack", () => {
  const initial = deployment();
  const damaged = damageTacticalBaggage(initial, initial.baggageUnits[0].id, 6);
  const outcome = resolveTacticalCargoOutcome(damaged, "caravan");
  assert.deepEqual(outcome.destroyedStacks, [cargo.stacks[0]]);
  assert.deepEqual(outcome.caravanCargo.stacks, [cargo.stacks[1]]);
});

test("TACTICAL-004: every outcome conserves source units and cost basis", () => {
  for (const winner of ["caravan", "hostile"]) {
    const initial = deployment();
    const damaged = damageTacticalBaggage(initial, initial.baggageUnits[1].id, 99);
    const outcome = resolveTacticalCargoOutcome(damaged, winner);
    assert.ok(outcome.conservation.every((entry) => entry.conserved));
    const allStacks = [...outcome.caravanCargo.stacks, ...outcome.capturedCargo.stacks, ...outcome.destroyedStacks];
    assert.equal(allStacks.reduce((sum, stack) => sum + stack.units, 0), 7);
    assert.equal(allStacks.reduce((sum, stack) => sum + stack.costBasisCredits, 0), 190);
  }
});

test("TACTICAL-004: deterministic deployment and outcomes reproduce exactly", () => {
  assert.deepEqual(deployment(), deployment());
  assert.deepEqual(resolveTacticalCargoOutcome(deployment(), "hostile"), resolveTacticalCargoOutcome(deployment(), "hostile"));
});

test("TACTICAL-004: impossible cargo placement and damage are rejected", () => {
  const battlefield = createTacticalBattlefield("full", { width: 3, height: 1, deploymentDepth: 1 });
  const combatants = deployTacticalUnits(battlefield, [
    { id: "guard", side: "caravan", unitClass: "guard", source: { kind: "caravan-member", id: "member" } },
    { id: "monster", side: "hostile", unitClass: "monster", source: { kind: "persistent-creature", id: "creature" } },
  ]);
  assert.throws(() => deployTacticalCargo(battlefield, cargo, combatants), RangeError);
  assert.throws(() => damageTacticalBaggage(deployment(), "missing", 1), RangeError);
  assert.throws(() => damageTacticalBaggage(deployment(), "baggage-01-ore", 0), RangeError);
});
