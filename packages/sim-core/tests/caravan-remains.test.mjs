import test from "node:test";
import assert from "node:assert/strict";
import {
  CARAVAN_REMAINS_FULL_DEGRADATION_SECONDS,
  createNpcCaravanRemains,
  createRoutePlan,
  createWorldCoordinate,
  greatCircleDistance,
  npcCaravanPositionAtWorldTime,
  projectCaravanRemainsAtWorldTime,
  recoverCaravanRemainsLoot,
} from "../dist/src/index.js";

const PLANET_RADIUS_METERS = 1_000_000;

function caravan() {
  return {
    id: "destroyed-caravan",
    kind: "npc-caravan",
    originCityId: "city-a",
    destinationCityId: "city-b",
    departsAtSeconds: 100,
    visionRadiusMeters: 300,
    interactionRadiusMeters: 500,
    route: createRoutePlan(
      createWorldCoordinate(0, 0),
      [{ bearingDeg: 90, distanceMeters: 5_000 }],
      10,
      PLANET_RADIUS_METERS,
    ),
  };
}

test("CONSEQUENCE-001: destruction creates remains at the exact NPC position", () => {
  const input = caravan();
  const destroyedAt = 350;
  const remains = createNpcCaravanRemains(
    "remains-world",
    input,
    destroyedAt,
    "caravan-contact",
  );
  const expected = npcCaravanPositionAtWorldTime(input, destroyedAt);

  assert.equal(remains.kind, "caravan-remains");
  assert.equal(remains.sourceCaravanId, input.id);
  assert.equal(remains.destroyedAtWorldTimeSeconds, destroyedAt);
  assert.ok(
    greatCircleDistance(
      remains.position,
      expected.coordinate,
      PLANET_RADIUS_METERS,
    ) < 0.001,
  );
});

test("CONSEQUENCE-001: identical world history reproduces remains and loot", () => {
  const input = caravan();
  const first = createNpcCaravanRemains(
    "repeatable",
    input,
    350,
    "monster-contact",
  );
  assert.deepEqual(
    first,
    createNpcCaravanRemains(
      "repeatable",
      input,
      350,
      "monster-contact",
    ),
  );
  assert.ok(first.initialLoot.foodUnits > 0);
  assert.ok(first.initialLoot.waterUnits > 0);
  assert.ok(first.initialLoot.salvageUnits > 0);
});

test("CONSEQUENCE-001: remains and loot degrade deterministically with world time", () => {
  const remains = createNpcCaravanRemains(
    "decay",
    caravan(),
    350,
    "supply-depletion",
  );
  const halfway = projectCaravanRemainsAtWorldTime(
    remains,
    350 + CARAVAN_REMAINS_FULL_DEGRADATION_SECONDS / 2,
  );

  assert.equal(halfway.integrityFraction, 0.5);
  assert.equal(halfway.condition, "weathered");
  assert.deepEqual(halfway.naturallyRemainingLoot, {
    foodUnits: Math.floor(remains.initialLoot.foodUnits / 2),
    waterUnits: Math.floor(remains.initialLoot.waterUnits / 2),
    salvageUnits: Math.floor(remains.initialLoot.salvageUnits / 2),
  });
});

test("CONSEQUENCE-001: ruined remains stay permanently present after loot is gone", () => {
  const remains = createNpcCaravanRemains(
    "permanent",
    caravan(),
    350,
    "monster-contact",
  );
  const projected = projectCaravanRemainsAtWorldTime(
    remains,
    350 + 100 * CARAVAN_REMAINS_FULL_DEGRADATION_SECONDS,
  );

  assert.equal(projected.condition, "ruined");
  assert.equal(projected.integrityFraction, 0);
  assert.deepEqual(projected.availableLoot, {
    foodUnits: 0,
    waterUnits: 0,
    salvageUnits: 0,
  });
  assert.equal(projected.permanentlyPresent, true);
  assert.equal(projected.remains.id, remains.id);
});

test("CONSEQUENCE-001: minimal loot can be recovered only once", () => {
  const remains = createNpcCaravanRemains(
    "recovery",
    caravan(),
    350,
    "caravan-contact",
  );
  const first = recoverCaravanRemainsLoot(remains, 350);
  const second = recoverCaravanRemainsLoot(first.remains, 350);

  assert.deepEqual(first.recovered, remains.initialLoot);
  assert.deepEqual(second.recovered, {
    foodUnits: 0,
    waterUnits: 0,
    salvageUnits: 0,
  });
  assert.deepEqual(second.remains.recoveredLoot, remains.initialLoot);
});

test("CONSEQUENCE-001: late recovery yields only the degraded remainder", () => {
  const remains = createNpcCaravanRemains(
    "late-recovery",
    caravan(),
    350,
    "caravan-contact",
  );
  const atHalfLife = 350 + CARAVAN_REMAINS_FULL_DEGRADATION_SECONDS / 2;
  const projection = projectCaravanRemainsAtWorldTime(remains, atHalfLife);
  const recovery = recoverCaravanRemainsLoot(remains, atHalfLife);
  assert.deepEqual(recovery.recovered, projection.availableLoot);
  assert.notDeepEqual(recovery.recovered, remains.initialLoot);
});

test("CONSEQUENCE-001: time, identity, cause and loot state are validated", () => {
  const input = caravan();
  const remains = createNpcCaravanRemains(
    "validation",
    input,
    350,
    "monster-contact",
  );
  assert.throws(
    () => projectCaravanRemainsAtWorldTime(remains, 349),
    /must not precede destruction/,
  );
  assert.throws(
    () => createNpcCaravanRemains("", input, 350, "monster-contact"),
    /worldSeed must not be empty/,
  );
  assert.throws(
    () => createNpcCaravanRemains("validation", input, 350, "invalid"),
    /destructionCause is invalid/,
  );
  assert.throws(
    () =>
      projectCaravanRemainsAtWorldTime(
        {
          ...remains,
          recoveredLoot: { ...remains.recoveredLoot, foodUnits: -1 },
        },
        350,
      ),
    /non-negative safe integer/,
  );
});
