import test from "node:test";
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
  resolveMonsterPowerContact,
  resolvePveMonsterContact,
} from "../dist/src/index.js";

const PLANET_RADIUS_METERS = 1_000_000;
const SPEED_METERS_PER_SECOND = 10;

function scenario() {
  const crossing = createWorldCoordinate(0, 0);
  const west = destinationPoint(crossing, 270, 1_000, PLANET_RADIUS_METERS);
  const south = destinationPoint(crossing, 180, 1_000, PLANET_RADIUS_METERS);
  const monster = {
    id: "tactical-contact-monster",
    kind: "wandering-monster",
    power: 90,
    visionRadiusMeters: 300,
    interactionRadiusMeters: 100,
    patrolRoute: createRoutePlan(
      west,
      [
        { bearingDeg: 90, distanceMeters: 2_000 },
        { bearingDeg: 270, distanceMeters: 2_000 },
      ],
      SPEED_METERS_PER_SECOND,
      PLANET_RADIUS_METERS,
    ),
  };
  const expeditionRoute = createRoutePlan(
    south,
    [{ bearingDeg: 0, distanceMeters: 2_000 }],
    SPEED_METERS_PER_SECOND,
    PLANET_RADIUS_METERS,
  );
  const contact = findFirstExpeditionMonsterContact(expeditionRoute, monster);
  assert.ok(contact);
  const creature = createPersistentCreatureState(monster, "crossing-beast");
  const sourceField = createTacticalBattlefield("tactical-007-source");
  const sourceUnits = deployTacticalUnits(sourceField, [
    {
      id: "source-guard",
      side: "caravan",
      unitClass: "guard",
      source: { kind: "caravan-member", id: "member-guard" },
    },
    {
      id: "source-monster",
      side: "hostile",
      unitClass: "monster",
      source: { kind: "persistent-creature", id: creature.id },
    },
  ]);
  const caravan = {
    ...createTradeCaravanState("contact-caravan", "city-01", 100, 20),
    cargo: {
      capacityCargoUnits: 20,
      stacks: [{ goodId: "ore", units: 5, costBasisCredits: 110 }],
    },
  };
  const worldState = createTacticalWorldState(caravan, sourceUnits, creature);
  const guardId = pveCaravanUnitId("member-guard");
  const monsterId = pveCreatureUnitId(creature.id);
  const commands = [
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
  ];
  return { contact, creature, worldState, guardId, monsterId, commands };
}

function tacticalInput(overrides = {}) {
  const state = scenario();
  return {
    state,
    input: {
      contact: state.contact,
      battleId: "contact-battle-007",
      battlefieldSeed: "tactical-007-contact",
      worldState: state.worldState,
      commands: state.commands,
      ...overrides,
    },
  };
}

test("TACTICAL-007: tactical is the default PvE contact resolution mode", () => {
  const { input, state } = tacticalInput();
  const result = resolvePveMonsterContact(input);

  assert.equal(result.mode, "TACTICAL");
  assert.equal(result.contact, state.contact);
  assert.equal(result.battle.status, "complete");
  assert.equal(result.battle.winner, "caravan");
  assert.equal(result.legacyPowerResolution, null);
  assert.equal(result.status, "monster-defeated");
  assert.equal(result.routeDisposition, "continue");
  assert.equal(result.terminal, false);
});

test("TACTICAL-007: real source identities and health cross the tactical boundary", () => {
  const { input, state } = tacticalInput();
  const woundedWorld = {
    ...input.worldState,
    members: input.worldState.members.map((member) => ({ ...member, health: 9 })),
    creature: { ...input.worldState.creature, health: 8 },
  };
  const result = resolvePveMonsterContact({
    ...input,
    worldState: woundedWorld,
    commands: input.commands.slice(0, 9),
  });

  assert.deepEqual(
    result.initialBattle.units.map((unit) => [unit.id, unit.source.id, unit.health]),
    [
      [state.guardId, "member-guard", 9],
      [state.monsterId, state.creature.id, 8],
    ],
  );
  assert.equal(result.worldState.members[0].health, 3);
  assert.equal(result.worldState.members[0].status, "alive");
  assert.equal(result.worldState.creature.health, 0);
  assert.equal(result.worldState.creature.status, "dead");
});

