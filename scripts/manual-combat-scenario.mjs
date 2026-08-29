import assert from "node:assert/strict";
import { createTacticalCombatScenario } from "../packages/sim-core/dist/src/index.js";

const seed = process.argv[2] ?? "manual-combat-001";
const scenario = createTacticalCombatScenario(seed);
const { resolution, continuation } = scenario;

assert.equal(resolution.mode, "TACTICAL");
assert.equal(resolution.battle.winner, "caravan");
assert.equal(resolution.routeDisposition, "continue");
assert.equal(resolution.worldState.appliedBattleIds.length, 1);
assert.ok(resolution.cargoOutcome.conservation.every((entry) => entry.conserved));
assert.equal(continuation.evaluatedPosition.status, "moving");
assert.equal(continuation.progressedDistanceMeters, 300);
assert.equal(continuation.arrivalPosition.status, "arrived");
assert.equal(
  continuation.worldState.caravan.currentCityId,
  scenario.destinationCity.id,
);
assert.equal(continuation.worldState.caravan.activeJourney, null);
assert.equal(continuation.worldState.members[1]?.status, "dead");
assert.equal(continuation.worldState.creature.status, "dead");

console.log("\nCOMBAT-001 — global → tactical → global");
console.log(`  seed=${scenario.seed}`);
console.log(
  `  route=${scenario.originCity.id}->${scenario.destinationCity.id}; distance=${scenario.expeditionRoute.totalDistanceMeters}m; ETA=${scenario.expeditionRoute.totalDurationSeconds}s`,
);
console.log(
  `  contact=${scenario.contact.monsterId}; T=${scenario.contact.expeditionElapsedSeconds.toFixed(3)}s; separation=${scenario.contact.separationMeters.toFixed(3)}/${scenario.contact.interactionRadiusMeters}m`,
);
console.log(
  `  battle=${resolution.battlefield.id}; commands/events=${scenario.commands.length}/${resolution.battle.events.length}; winner=${resolution.battle.winner}`,
);
console.log(
  `  members=${resolution.worldState.members.map((member) => `${member.id}:${member.status}:${member.health}hp`).join(",")}; creature=${resolution.worldState.creature.status}`,
);
console.log(
  `  cargo=${resolution.worldState.caravan.cargo.stacks.map((stack) => `${stack.goodId}x${stack.units}`).join(",")}; conservation=PASS; world-apply=once`,
);
console.log(
  `  resumed=+${continuation.progressedDistanceMeters}m; arrival=${continuation.arrivedAtWorldTimeSeconds}s:${continuation.worldState.caravan.currentCityId}; journal=${continuation.worldState.caravan.journal.map((event) => event.kind).join("->")}`,
);
console.log("  COMBAT-001 manual assertions — PASS");
