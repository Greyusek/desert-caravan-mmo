import assert from "node:assert/strict";
import {
  createPersistentCreatureState,
  createRoutePlan,
  createTacticalBattlefield,
  createTacticalWorldState,
  createTradeCaravanState,
  createWorldCoordinate,
  deployTacticalUnits,
  destinationPoint,
  findFirstExpeditionMonsterContact,
  pveCaravanUnitId,
  pveCreatureUnitId,
  resolvePveMonsterContact,
} from "../packages/sim-core/dist/src/index.js";

const requested = process.argv[2] ?? "all";
const scenarios = requested === "all" ? ["tactical-win", "tactical-loss", "legacy"] : [requested];
if (scenarios.some((name) => !["tactical-win", "tactical-loss", "legacy"].includes(name))) {
  throw new RangeError("scenario must be tactical-win, tactical-loss, legacy or all");
}

for (const scenarioName of scenarios) {
  const scenario = createScenario();
  if (scenarioName === "legacy") {
    const result = resolvePveMonsterContact({ mode: "LEGACY_POWER", contact: scenario.contact });
    assert.equal(result.mode, "LEGACY_POWER");
    assert.equal(result.status, "monster-defeated");
    assert.equal(result.battlefield, null);
    assert.equal(result.worldState, null);
    console.log("\n[LEGACY] explicit compatibility path");
    console.log(`  contact=${result.contact.monsterId}; mode=${result.mode}; status=${result.status}`);
    console.log("  battlefield=none; world-return=none — PASS");
    continue;
  }

  const tacticalLoss = scenarioName === "tactical-loss";
  const worldState = tacticalLoss
    ? { ...scenario.worldState, members: scenario.worldState.members.map((member) => ({ ...member, health: 5 })) }
    : scenario.worldState;
  const result = resolvePveMonsterContact({
    contact: scenario.contact,
    battleId: `manual-${scenarioName}`,
    battlefieldSeed: `manual-${scenarioName}`,
    worldState,
    commands: tacticalLoss ? scenario.commands.slice(0, 8) : scenario.commands,
  });
  assert.equal(result.mode, "TACTICAL");
  assert.equal(result.battle.status, "complete");
  assert.deepEqual(result.worldState.appliedBattleIds, [`manual-${scenarioName}`]);
  assert.ok(result.cargoOutcome.conservation.every((entry) => entry.conserved));
  if (tacticalLoss) {
    assert.equal(result.battle.winner, "hostile");
    assert.equal(result.status, "expedition-defeated");
    assert.equal(result.worldState.members[0].status, "dead");
    assert.equal(result.worldState.caravan.cargo.stacks.length, 0);
  } else {
    assert.equal(result.battle.winner, "caravan");
    assert.equal(result.status, "monster-defeated");
    assert.equal(result.worldState.creature.status, "dead");
    assert.deepEqual(result.worldState.caravan.cargo, worldState.caravan.cargo);
  }
  console.log(`\n[${scenarioName.toUpperCase()}] authoritative contact -> tactical core`);
  console.log(`  contact=${result.contact.monsterId}; field=${result.battlefield.id}; events=${result.battle.events.length}`);
  console.log(`  winner=${result.battle.winner}; status=${result.status}; route=${result.routeDisposition}`);
  console.log(`  member=${result.worldState.members[0].status}:${result.worldState.members[0].health}hp; creature=${result.worldState.creature.status}:${result.worldState.creature.health}hp`);
  console.log(`  caravan-cargo=${formatStacks(result.worldState.caravan.cargo.stacks)}; captured=${formatStacks(result.cargoOutcome.capturedCargo.stacks)}`);
  console.log("  world-return=once; cargo-conservation=PASS");
}

function createScenario() {
  const planetRadiusMeters = 1_000_000;
  const speedMetersPerSecond = 10;
  const crossing = createWorldCoordinate(0, 0);
  const west = destinationPoint(crossing, 270, 1_000, planetRadiusMeters);
  const south = destinationPoint(crossing, 180, 1_000, planetRadiusMeters);
  const monster = {
    id: "manual-contact-monster",
    kind: "wandering-monster",
    power: 90,
    visionRadiusMeters: 300,
    interactionRadiusMeters: 100,
    patrolRoute: createRoutePlan(
      west,
      [{ bearingDeg: 90, distanceMeters: 2_000 }, { bearingDeg: 270, distanceMeters: 2_000 }],
      speedMetersPerSecond,
      planetRadiusMeters,
    ),
  };
  const expeditionRoute = createRoutePlan(
    south,
    [{ bearingDeg: 0, distanceMeters: 2_000 }],
    speedMetersPerSecond,
    planetRadiusMeters,
  );
  const contact = findFirstExpeditionMonsterContact(expeditionRoute, monster);
  assert.ok(contact);
  const creature = createPersistentCreatureState(monster, "manual-beast");
  const sourceField = createTacticalBattlefield("manual-pve-source");
  const sourceUnits = deployTacticalUnits(sourceField, [
    { id: "source-guard", side: "caravan", unitClass: "guard", source: { kind: "caravan-member", id: "manual-guard" } },
    { id: "source-monster", side: "hostile", unitClass: "monster", source: { kind: "persistent-creature", id: creature.id } },
  ]);
  const caravan = {
    ...createTradeCaravanState("manual-caravan", "city-01", 100, 20),
    cargo: { capacityCargoUnits: 20, stacks: [{ goodId: "ore", units: 5, costBasisCredits: 110 }] },
  };
  const guardId = pveCaravanUnitId("manual-guard");
  const monsterId = pveCreatureUnitId(creature.id);
  return {
    contact,
    worldState: createTacticalWorldState(caravan, sourceUnits, creature),
    commands: [
      { kind: "MOVE", unitId: guardId, to: { x: 2, y: 0 } },
      { kind: "MOVE", unitId: monsterId, to: { x: 8, y: 0 } },
      { kind: "MOVE", unitId: guardId, to: { x: 4, y: 0 } },
      { kind: "MOVE", unitId: monsterId, to: { x: 6, y: 0 } },
      { kind: "MOVE", unitId: guardId, to: { x: 5, y: 0 } },
      { kind: "ATTACK", unitId: monsterId, targetUnitId: guardId },
      { kind: "ATTACK", unitId: guardId, targetUnitId: monsterId },
      { kind: "ATTACK", unitId: monsterId, targetUnitId: guardId },
      { kind: "ATTACK", unitId: guardId, targetUnitId: monsterId },
      { kind: "ATTACK", unitId: monsterId, targetUnitId: guardId },
      { kind: "ATTACK", unitId: guardId, targetUnitId: monsterId },
    ],
  };
}

function formatStacks(stacks) {
  return stacks.length === 0 ? "empty" : stacks.map((stack) => `${stack.goodId} x${stack.units}`).join(", ");
}
