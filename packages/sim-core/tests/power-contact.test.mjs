import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PLAYER_POWER,
  resolveMonsterPowerContact,
} from "../dist/src/index.js";

test("GAME-005: default Player Power 100 defeats Monster Power 90", () => {
  const result = resolveMonsterPowerContact(90);

  assert.equal(DEFAULT_PLAYER_POWER, 100);
  assert.deepEqual(result, {
    playerPower: 100,
    monsterPower: 90,
    powerDelta: 10,
    doctrine: null,
    status: "monster-defeated",
    routeDisposition: "continue",
    monsterDefeated: true,
    expeditionDefeated: false,
    terminal: false,
  });
});

test("GAME-005: FLEE pauses against Monster Power 110 without inventing escape odds", () => {
  const result = resolveMonsterPowerContact(110, "FLEE");

  assert.equal(result.powerDelta, -10);
  assert.equal(result.status, "flee-required");
  assert.equal(result.routeDisposition, "pause");
  assert.equal(result.terminal, false);
});

test("GAME-005: ACCEPT_FIGHT against Monster Power 110 is fatal for MVP", () => {
  const result = resolveMonsterPowerContact(110, "ACCEPT_FIGHT");

  assert.equal(result.status, "expedition-defeated");
  assert.equal(result.routeDisposition, "fail");
  assert.equal(result.expeditionDefeated, true);
  assert.equal(result.terminal, true);
});

test("GAME-005: equal Power is not treated as an automatic victory", () => {
  assert.equal(
    resolveMonsterPowerContact(100, "FLEE").status,
    "flee-required",
  );
  assert.equal(
    resolveMonsterPowerContact(100, "ACCEPT_FIGHT").status,
    "expedition-defeated",
  );
});

test("GAME-005: custom Player Power remains deterministic and explicit", () => {
  assert.deepEqual(
    resolveMonsterPowerContact(110, "FLEE", 120),
    resolveMonsterPowerContact(110, "FLEE", 120),
  );
  assert.equal(
    resolveMonsterPowerContact(110, "FLEE", 120).status,
    "monster-defeated",
  );
});

test("GAME-005: invalid powers and doctrine are rejected", () => {
  assert.throws(
    () => resolveMonsterPowerContact(0),
    /monsterPower must be a positive finite number/,
  );
  assert.throws(
    () => resolveMonsterPowerContact(90, "FLEE", Number.NaN),
    /playerPower must be a positive finite number/,
  );
  assert.throws(
    () => resolveMonsterPowerContact(110, "CHARGE"),
    /doctrine must be FLEE or ACCEPT_FIGHT/,
  );
});
