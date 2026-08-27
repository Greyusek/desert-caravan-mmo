import test from "node:test";
import assert from "node:assert/strict";
import {
  createNpcCaravanRemains,
  createPlayerWorldEvidenceState,
  createRoutePlan,
  createWorldCoordinate,
  deriveNpcCaravanTrackMarks,
  observeCaravanTrack,
  projectCaravanRemainsAtWorldTime,
  recordObservedCaravanRemains,
  recordObservedCaravanTrack,
} from "../dist/src/index.js";

const PLANET_RADIUS_METERS = 1_000_000;

function caravan() {
  return {
    id: "evidence-caravan",
    kind: "npc-caravan",
    originCityId: "city-a",
    destinationCityId: "city-b",
    departsAtSeconds: 0,
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

function trackObservation(observedAt = 100) {
  const [mark] = deriveNpcCaravanTrackMarks(caravan(), 50);
  assert.ok(mark);
  return observeCaravanTrack(mark, observedAt);
}

function remainsObservation(observedAt = 100) {
  const remains = createNpcCaravanRemains(
    "evidence-world",
    caravan(),
    50,
    "caravan-contact",
  );
  return projectCaravanRemainsAtWorldTime(remains, observedAt);
}

test("KNOWLEDGE-001: track knowledge records source, time and confidence", () => {
  const result = recordObservedCaravanTrack(
    createPlayerWorldEvidenceState("evidence-world"),
    trackObservation(),
  );

  assert.equal(result.status, "first-observation");
  assert.equal(result.entry.confidence, "probable");
  assert.equal(result.entry.firstObservedAtWorldTimeSeconds, 100);
  assert.deepEqual(result.entry.provenance, [
    {
      source: "direct-track-observation",
      sourceEvidenceId: result.entry.subjectId,
      observedAtWorldTimeSeconds: 100,
      confidence: "probable",
    },
  ]);
});

test("KNOWLEDGE-001: remains knowledge strips all authoritative coordinates", () => {
  const result = recordObservedCaravanRemains(
    createPlayerWorldEvidenceState("evidence-world"),
    remainsObservation(),
  );
  const serialized = JSON.stringify(result.state);

  assert.equal(result.entry.confidence, "confirmed");
  assert.equal(result.entry.facts.kind, "caravan-remains");
  assert.equal(result.entry.facts.lootAvailability, "recoverable");
  assert.equal(serialized.includes("latitude"), false);
  assert.equal(serialized.includes("longitude"), false);
  assert.equal(serialized.includes("sourceCaravanId"), false);
  assert.equal(serialized.includes("destroyedAtWorldTimeSeconds"), false);
});

test("KNOWLEDGE-001: every accepted observation appends one journal event", () => {
  const first = recordObservedCaravanTrack(
    createPlayerWorldEvidenceState("evidence-world"),
    trackObservation(),
  );
  const second = recordObservedCaravanRemains(
    first.state,
    remainsObservation(120),
  );

  assert.equal(second.state.journal.length, 2);
  assert.equal(second.journalEvent?.kind, "world-evidence-observed");
  assert.equal(second.journalEvent?.atWorldTimeSeconds, 120);
  assert.equal(second.journalEvent?.source, "direct-remains-observation");
  assert.equal(second.journalEvent?.confidence, "confirmed");
});

test("KNOWLEDGE-001: repeated rendering is idempotent", () => {
  const state = createPlayerWorldEvidenceState("evidence-world");
  const observation = trackObservation();
  const first = recordObservedCaravanTrack(state, observation);
  const repeated = recordObservedCaravanTrack(first.state, observation);

  assert.equal(repeated.status, "already-recorded");
  assert.equal(repeated.state, first.state);
  assert.equal(repeated.journalEvent, null);
  assert.equal(repeated.entry.provenance.length, 1);
  assert.equal(repeated.state.journal.length, 1);
});

test("KNOWLEDGE-001: later observation preserves provenance and updates facts", () => {
  const first = recordObservedCaravanRemains(
    createPlayerWorldEvidenceState("evidence-world"),
    remainsObservation(100),
  );
  const laterProjection = remainsObservation(8 * 24 * 60 * 60);
  const later = recordObservedCaravanRemains(first.state, laterProjection);

  assert.equal(later.status, "reobserved");
  assert.equal(later.entry.provenance.length, 2);
  assert.equal(later.entry.firstObservedAtWorldTimeSeconds, 100);
  assert.equal(
    later.entry.latestObservedAtWorldTimeSeconds,
    laterProjection.worldTimeSeconds,
  );
  assert.equal(later.entry.facts.kind, "caravan-remains");
  assert.equal(later.entry.facts.condition, "ruined");
  assert.equal(later.entry.facts.lootAvailability, "empty");
  assert.equal(later.entry.confidence, "confirmed");
});

test("KNOWLEDGE-001: track and remains identities remain separate", () => {
  const track = recordObservedCaravanTrack(
    createPlayerWorldEvidenceState("evidence-world"),
    trackObservation(),
  );
  const remains = recordObservedCaravanRemains(
    track.state,
    remainsObservation(),
  );
  assert.equal(remains.state.entries.length, 2);
  assert.deepEqual(
    remains.state.entries.map((entry) => entry.evidenceKind),
    ["caravan-track", "caravan-remains"],
  );
});

test("KNOWLEDGE-001: state and observation chronology are validated", () => {
  assert.throws(
    () => createPlayerWorldEvidenceState(""),
    /worldSeed must not be empty/,
  );
  const first = recordObservedCaravanTrack(
    createPlayerWorldEvidenceState("evidence-world"),
    trackObservation(100),
  );
  assert.throws(
    () => recordObservedCaravanTrack(first.state, trackObservation(99)),
    /must not precede the latest observation/,
  );
  assert.throws(
    () =>
      recordObservedCaravanTrack(
        { ...first.state, journal: null },
        trackObservation(101),
      ),
    /state.journal must be an array/,
  );
});