test("TACTICAL-007: completed battle and conserved cargo return once to world state", () => {
  const { input } = tacticalInput();
  const result = resolvePveMonsterContact(input);

  assert.deepEqual(result.worldState.appliedBattleIds, [input.battleId]);
  assert.equal(result.worldState.members[0].health, 3);
  assert.equal(result.worldState.creature.status, "dead");
  assert.deepEqual(result.worldState.caravan.cargo, input.worldState.caravan.cargo);
  assert.equal(result.cargoOutcome.conservation.every((entry) => entry.conserved), true);
  assert.throws(
    () => resolvePveMonsterContact({ ...input, worldState: result.worldState }),
    /living persistent creature/,
  );
});

test("TACTICAL-007: hostile tactical victory fails the expedition and captures cargo", () => {
  const { input } = tacticalInput();
  const weakenedWorld = {
    ...input.worldState,
    members: input.worldState.members.map((member) => ({ ...member, health: 5 })),
  };
  const result = resolvePveMonsterContact({
    ...input,
    worldState: weakenedWorld,
    commands: input.commands.slice(0, 8),
  });

  assert.equal(result.battle.winner, "hostile");
  assert.equal(result.status, "expedition-defeated");
  assert.equal(result.routeDisposition, "fail");
  assert.equal(result.terminal, true);
  assert.equal(result.worldState.members[0].status, "dead");
  assert.equal(result.worldState.creature.status, "alive");
  assert.deepEqual(result.worldState.caravan.cargo.stacks, []);
  assert.deepEqual(
    result.worldState.battleResults[0].capturedCargo,
    input.worldState.caravan.cargo,
  );
});

test("TACTICAL-007: authoritative contact must match the persistent creature", () => {
  const { input } = tacticalInput();
  assert.throws(
    () => resolvePveMonsterContact({
      ...input,
      contact: { ...input.contact, monsterId: "other-monster" },
    }),
    /contact monster must match/,
  );
  assert.throws(
    () => resolvePveMonsterContact({
      ...input,
      contact: { ...input.contact, monsterPower: input.contact.monsterPower + 1 },
    }),
    /contact monster power must match/,
  );
});

test("TACTICAL-007: an incomplete tactical command sequence cannot return to world", () => {
  const { input } = tacticalInput({ commands: [] });
  assert.throws(
    () => resolvePveMonsterContact(input),
    /commands must complete the battle/,
  );
});

test("TACTICAL-007: explicit LEGACY_POWER is exactly the GAME-005 compatibility path", () => {
  const { contact } = scenario();
  const result = resolvePveMonsterContact({
    mode: "LEGACY_POWER",
    contact,
    doctrine: "ACCEPT_FIGHT",
    playerPower: 80,
  });
  const direct = resolveMonsterPowerContact(
    contact.monsterPower,
    "ACCEPT_FIGHT",
    80,
  );

  assert.deepEqual(result.legacyPowerResolution, direct);
  assert.equal(result.status, direct.status);
  assert.equal(result.routeDisposition, direct.routeDisposition);
  assert.equal(result.battlefield, null);
  assert.equal(result.battle, null);
  assert.equal(result.worldState, null);
});

test("TACTICAL-007: legacy FLEE preserves the existing GAME-006 result", () => {
  const { contact } = scenario();
  const fleeAttempt = {
    caravanSpeedMetersPerSecond: 5,
    monsterSpeedMetersPerSecond: 4,
    contactSeparationMeters: 100,
    safeSeparationMeters: 500,
  };
  const result = resolvePveMonsterContact({
    mode: "LEGACY_POWER",
    contact: { ...contact, monsterPower: 110 },
    doctrine: "FLEE",
    fleeAttempt,
  });

  assert.deepEqual(
    result.legacyPowerResolution,
    resolveMonsterPowerContact(110, "FLEE", 100, fleeAttempt),
  );
  assert.equal(result.status, "flee-succeeded");
});

test("TACTICAL-007: identical contact, seed and commands reproduce full resolution", () => {
  const first = tacticalInput().input;
  const second = tacticalInput().input;
  assert.deepEqual(
    resolvePveMonsterContact(first),
    resolvePveMonsterContact(second),
  );
});
