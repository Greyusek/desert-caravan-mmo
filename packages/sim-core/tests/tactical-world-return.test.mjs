import test from "node:test";
import assert from "node:assert/strict";
import {
  applyTacticalBattleToWorld,
  createPersistentCreatureState,
  createTacticalBattleState,
  createTacticalBattlefield,
  createTacticalWorldState,
  createTradeCaravanState,
  damageTacticalBaggage,
  deployTacticalCargo,
  deployTacticalUnits,
  generateSeededWorld,
  resolveTacticalCargoOutcome,
} from "../dist/src/index.js";

function scenario() {
  const field = createTacticalBattlefield("checkpoint-68");
  const creature = createPersistentCreatureState(generateSeededWorld("checkpoint-68-world").wanderingMonsters[0], "sand-beast");
  const units = deployTacticalUnits(field, [
    { id: "guard-unit", side: "caravan", unitClass: "guard", source: { kind: "caravan-member", id: "member-guard" } },
    { id: "scout-unit", side: "caravan", unitClass: "skirmisher", source: { kind: "caravan-member", id: "member-scout" } },
    { id: "beast-unit", side: "hostile", unitClass: "monster", source: { kind: "persistent-creature", id: creature.id } },
  ]);
  const caravan = { ...createTradeCaravanState("player", "city-01", 100, 20), cargo: { capacityCargoUnits: 20, stacks: [{ goodId: "ore", units: 5, costBasisCredits: 110 }] } };
  const world = createTacticalWorldState(caravan, units, creature);
  return { field, units, caravan, world };
}

function completed(units, winner = "caravan") {
  const field = createTacticalBattlefield("checkpoint-68");
  const livingStart = units.map((unit) => ({ ...unit, health: unit.stats.maxHealth }));
  return { ...createTacticalBattleState(field, livingStart), units, status: "complete", winner };
}

test("TACTICAL-006: casualties and survivors update real source identities", () => {
  const { field, units, caravan, world } = scenario();
  const finalUnits = units.map((unit) => unit.id === "scout-unit" ? { ...unit, health: 0 } : unit.id === "beast-unit" ? { ...unit, health: 0 } : { ...unit, health: 7 });
  const cargo = resolveTacticalCargoOutcome(deployTacticalCargo(field, caravan.cargo), "caravan");
  const result = applyTacticalBattleToWorld(world, "battle-001", completed(finalUnits), cargo);
  assert.deepEqual(result.members.map((member) => [member.id, member.health, member.status]), [["member-guard", 7, "alive"], ["member-scout", 0, "dead"]]);
  assert.equal(result.creature.status, "dead");
  assert.deepEqual(result.battleResults[0].casualtySourceIds, ["member-scout", result.creature.creature.id]);
});

test("TACTICAL-006: caravan receives exactly the conserved cargo outcome", () => {
  const { field, units, caravan, world } = scenario();
  const deployment = deployTacticalCargo(field, caravan.cargo);
  const cargo = resolveTacticalCargoOutcome(damageTacticalBaggage(deployment, "baggage-01-ore", 6), "caravan");
  const result = applyTacticalBattleToWorld(world, "battle-cargo", completed(units), cargo);
  assert.deepEqual(result.caravan.cargo.stacks, []);
  assert.deepEqual(result.battleResults[0].destroyedCargo, caravan.cargo.stacks);
});

test("TACTICAL-006: hostile victory removes captured cargo from caravan", () => {
  const { field, units, caravan, world } = scenario();
  const cargo = resolveTacticalCargoOutcome(deployTacticalCargo(field, caravan.cargo), "hostile");
  const result = applyTacticalBattleToWorld(world, "battle-capture", completed(units, "hostile"), cargo);
  assert.deepEqual(result.caravan.cargo.stacks, []);
  assert.deepEqual(result.battleResults[0].capturedCargo.stacks, caravan.cargo.stacks);
});

test("TACTICAL-006: one battle id can be applied only once", () => {
  const { field, units, caravan, world } = scenario();
  const cargo = resolveTacticalCargoOutcome(deployTacticalCargo(field, caravan.cargo), "caravan");
  const once = applyTacticalBattleToWorld(world, "battle-once", completed(units), cargo);
  assert.throws(() => applyTacticalBattleToWorld(once, "battle-once", completed(units), cargo), /already applied/);
});

test("TACTICAL-006: a dead participant cannot reappear in another battle", () => {
  const { field, units, caravan, world } = scenario();
  const deadScout = units.map((unit) => unit.id === "scout-unit" ? { ...unit, health: 0 } : unit);
  const cargo = resolveTacticalCargoOutcome(deployTacticalCargo(field, caravan.cargo), "caravan");
  const afterDeath = applyTacticalBattleToWorld(world, "battle-death", completed(deadScout), cargo);
  assert.throws(() => applyTacticalBattleToWorld(afterDeath, "battle-respawn", completed(units), cargo), /dead member cannot reappear/);
});

test("TACTICAL-006: incomplete battle, winner mismatch and foreign cargo reject return", () => {
  const { field, units, caravan, world } = scenario();
  const active = createTacticalBattleState(field, units);
  const cargo = resolveTacticalCargoOutcome(deployTacticalCargo(field, caravan.cargo), "caravan");
  assert.throws(() => applyTacticalBattleToWorld(world, "active", active, cargo), /complete battle/);
  assert.throws(() => applyTacticalBattleToWorld(world, "mismatch", completed(units, "hostile"), cargo), /winner/);
  const foreign = resolveTacticalCargoOutcome(deployTacticalCargo(field, { capacityCargoUnits: 20, stacks: [{ goodId: "medicine", units: 1, costBasisCredits: 5 }] }), "caravan");
  assert.throws(() => applyTacticalBattleToWorld(world, "foreign", completed(units), foreign), /current caravan cargo/);
});

test("TACTICAL-006: identical result application reproduces complete world state", () => {
  const execute = () => {
    const { field, units, caravan, world } = scenario();
    return applyTacticalBattleToWorld(world, "repeatable", completed(units), resolveTacticalCargoOutcome(deployTacticalCargo(field, caravan.cargo), "caravan"));
  };
  assert.deepEqual(execute(), execute());
});
