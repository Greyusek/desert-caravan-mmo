import test from "node:test";
import assert from "node:assert/strict";
import {
  createPlayerDiscoveryLedger,
  recordDirectDiscoveryObservation,
  wasObjectKnownBeforeExpedition,
} from "../dist/src/index.js";

const firstObservation = {
  expeditionNumber: 1,
  objectId: "rumor-mine-city-01",
  objectKind: "mine",
  originCityId: "city-01",
  rumorId: "rumor-city-01-01",
  observedAtSeconds: 6_540,
  segmentIndex: 1,
  routeDistanceMeters: 32_700,
};

test("GAME-011: a direct discovery creates confirmed knowledge without coordinates", () => {
  const result = recordDirectDiscoveryObservation(
    createPlayerDiscoveryLedger("session-world"),
    firstObservation,
  );

  assert.equal(result.status, "first-observation");
  assert.equal(result.ledger.worldSeed, "session-world");
  assert.equal(result.ledger.entries.length, 1);
  assert.deepEqual(result.entry, {
    objectId: "rumor-mine-city-01",
    objectKind: "mine",
    source: "direct-observation",
    confidence: "confirmed",
    firstObservation: {
      ...firstObservation,
      source: "direct-observation",
      confidence: "confirmed",
    },
    latestObservation: {
      ...firstObservation,
      source: "direct-observation",
      confidence: "confirmed",
    },
    observationCount: 1,
  });
  assert.equal("position" in result.entry, false);
  assert.equal("coordinate" in result.entry, false);
});

test("GAME-011: repeated rendering records one observation per expedition", () => {
  const first = recordDirectDiscoveryObservation(
    createPlayerDiscoveryLedger("session-world"),
    firstObservation,
  );
  const duplicate = recordDirectDiscoveryObservation(
    first.ledger,
    { ...firstObservation, observedAtSeconds: 9_999 },
  );

  assert.equal(duplicate.status, "already-recorded");
  assert.equal(duplicate.ledger, first.ledger);
  assert.equal(duplicate.entry.observationCount, 1);
  assert.equal(duplicate.entry.latestObservation.observedAtSeconds, 6_540);
});

test("GAME-011: a later expedition updates provenance and observation count", () => {
  const first = recordDirectDiscoveryObservation(
    createPlayerDiscoveryLedger("session-world"),
    firstObservation,
  );
  const second = recordDirectDiscoveryObservation(first.ledger, {
    ...firstObservation,
    expeditionNumber: 2,
    observedAtSeconds: 6_600,
    routeDistanceMeters: 33_000,
  });

  assert.equal(second.status, "reobserved");
  assert.equal(second.entry.observationCount, 2);
  assert.equal(second.entry.firstObservation.expeditionNumber, 1);
  assert.equal(second.entry.latestObservation.expeditionNumber, 2);
  assert.equal(second.entry.latestObservation.routeDistanceMeters, 33_000);
});

test("GAME-011: knowledge affects only expeditions after the first observation", () => {
  const { ledger } = recordDirectDiscoveryObservation(
    createPlayerDiscoveryLedger("session-world"),
    firstObservation,
  );

  assert.equal(
    wasObjectKnownBeforeExpedition(ledger, firstObservation.objectId, 1),
    false,
  );
  assert.equal(
    wasObjectKnownBeforeExpedition(ledger, firstObservation.objectId, 2),
    true,
  );
  assert.equal(wasObjectKnownBeforeExpedition(ledger, "unknown", 2), false);
});

test("GAME-011: invalid ledgers and observations are rejected", () => {
  assert.throws(() => createPlayerDiscoveryLedger(""), /worldSeed/);
  assert.throws(
    () =>
      recordDirectDiscoveryObservation(
        createPlayerDiscoveryLedger("session-world"),
        { ...firstObservation, expeditionNumber: 0 },
      ),
    /expeditionNumber/,
  );
  assert.throws(
    () =>
      recordDirectDiscoveryObservation(
        createPlayerDiscoveryLedger("session-world"),
        { ...firstObservation, routeDistanceMeters: -1 },
      ),
    /routeDistanceMeters/,
  );
  const first = recordDirectDiscoveryObservation(
    createPlayerDiscoveryLedger("session-world"),
    firstObservation,
  );
  const third = recordDirectDiscoveryObservation(first.ledger, {
    ...firstObservation,
    expeditionNumber: 3,
  });
  assert.throws(
    () =>
      recordDirectDiscoveryObservation(third.ledger, {
        ...firstObservation,
        expeditionNumber: 2,
      }),
    /must not precede the latest observation/,
  );
});
