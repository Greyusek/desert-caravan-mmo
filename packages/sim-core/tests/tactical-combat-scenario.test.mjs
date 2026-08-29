import assert from "node:assert/strict";
import test from "node:test";

import {
  createTacticalCombatScenario,
  greatCircleDistance,
} from "../dist/src/index.js";

test("COMBAT-001: an active global journey produces one real moving PvE contact", () => {
  const scenario = createTacticalCombatScenario("combat-001-world");

  assert.equal(scenario.contact.monsterId, scenario.monster.id);
  assert.equal(scenario.contact.caravanActivity, "moving");
  assert.ok(scenario.contact.expeditionElapsedSeconds > 0);
  assert.ok(
    scenario.contact.expeditionElapsedSeconds <
      scenario.expeditionRoute.totalDurationSeconds,
  );
  assert.ok(
    scenario.contact.separationMeters <=
      scenario.contact.interactionRadiusMeters + 0.001,
  );
});

test("COMBAT-001: tactical field contains source-linked combatants and existing cargo", () => {
  const { resolution } = createTacticalCombatScenario("combat-001-world");

  assert.deepEqual(
    resolution.initialBattle.units.map((unit) => [
      unit.side,
      unit.unitClass,
      unit.source.kind,
      unit.source.id,
    ]),
    [
      ["caravan", "guard", "caravan-member", "combat-member-guard"],
      ["caravan", "skirmisher", "caravan-member", "combat-member-skirmisher"],
      ["hostile", "monster", "persistent-creature", "persistent-combat-monster"],
    ],
  );
  assert.deepEqual(
    resolution.cargoDeployment.baggageUnits.map((unit) => [
      unit.cargoStack.goodId,
      unit.cargoStack.units,
    ]),
    [
      ["ore", 5],
      ["medicine", 2],
    ],
  );
});

test("COMBAT-001: fixed valid commands complete with a caravan victory", () => {
  const scenario = createTacticalCombatScenario("combat-001-world");

  assert.equal(scenario.commands.length, 17);
  assert.equal(scenario.resolution.battle.events.length, 17);
  assert.equal(scenario.resolution.battle.status, "complete");
  assert.equal(scenario.resolution.battle.winner, "caravan");
  assert.equal(scenario.resolution.status, "monster-defeated");
  assert.equal(scenario.resolution.routeDisposition, "continue");
  assert.equal(scenario.resolution.terminal, false);
});

test("COMBAT-001: survivor health and casualties return to persistent identities", () => {
  const state = createTacticalCombatScenario("combat-001-world").resolution
    .worldState;

  assert.deepEqual(
    state.members.map((member) => [member.id, member.health, member.status]),
    [
      ["combat-member-guard", 6, "alive"],
      ["combat-member-skirmisher", 0, "dead"],
    ],
  );
  assert.equal(state.creature.creature.id, "persistent-combat-monster");
  assert.equal(state.creature.health, 0);
  assert.equal(state.creature.status, "dead");
});

test("COMBAT-001: only physically deployed cargo survives and remains conserved", () => {
  const { cargoDeployment, cargoOutcome } = createTacticalCombatScenario(
    "combat-001-world",
  ).resolution;

  assert.deepEqual(
    cargoOutcome.caravanCargo.stacks,
    cargoDeployment.baggageUnits.map((unit) => unit.cargoStack),
  );
  assert.deepEqual(cargoOutcome.capturedCargo.stacks, []);
  assert.deepEqual(cargoOutcome.destroyedStacks, []);
  assert.equal(
    cargoOutcome.conservation.every((entry) => entry.conserved),
    true,
  );
});

test("COMBAT-001: battle consequence is recorded exactly once", () => {
  const state = createTacticalCombatScenario("combat-001-world").resolution
    .worldState;

  assert.deepEqual(state.appliedBattleIds, [
    "combat-001-battle:combat-001-world",
  ]);
  assert.equal(state.battleResults.length, 1);
  assert.deepEqual(state.battleResults[0]?.survivorSourceIds, [
    "combat-member-guard",
  ]);
  assert.deepEqual(state.battleResults[0]?.casualtySourceIds, [
    "combat-member-skirmisher",
    "persistent-combat-monster",
  ]);
});

test("COMBAT-001: global route resumes from the exact contact boundary", () => {
  const { continuation } = createTacticalCombatScenario("combat-001-world");

  assert.equal(
    continuation.contactPosition.worldTimeSeconds,
    continuation.resumedAtWorldTimeSeconds,
  );
  assert.equal(continuation.contactPosition.status, "moving");
  assert.equal(continuation.evaluatedPosition.status, "moving");
  assert.equal(continuation.progressedDistanceMeters, 300);
  assert.ok(
    continuation.evaluatedPosition.remainingDistanceMeters <
      continuation.contactPosition.remainingDistanceMeters,
  );
});

test("COMBAT-001: continued simulation reaches the destination with consequences intact", () => {
  const scenario = createTacticalCombatScenario("combat-001-world");
  const { continuation } = scenario;

  assert.equal(continuation.arrivalPosition.status, "arrived");
  assert.ok(
    greatCircleDistance(
      continuation.arrivalPosition.coordinate,
      scenario.destinationCity.position,
    ) < 0.001,
  );
  assert.equal(
    continuation.worldState.caravan.currentCityId,
    scenario.destinationCity.id,
  );
  assert.equal(continuation.worldState.caravan.activeJourney, null);
  assert.deepEqual(
    continuation.worldState.caravan.journal.map((event) => event.kind),
    ["departure", "arrival"],
  );
  assert.equal(continuation.worldState.members[1]?.status, "dead");
  assert.equal(continuation.worldState.creature.status, "dead");
  assert.deepEqual(
    continuation.worldState.caravan.cargo,
    scenario.resolution.cargoOutcome.caravanCargo,
  );
  assert.deepEqual(
    continuation.worldState.appliedBattleIds,
    scenario.resolution.worldState.appliedBattleIds,
  );
});

test("COMBAT-001: identical seed reproduces complete server truth", () => {
  assert.deepEqual(
    createTacticalCombatScenario("combat-001-world"),
    createTacticalCombatScenario("combat-001-world"),
  );
});

test("COMBAT-001: seed changes battle identities but preserves fixed actions", () => {
  const first = createTacticalCombatScenario("combat-001-world-a");
  const second = createTacticalCombatScenario("combat-001-world-b");

  assert.notEqual(
    first.resolution.battlefield.id,
    second.resolution.battlefield.id,
  );
  assert.notEqual(
    first.resolution.worldState.appliedBattleIds[0],
    second.resolution.worldState.appliedBattleIds[0],
  );
  assert.deepEqual(first.contact, second.contact);
  assert.deepEqual(first.commands, second.commands);
  assert.deepEqual(first.resolution.battle.units, second.resolution.battle.units);
});

test("COMBAT-001: empty seed is rejected", () => {
  assert.throws(
    () => createTacticalCombatScenario("  "),
    /seed must be a non-empty string/,
  );
});
