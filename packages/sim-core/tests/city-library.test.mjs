import test from "node:test";
import assert from "node:assert/strict";
import {
  copyCityLibraryKnowledgeToBundle,
  copyPlayerKnowledgeToBundle,
  createCityLibraryArchive,
  createPlayerWorldEvidenceState,
  depositKnowledgeBundle,
  recordObservedCaravanTrack,
} from "../dist/src/index.js";

function observation(trackId, observedAtWorldTimeSeconds, approximateAge = "fresh") {
  return {
    trackId,
    kind: "caravan-track",
    observedAtWorldTimeSeconds,
    approximateAge,
    approximateDirection: "east",
  };
}

function playerState() {
  return recordObservedCaravanTrack(
    createPlayerWorldEvidenceState("library-world"),
    observation("track-a", 100),
  ).state;
}

test("LIBRARY-001: traveller creates a deterministic physical knowledge copy", () => {
  const state = playerState();
  const entryId = state.entries[0]?.id;
  assert.ok(entryId);
  const bundle = copyPlayerKnowledgeToBundle(
    state,
    "traveller-01",
    [entryId],
    200,
  );

  assert.equal(bundle.kind, "physical-knowledge-bundle");
  assert.equal(bundle.sourceKind, "traveller");
  assert.equal(bundle.carrierId, "traveller-01");
  assert.deepEqual(
    bundle,
    copyPlayerKnowledgeToBundle(state, "traveller-01", [entryId], 200),
  );
  assert.notEqual(bundle.entries, state.entries);
});

test("LIBRARY-001: deposit changes only the explicitly targeted city archive", () => {
  const state = playerState();
  const entryId = state.entries[0]?.id;
  assert.ok(entryId);
  const bundle = copyPlayerKnowledgeToBundle(
    state,
    "traveller-01",
    [entryId],
    200,
  );
  const firstCity = createCityLibraryArchive("library-world", "city-a");
  const secondCity = createCityLibraryArchive("library-world", "city-b");
  const deposit = depositKnowledgeBundle(firstCity, bundle);

  assert.equal(deposit.status, "accepted");
  assert.equal(deposit.library.entries.length, 1);
  assert.equal(deposit.newEntryCount, 1);
  assert.equal(deposit.informationValueUnits, 1);
  assert.deepEqual(secondCity.entries, []);
  assert.deepEqual(secondCity.acceptedBundleIds, []);
});

test("LIBRARY-001: another city learns only after physical bundle delivery", () => {
  const state = playerState();
  const entryId = state.entries[0]?.id;
  assert.ok(entryId);
  const playerBundle = copyPlayerKnowledgeToBundle(
    state,
    "traveller-01",
    [entryId],
    200,
  );
  const firstDeposit = depositKnowledgeBundle(
    createCityLibraryArchive("library-world", "city-a"),
    playerBundle,
  );
  const libraryBundle = copyCityLibraryKnowledgeToBundle(
    firstDeposit.library,
    "traveller-02",
    [entryId],
    300,
  );
  const secondCity = createCityLibraryArchive("library-world", "city-b");
  assert.equal(secondCity.entries.length, 0);
  const secondDeposit = depositKnowledgeBundle(secondCity, libraryBundle);

  assert.equal(libraryBundle.sourceKind, "city-library");
  assert.equal(libraryBundle.sourceId, "city-a");
  assert.equal(secondDeposit.library.entries.length, 1);
});

test("LIBRARY-001: merging preserves novel provenance and confidence", () => {
  const firstObservation = recordObservedCaravanTrack(
    createPlayerWorldEvidenceState("library-world"),
    observation("track-a", 100),
  );
  const entryId = firstObservation.entry.id;
  const firstBundle = copyPlayerKnowledgeToBundle(
    firstObservation.state,
    "traveller-01",
    [entryId],
    200,
  );
  const firstDeposit = depositKnowledgeBundle(
    createCityLibraryArchive("library-world", "city-a"),
    firstBundle,
  );
  const laterObservation = recordObservedCaravanTrack(
    firstObservation.state,
    observation("track-a", 300, "recent"),
  );
  const laterBundle = copyPlayerKnowledgeToBundle(
    laterObservation.state,
    "traveller-01",
    [entryId],
    400,
  );
  const merged = depositKnowledgeBundle(firstDeposit.library, laterBundle);

  assert.equal(merged.newEntryCount, 0);
  assert.equal(merged.newProvenanceCount, 1);
  assert.equal(merged.informationValueUnits, 1);
  assert.equal(merged.library.entries[0]?.provenance.length, 2);
  assert.equal(merged.library.entries[0]?.confidence, "probable");
  assert.equal(merged.library.entries[0]?.facts.approximateAge, "recent");
});

test("LIBRARY-001: depositing the same physical copy is idempotent", () => {
  const state = playerState();
  const entryId = state.entries[0]?.id;
  assert.ok(entryId);
  const bundle = copyPlayerKnowledgeToBundle(
    state,
    "traveller-01",
    [entryId],
    200,
  );
  const first = depositKnowledgeBundle(
    createCityLibraryArchive("library-world", "city-a"),
    bundle,
  );
  const repeated = depositKnowledgeBundle(first.library, bundle);
  assert.equal(repeated.status, "already-deposited");
  assert.equal(repeated.library, first.library);
  assert.equal(repeated.informationValueUnits, 0);
});

test("LIBRARY-001: library copies do not remove local archive knowledge", () => {
  const state = playerState();
  const entryId = state.entries[0]?.id;
  assert.ok(entryId);
  const deposit = depositKnowledgeBundle(
    createCityLibraryArchive("library-world", "city-a"),
    copyPlayerKnowledgeToBundle(state, "traveller-01", [entryId], 200),
  );
  const before = deposit.library;
  copyCityLibraryKnowledgeToBundle(before, "traveller-02", [entryId], 300);
  assert.equal(before.entries.length, 1);
  assert.equal(before.entries[0]?.id, entryId);
});

test("LIBRARY-001: bundles remain coordinate-free", () => {
  const state = playerState();
  const entryId = state.entries[0]?.id;
  assert.ok(entryId);
  const bundle = copyPlayerKnowledgeToBundle(
    state,
    "traveller-01",
    [entryId],
    200,
  );
  const serialized = JSON.stringify(bundle);
  assert.equal(serialized.includes("latitude"), false);
  assert.equal(serialized.includes("longitude"), false);
});

test("LIBRARY-001: selection and world boundaries are validated", () => {
  const state = playerState();
  const entryId = state.entries[0]?.id;
  assert.ok(entryId);
  assert.throws(
    () => copyPlayerKnowledgeToBundle(state, "traveller-01", [], 200),
    /must contain at least one entry/,
  );
  assert.throws(
    () => copyPlayerKnowledgeToBundle(state, "traveller-01", ["unknown"], 200),
    /must reference available knowledge/,
  );
  const bundle = copyPlayerKnowledgeToBundle(
    state,
    "traveller-01",
    [entryId],
    200,
  );
  assert.throws(
    () =>
      depositKnowledgeBundle(
        createCityLibraryArchive("another-world", "city-a"),
        bundle,
      ),
    /worldSeed must match/,
  );
});
