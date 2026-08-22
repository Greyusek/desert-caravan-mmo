import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_FLEE_SAFE_SEPARATION_MULTIPLIER,
  resolveFleeAttempt,
} from "../dist/src/index.js";

const fasterCaravan = {
  caravanSpeedMetersPerSecond: 2,
  monsterSpeedMetersPerSecond: 1.5,
  contactSeparationMeters: 500,
  safeSeparationMeters: 1_000,
};

test("GAME-006: a strictly faster caravan opens the safe separation", () => {
  assert.equal(DEFAULT_FLEE_SAFE_SEPARATION_MULTIPLIER, 2);
  assert.deepEqual(resolveFleeAttempt(fasterCaravan), {
    ...fasterCaravan,
    relativeSpeedMetersPerSecond: 0.5,
    requiredSeparationGainMeters: 500,
    secondsToSafeSeparation: 1_000,
    status: "flee-succeeded",
    reason: "caravan-faster",
    routeDisposition: "continue",
    escaped: true,
    expeditionDefeated: false,
    terminal: false,
  });
});

test("GAME-006: a slower caravan deterministically fails to flee", () => {
  const result = resolveFleeAttempt({
    ...fasterCaravan,
    caravanSpeedMetersPerSecond: 1,
  });

  assert.equal(result.relativeSpeedMetersPerSecond, -0.5);
  assert.equal(result.secondsToSafeSeparation, null);
  assert.equal(result.status, "flee-failed");
  assert.equal(result.routeDisposition, "fail");
  assert.equal(result.expeditionDefeated, true);
  assert.equal(result.terminal, true);
});

test("GAME-006: equal speed favors the pursuer instead of creating a stalemate", () => {
  const result = resolveFleeAttempt({
    ...fasterCaravan,
    caravanSpeedMetersPerSecond: 1.5,
  });

  assert.equal(result.relativeSpeedMetersPerSecond, 0);
  assert.equal(result.status, "flee-failed");
  assert.equal(result.reason, "caravan-not-faster");
});

test("GAME-006: the same movement inputs reproduce the full flee result", () => {
  assert.deepEqual(
    resolveFleeAttempt(fasterCaravan),
    resolveFleeAttempt(fasterCaravan),
  );
});

test("GAME-006: movement and separation inputs are validated", () => {
  assert.throws(
    () =>
      resolveFleeAttempt({
        ...fasterCaravan,
        caravanSpeedMetersPerSecond: 0,
      }),
    /caravanSpeedMetersPerSecond must be a positive finite number/,
  );
  assert.throws(
    () =>
      resolveFleeAttempt({
        ...fasterCaravan,
        monsterSpeedMetersPerSecond: Number.NaN,
      }),
    /monsterSpeedMetersPerSecond must be a positive finite number/,
  );
  assert.throws(
    () =>
      resolveFleeAttempt({
        ...fasterCaravan,
        contactSeparationMeters: -1,
      }),
    /contactSeparationMeters must be a non-negative finite number/,
  );
  assert.throws(
    () =>
      resolveFleeAttempt({
        ...fasterCaravan,
        safeSeparationMeters: 500,
      }),
    /safeSeparationMeters must be greater than contactSeparationMeters/,
  );
});
