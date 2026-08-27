import test from "node:test";
import assert from "node:assert/strict";
import {
  CREATURE_POPULATION_DAY_SECONDS,
  catchUpCreaturePopulation,
  catchUpPersistentCreature,
  createCreaturePopulationState,
  createPersistentCreatureState,
  generateSeededWorld,
  greatCircleDistance,
  selectCreatureSimulationDetail,
  wanderingMonsterPositionAtTime,
} from "../dist/src/index.js";

function monster() {
  const value = generateSeededWorld("persistent-creature").wanderingMonsters[0];
  assert.ok(value);
  return value;
}

test("HISTORY-002: one creature identity survives every simulation detail", () => {
  const initial = createPersistentCreatureState(monster(), "sand-wyrm");
  const regional = catchUpPersistentCreature(initial, 1_000, "regional");
  const population = catchUpPersistentCreature(regional, 2_000, "population");
  const detailed = catchUpPersistentCreature(population, 3_000, "detailed");

  assert.equal(regional.id, initial.id);
  assert.equal(population.id, initial.id);
  assert.equal(detailed.id, initial.id);
  assert.equal(detailed.speciesId, "sand-wyrm");
  assert.equal(detailed.survivalSeconds, 3_000);
});

test("HISTORY-002: catch-up reuses the authoritative cyclic patrol", () => {
  const input = monster();
  const state = catchUpPersistentCreature(
    createPersistentCreatureState(input, "sand-wyrm", 100),
    2_100,
    "population",
  );
  const expected = wanderingMonsterPositionAtTime(input, 2_000);
  assert.ok(
    greatCircleDistance(
      state.position,
      expected.coordinate,
      input.patrolRoute.planetRadiusMeters,
    ) < 0.001,
  );
  assert.equal(
    state.travelledDistanceMeters,
    input.patrolRoute.speedMetersPerSecond * 2_000,
  );
});

test("HISTORY-002: direct and staged creature catch-up are identical", () => {
  const initial = createPersistentCreatureState(monster(), "sand-wyrm");
  const direct = catchUpPersistentCreature(initial, 20_000, "detailed");
  const staged = catchUpPersistentCreature(
    catchUpPersistentCreature(initial, 5_000, "population"),
    20_000,
    "detailed",
  );
  assert.deepEqual(staged, direct);
});

test("HISTORY-002: observer distance selects three explicit detail levels", () => {
  assert.equal(selectCreatureSimulationDetail(5_000), "detailed");
  assert.equal(selectCreatureSimulationDetail(5_001), "regional");
  assert.equal(selectCreatureSimulationDetail(50_000), "regional");
  assert.equal(selectCreatureSimulationDetail(50_001), "population");
});

test("HISTORY-002: population catch-up is deterministic across update cadence", () => {
  const initial = createCreaturePopulationState(
    "sand-wyrm",
    "region-a",
    100,
    1_000,
    0.05,
  );
  const direct = catchUpCreaturePopulation(
    initial,
    20 * CREATURE_POPULATION_DAY_SECONDS,
  );
  const staged = catchUpCreaturePopulation(
    catchUpCreaturePopulation(initial, 5 * CREATURE_POPULATION_DAY_SECONDS),
    20 * CREATURE_POPULATION_DAY_SECONDS,
  );
  assert.ok(Math.abs(staged.exactIndividuals - direct.exactIndividuals) < 1e-9);
  assert.equal(staged.individuals, direct.individuals);
  assert.ok(direct.individuals > initial.individuals);
  assert.ok(direct.individuals < initial.carryingCapacity);
});

test("HISTORY-002: zero population remains extinct without respawn", () => {
  const initial = createCreaturePopulationState(
    "sand-wyrm",
    "region-a",
    0,
    1_000,
    0.5,
  );
  const later = catchUpCreaturePopulation(
    initial,
    1_000 * CREATURE_POPULATION_DAY_SECONDS,
  );
  assert.equal(later.exactIndividuals, 0);
  assert.equal(later.individuals, 0);
});

test("HISTORY-002: catch-up rejects rewind and invalid population inputs", () => {
  const creature = catchUpPersistentCreature(
    createPersistentCreatureState(monster(), "sand-wyrm"),
    100,
    "regional",
  );
  assert.throws(
    () => catchUpPersistentCreature(creature, 99, "detailed"),
    /must not rewind creature state/,
  );
  assert.throws(
    () => createCreaturePopulationState("species", "region", 101, 100, 0.1),
    /must not exceed carryingCapacity/,
  );
  assert.throws(
    () => selectCreatureSimulationDetail(-1),
    /non-negative finite number/,
  );
});
