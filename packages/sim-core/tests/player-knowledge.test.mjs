import test from "node:test";
import assert from "node:assert/strict";
import {
  createKnownObjectReturnNavigation,
  createPlayerDiscoveryLedger,
  createPlayerTravelLedger,
  recordDirectDiscoveryObservation,
  recordExpeditionTravelProgress,
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
  originBearingDeg: 307.75,
  originDistanceMeters: 32_850,
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
  assert.equal(JSON.stringify(result.entry).includes("latitude"), false);
  assert.equal(JSON.stringify(result.entry).includes("longitude"), false);
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
  assert.throws(
    () =>
      recordDirectDiscoveryObservation(
        createPlayerDiscoveryLedger("session-world"),
        { ...firstObservation, originBearingDeg: Number.NaN },
      ),
    /originBearingDeg/,
  );
  assert.throws(
    () =>
      recordDirectDiscoveryObservation(
        createPlayerDiscoveryLedger("session-world"),
        { ...firstObservation, originDistanceMeters: 0 },
      ),
    /originDistanceMeters/,
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

test("GAME-012: a known entry produces relative navigation without coordinates", () => {
  const { ledger } = recordDirectDiscoveryObservation(
    createPlayerDiscoveryLedger("session-world"),
    { ...firstObservation, originBearingDeg: -52.25 },
  );

  const navigation = createKnownObjectReturnNavigation(
    ledger,
    firstObservation.objectId,
  );

  assert.deepEqual(navigation, {
    objectId: "rumor-mine-city-01",
    objectKind: "mine",
    originCityId: "city-01",
    source: "direct-observation",
    confidence: "confirmed",
    firstObservedInExpedition: 1,
    command: {
      bearingDeg: 307.75,
      distanceMeters: 32_850,
    },
  });
  assert.equal(JSON.stringify(navigation).includes("latitude"), false);
  assert.equal(JSON.stringify(navigation).includes("longitude"), false);
});

test("GAME-012: return navigation stays anchored to the first observation", () => {
  const first = recordDirectDiscoveryObservation(
    createPlayerDiscoveryLedger("session-world"),
    firstObservation,
  );
  const second = recordDirectDiscoveryObservation(first.ledger, {
    ...firstObservation,
    expeditionNumber: 2,
    originCityId: "city-07",
    originBearingDeg: 120,
    originDistanceMeters: 50_000,
  });

  const navigation = createKnownObjectReturnNavigation(
    second.ledger,
    firstObservation.objectId,
  );

  assert.equal(navigation.originCityId, "city-01");
  assert.deepEqual(navigation.command, {
    bearingDeg: 307.75,
    distanceMeters: 32_850,
  });
});

test("GAME-012: return navigation rejects an unknown selection", () => {
  assert.throws(
    () =>
      createKnownObjectReturnNavigation(
        createPlayerDiscoveryLedger("session-world"),
        "unknown-object",
      ),
    /known ledger entry/,
  );
});

test("GAME-014: zero movement does not invent a travelled corridor", () => {
  const ledger = createPlayerTravelLedger("session-world");
  const result = recordExpeditionTravelProgress(ledger, {
    expeditionNumber: 1,
    originCityId: "city-01",
    routeCommands: [{ bearingDeg: 0, distanceMeters: 10_000 }],
    traveledDistanceMeters: 0,
  });

  assert.equal(result.status, "no-progress");
  assert.equal(result.ledger, ledger);
  assert.equal(result.track, null);
  assert.deepEqual(result.ledger.tracks, []);
});

test("GAME-014: only the executed route prefix enters session knowledge", () => {
  const result = recordExpeditionTravelProgress(
    createPlayerTravelLedger("session-world"),
    {
      expeditionNumber: 1,
      originCityId: "city-01",
      routeCommands: [
        { bearingDeg: 0, distanceMeters: 10_000 },
        { bearingDeg: 90, distanceMeters: 20_000 },
        { bearingDeg: 180, distanceMeters: 30_000 },
      ],
      traveledDistanceMeters: 15_000,
    },
  );

  assert.equal(result.status, "first-progress");
  assert.deepEqual(result.track, {
    expeditionNumber: 1,
    originCityId: "city-01",
    legs: [
      { bearingDeg: 0, distanceMeters: 10_000 },
      { bearingDeg: 90, distanceMeters: 5_000 },
    ],
    traveledDistanceMeters: 15_000,
  });
  assert.equal(JSON.stringify(result.track).includes("30000"), false);
  assert.equal(JSON.stringify(result.track).includes("latitude"), false);
  assert.equal(JSON.stringify(result.track).includes("longitude"), false);
});

test("GAME-014: repeated renders and clock rewind retain maximum progress", () => {
  const input = {
    expeditionNumber: 1,
    originCityId: "city-01",
    routeCommands: [
      { bearingDeg: 0, distanceMeters: 10_000 },
      { bearingDeg: 90, distanceMeters: 10_000 },
    ],
    traveledDistanceMeters: 5_000,
  };
  const first = recordExpeditionTravelProgress(
    createPlayerTravelLedger("session-world"),
    input,
  );
  const duplicate = recordExpeditionTravelProgress(first.ledger, input);
  const progressed = recordExpeditionTravelProgress(duplicate.ledger, {
    ...input,
    traveledDistanceMeters: 12_000,
  });
  const rewound = recordExpeditionTravelProgress(progressed.ledger, {
    ...input,
    traveledDistanceMeters: 7_000,
  });

  assert.equal(duplicate.status, "unchanged");
  assert.equal(duplicate.ledger, first.ledger);
  assert.equal(progressed.status, "progressed");
  assert.equal(progressed.track?.traveledDistanceMeters, 12_000);
  assert.deepEqual(progressed.track?.legs, [
    { bearingDeg: 0, distanceMeters: 10_000 },
    { bearingDeg: 90, distanceMeters: 2_000 },
  ]);
  assert.equal(rewound.status, "unchanged");
  assert.equal(rewound.ledger, progressed.ledger);
  assert.equal(rewound.track?.traveledDistanceMeters, 12_000);
});

test("GAME-014: extending progress cannot rewrite an executed bearing", () => {
  const first = recordExpeditionTravelProgress(
    createPlayerTravelLedger("session-world"),
    {
      expeditionNumber: 1,
      originCityId: "city-01",
      routeCommands: [{ bearingDeg: -10, distanceMeters: 10_000 }],
      traveledDistanceMeters: 5_000,
    },
  );

  assert.equal(first.track?.legs[0]?.bearingDeg, 350);
  assert.throws(
    () =>
      recordExpeditionTravelProgress(first.ledger, {
        expeditionNumber: 1,
        originCityId: "city-01",
        routeCommands: [{ bearingDeg: 20, distanceMeters: 10_000 }],
        traveledDistanceMeters: 6_000,
      }),
    /preserve recorded travel/,
  );
});

test("GAME-014: expeditions from different cities remain separate tracks", () => {
  const first = recordExpeditionTravelProgress(
    createPlayerTravelLedger("session-world"),
    {
      expeditionNumber: 1,
      originCityId: "city-01",
      routeCommands: [{ bearingDeg: 45, distanceMeters: 8_000 }],
      traveledDistanceMeters: 8_000,
    },
  );
  const second = recordExpeditionTravelProgress(first.ledger, {
    expeditionNumber: 2,
    originCityId: "city-07",
    routeCommands: [{ bearingDeg: 225, distanceMeters: 9_000 }],
    traveledDistanceMeters: 9_000,
  });

  assert.deepEqual(
    second.ledger.tracks.map((track) => track.originCityId),
    ["city-01", "city-07"],
  );
  assert.throws(
    () =>
      recordExpeditionTravelProgress(second.ledger, {
        expeditionNumber: 1,
        originCityId: "city-02",
        routeCommands: [{ bearingDeg: 45, distanceMeters: 10_000 }],
        traveledDistanceMeters: 10_000,
      }),
    /originCityId/,
  );
});
