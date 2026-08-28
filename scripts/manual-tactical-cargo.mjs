import assert from "node:assert/strict";
import {
  createTacticalBattlefield,
  damageTacticalBaggage,
  deployTacticalCargo,
  resolveTacticalCargoOutcome,
} from "../packages/sim-core/dist/src/index.js";

const requested = process.argv[2] ?? "all";
const scenarios = requested === "all" ? ["survive", "destroy", "capture"] : [requested];
if (scenarios.some((name) => !["survive", "destroy", "capture"].includes(name))) {
  throw new RangeError("scenario must be survive, destroy, capture or all");
}

const cargo = {
  capacityCargoUnits: 20,
  stacks: [
    { goodId: "ore", units: 5, costBasisCredits: 110 },
    { goodId: "medicine", units: 2, costBasisCredits: 80 },
  ],
};

for (const scenario of scenarios) {
  const battlefield = createTacticalBattlefield(`manual-${scenario}`);
  let deployment = deployTacticalCargo(battlefield, cargo);
  const winner = scenario === "capture" ? "hostile" : "caravan";
  if (scenario === "destroy") {
    deployment = damageTacticalBaggage(deployment, "baggage-01-ore", 6);
  }
  const outcome = resolveTacticalCargoOutcome(deployment, winner);
  assert.ok(outcome.conservation.every((entry) => entry.conserved));
  const source = outcome.conservation.reduce((sum, entry) => sum + entry.sourceUnits, 0);
  const accounted = outcome.conservation.reduce(
    (sum, entry) => sum + entry.survivedUnits + entry.capturedUnits + entry.destroyedUnits,
    0,
  );
  assert.equal(source, accounted);
  console.log(`\n[${scenario.toUpperCase()}] winner=${winner}`);
  for (const unit of deployment.baggageUnits) {
    console.log(`  ${unit.id} at (${unit.position.x},${unit.position.y}): ${unit.cargoStack.goodId} x${unit.cargoStack.units}, durability=${unit.durability}/${unit.maxDurability}`);
  }
  console.log(`  caravan: ${formatStacks(outcome.caravanCargo.stacks)}`);
  console.log(`  captured: ${formatStacks(outcome.capturedCargo.stacks)}`);
  console.log(`  destroyed: ${formatStacks(outcome.destroyedStacks)}`);
  console.log(`  conservation: ${source} source = ${accounted} accounted — PASS`);
}

function formatStacks(stacks) {
  return stacks.length === 0
    ? "empty"
    : stacks.map((stack) => `${stack.goodId} x${stack.units} (${stack.costBasisCredits} cr)`).join(", ");
}
