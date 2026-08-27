import test from "node:test";
import assert from "node:assert/strict";
import {
  LEGENDARY_SURVIVAL_SECONDS,
  catchUpPersistentCreature,
  createCreatureIntelligenceReport,
  createCreatureLegendHistory,
  createPersistentCreatureState,
  estimateCreatureStrength,
  generateSeededWorld,
  recordCreatureLegendEvent,
} from "../dist/src/index.js";

function creatureAt(worldTimeSeconds = 2_000) {
  const monster = generateSeededWorld("creature-history").wanderingMonsters[0];
  assert.ok(monster);
  return catchUpPersistentCreature(
    createPersistentCreatureState(monster, "sand-wyrm"),
    worldTimeSeconds,
    "detailed",
  );
}

function legendEvent(history, id, type, worldTimeSeconds, extra = {}) {
  return recordCreatureLegendEvent(history, {
    id,
    type,
    worldTimeSeconds,
    ...extra,
  });
}

test("HISTORY-003: creature intelligence stores observation, age and direction", () => {
  const report = createCreatureIntelligenceReport({
    state: creatureAt(),
    recordedAtWorldTimeSeconds: 2_000 + 2 * 60 * 60,
    abilities: ["burrow", "ambush"],
    colors: {
      armorColor: "green",
      physicalAttackColor: "orange",
      magicColor: "blue",
    },
  });
  assert.equal(report.observedAtWorldTimeSeconds, 2_000);
  assert.equal(report.approximateAge, "recent");
  assert.match(report.approximateDirection, /north|east|south|west/);
  assert.deepEqual(report.abilities, ["ambush", "burrow"]);
});

test("HISTORY-003: intelligence preserves the three design-contract color channels", () => {
  const report = createCreatureIntelligenceReport({
    state: creatureAt(),
    recordedAtWorldTimeSeconds: 2_000,
    abilities: [],
    colors: {
      armorColor: "green",
      physicalAttackColor: "orange",
      magicColor: "blue",
    },
  });
  assert.deepEqual(report.colors, {
    armorColor: "green",
    physicalAttackColor: "orange",
    magicColor: "blue",
  });
});

test("HISTORY-003: player-facing creature intelligence contains no coordinates", () => {
  const report = createCreatureIntelligenceReport({
    state: creatureAt(),
    recordedAtWorldTimeSeconds: 2_000,
    abilities: ["ambush"],
    colors: {
      armorColor: "unknown",
      physicalAttackColor: "unknown",
      magicColor: "unknown",
    },
  });
  const serialized = JSON.stringify(report);
  assert.doesNotMatch(serialized, /latitude|longitude|coordinate|position|route/i);
});

test("HISTORY-003: strength bands stay deterministic around existing powers", () => {
  assert.equal(estimateCreatureStrength(90), "weak");
  assert.equal(estimateCreatureStrength(91), "dangerous");
  assert.equal(estimateCreatureStrength(110), "dangerous");
  assert.equal(estimateCreatureStrength(111), "overwhelming");
});

test("HISTORY-003: an ordinary creature is not born legendary", () => {
  const history = createCreatureLegendHistory(creatureAt(0));
  assert.equal(history.isLegendary, false);
  assert.equal(history.victoryCount, 0);
  assert.deepEqual(history.events, []);
});

test("HISTORY-003: survival, victories and object control earn one legend", () => {
  let history = createCreatureLegendHistory(creatureAt(0));
  history = legendEvent(history, "victory-1", "victory", LEGENDARY_SURVIVAL_SECONDS, {
    defeatedEntityId: "rival-1",
  });
  history = legendEvent(history, "victory-2", "victory", LEGENDARY_SURVIVAL_SECONDS, {
    defeatedEntityId: "rival-2",
  });
  history = legendEvent(history, "victory-3", "victory", LEGENDARY_SURVIVAL_SECONDS, {
    defeatedEntityId: "rival-3",
  });
  assert.equal(history.isLegendary, false);
  history = legendEvent(
    history,
    "control-oasis",
    "object-controlled",
    LEGENDARY_SURVIVAL_SECONDS,
    { objectId: "oasis-01" },
  );
  assert.equal(history.isLegendary, true);
  assert.equal(
    history.becameLegendaryAtWorldTimeSeconds,
    LEGENDARY_SURVIVAL_SECONDS,
  );
});

test("HISTORY-003: final death retains history and rejects a respawn continuation", () => {
  let history = createCreatureLegendHistory(creatureAt(0));
  history = legendEvent(history, "death-1", "death", 100);
  assert.equal(history.isAlive, false);
  assert.equal(history.endedAtWorldTimeSeconds, 100);
  assert.equal(history.events.length, 1);
  assert.throws(
    () =>
      legendEvent(history, "victory-after-death", "victory", 101, {
        defeatedEntityId: "traveller",
      }),
    /dead creature history is final/,
  );
});

test("HISTORY-003: repeated event ids are idempotent, including death", () => {
  let history = createCreatureLegendHistory(creatureAt(0));
  const victory = {
    id: "victory-1",
    type: "victory",
    worldTimeSeconds: 10,
    defeatedEntityId: "rival-1",
  };
  history = recordCreatureLegendEvent(history, victory);
  assert.equal(recordCreatureLegendEvent(history, victory), history);
  history = legendEvent(history, "death-1", "death", 20);
  assert.equal(
    recordCreatureLegendEvent(history, {
      id: "death-1",
      type: "death",
      worldTimeSeconds: 20,
    }),
    history,
  );
});

test("HISTORY-003: released objects leave history without current control", () => {
  let history = createCreatureLegendHistory(creatureAt(0));
  history = legendEvent(history, "control", "object-controlled", 10, {
    objectId: "mine-01",
  });
  history = legendEvent(history, "release", "object-released", 20, {
    objectId: "mine-01",
  });
  assert.deepEqual(history.controlledObjectIds, []);
  assert.equal(history.events.length, 2);
});

test("HISTORY-003: intelligence and legend inputs are validated", () => {
  assert.throws(
    () => estimateCreatureStrength(-1),
    /non-negative finite number/,
  );
  assert.throws(
    () =>
      createCreatureIntelligenceReport({
        state: creatureAt(),
        recordedAtWorldTimeSeconds: 1_999,
        abilities: [],
        colors: {
          armorColor: "green",
          physicalAttackColor: "orange",
          magicColor: "blue",
        },
      }),
    /must not precede observation/,
  );
  const history = createCreatureLegendHistory(creatureAt(0));
  assert.throws(
    () => legendEvent(history, "death", "death", -1),
    /non-negative finite number/,
  );
});
