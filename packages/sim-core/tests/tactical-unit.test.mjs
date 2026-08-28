import test from "node:test";
import assert from "node:assert/strict";
import {
  createTacticalBattlefield,
  deployTacticalUnits,
  isCellInDeploymentZone,
  tacticalUnitClassStats,
} from "../dist/src/index.js";

const deployments = [
  {
    id: "guard-01",
    side: "caravan",
    unitClass: "guard",
    source: { kind: "caravan-member", id: "member-guard-01" },
  },
  {
    id: "scout-01",
    side: "caravan",
    unitClass: "skirmisher",
    source: { kind: "caravan-member", id: "member-scout-01" },
  },
  {
    id: "monster-01",
    side: "hostile",
    unitClass: "monster",
    source: { kind: "persistent-creature", id: "creature-01" },
  },
];

test("TACTICAL-002: every combatant is a physical unit in its deployment zone", () => {
  const battlefield = createTacticalBattlefield("checkpoint-64");
  const units = deployTacticalUnits(battlefield, deployments);
  assert.equal(units.length, 3);
  for (const unit of units) {
    assert.equal(
      isCellInDeploymentZone(battlefield, unit.side, unit.position),
      true,
    );
  }
  assert.equal(new Set(units.map((unit) => `${unit.position.x},${unit.position.y}`)).size, 3);
});

test("TACTICAL-002: persistent source identities survive tactical placement", () => {
  const units = deployTacticalUnits(
    createTacticalBattlefield("sources"),
    deployments,
  );
  assert.deepEqual(
    units.map((unit) => unit.source),
    deployments.map((deployment) => deployment.source),
  );
});

test("TACTICAL-002: guard is tougher and stronger in close combat", () => {
  const guard = tacticalUnitClassStats("guard");
  const skirmisher = tacticalUnitClassStats("skirmisher");
  assert.ok(guard.maxHealth > skirmisher.maxHealth);
  assert.ok(guard.attackDamage > skirmisher.attackDamage);
  assert.equal(guard.attackRangeCells, 1);
});

test("TACTICAL-002: skirmisher is faster and has a ranged attack", () => {
  const guard = tacticalUnitClassStats("guard");
  const skirmisher = tacticalUnitClassStats("skirmisher");
  assert.ok(skirmisher.movementCells > guard.movementCells);
  assert.ok(skirmisher.attackRangeCells > guard.attackRangeCells);
});

test("TACTICAL-002: monster is distinct without a broad RPG stat system", () => {
  assert.deepEqual(tacticalUnitClassStats("monster"), {
    maxHealth: 10,
    movementCells: 2,
    attackRangeCells: 1,
    attackDamage: 3,
  });
});

test("TACTICAL-002: identical inputs reproduce placement and stats", () => {
  const battlefield = createTacticalBattlefield("repeat");
  assert.deepEqual(
    deployTacticalUnits(battlefield, deployments),
    deployTacticalUnits(battlefield, deployments),
  );
});

test("TACTICAL-002: invalid identities, sides and capacity are rejected", () => {
  const battlefield = createTacticalBattlefield("invalid", {
    width: 3,
    height: 1,
    deploymentDepth: 1,
  });
  assert.throws(
    () => deployTacticalUnits(battlefield, [deployments[0], deployments[0]]),
    RangeError,
  );
  assert.throws(
    () =>
      deployTacticalUnits(battlefield, [
        { ...deployments[2], side: "caravan" },
      ]),
    RangeError,
  );
  assert.throws(
    () =>
      deployTacticalUnits(battlefield, [
        deployments[0],
        { ...deployments[1], id: "scout-02" },
      ]),
    RangeError,
  );
});
