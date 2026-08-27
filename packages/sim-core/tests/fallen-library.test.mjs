import test from "node:test";
import assert from "node:assert/strict";
import {
  FALLEN_LIBRARY_FULL_INFORMATION_LOSS_SECONDS,
  copyFallenLibraryKnowledgeToBundle,
  copyPlayerKnowledgeToBundle,
  createCityLibraryArchive,
  createFallenCityLibrary,
  createPlayerWorldEvidenceState,
  createWorldCoordinate,
  depositKnowledgeBundle,
  projectFallenCityLibraryAtWorldTime,
  recordObservedCaravanTrack,
} from "../dist/src/index.js";

const DAY = 24 * 60 * 60;

function populatedLibrary() {
  const evidence = recordObservedCaravanTrack(
    createPlayerWorldEvidenceState("fallen-world"),
    {
      trackId: "track-a",
      kind: "caravan-track",
      observedAtWorldTimeSeconds: 100,
      approximateAge: "fresh",
      approximateDirection: "east",
    },
  ).state;
  const entry = evidence.entries[0];
  const entryId = entry?.id;
  assert.ok(entryId);
  assert.ok(entry);
  const confirmedEvidence = {
    ...evidence,
    entries: [
      {
        ...entry,
        confidence: "confirmed",
        provenance: entry.provenance.map((item) => ({
          ...item,
          confidence: "confirmed",
        })),
      },
    ],
  };
  return depositKnowledgeBundle(
    createCityLibraryArchive("fallen-world", "city-a"),
    copyPlayerKnowledgeToBundle(
      confirmedEvidence,
      "traveller-01",
      [entryId],
      200,
    ),
  ).library;
}

function city() {
  return {
    id: "city-a",
    name: "Fallen City",
    position: createWorldCoordinate(10, 20),
  };
}

test("LIBRARY-002: a fallen archive becomes a permanent world object", () => {
  const archive = populatedLibrary();
  const fallen = createFallenCityLibrary(archive, city(), 1_000);
  assert.equal(fallen.kind, "fallen-city-library");
  assert.equal(fallen.cityId, "city-a");
  assert.deepEqual(fallen.position, city().position);
  assert.notEqual(fallen.archiveSnapshot, archive);
});

test("LIBRARY-002: fresh fallen information starts clear and confirmed", () => {
  const projection = projectFallenCityLibraryAtWorldTime(
    createFallenCityLibrary(populatedLibrary(), city(), 1_000),
    1_000,
  );
  assert.equal(projection.condition, "intact");
  assert.equal(projection.entryStates[0]?.completenessFraction, 1);
  assert.equal(projection.entryStates[0]?.readability, "clear");
  assert.equal(projection.entryStates[0]?.actuality, "current");
  assert.equal(projection.entryStates[0]?.retainedConfidence, "confirmed");
});

test("LIBRARY-002: time degrades completeness, confidence and actuality", () => {
  const projection = projectFallenCityLibraryAtWorldTime(
    createFallenCityLibrary(populatedLibrary(), city(), 1_000),
    1_000 + 20 * DAY,
  );
  const entry = projection.entryStates[0];
  assert.ok(entry);
  assert.ok(Math.abs(entry.completenessFraction - 1 / 3) < 1e-12);
  assert.equal(projection.condition, "damaged");
  assert.equal(entry.readability, "fragmentary");
  assert.equal(entry.actuality, "stale");
  assert.equal(entry.retainedConfidence, "probable");
  assert.equal(projection.recoverableArchive.entries[0]?.confidence, "probable");
});

test("LIBRARY-002: ruined archive stays discoverable after information loss", () => {
  const fallen = createFallenCityLibrary(populatedLibrary(), city(), 1_000);
  const projection = projectFallenCityLibraryAtWorldTime(
    fallen,
    1_000 + FALLEN_LIBRARY_FULL_INFORMATION_LOSS_SECONDS,
  );
  assert.equal(projection.condition, "ruined");
  assert.equal(projection.permanentlyPresent, true);
  assert.equal(projection.library.id, fallen.id);
  assert.equal(projection.entryStates[0]?.readability, "illegible");
  assert.equal(projection.entryStates[0]?.actuality, "obsolete");
  assert.equal(projection.entryStates[0]?.recoverable, false);
  assert.deepEqual(projection.recoverableArchive.entries, []);
});

test("LIBRARY-002: readable fragments can leave only as a physical bundle", () => {
  const archive = populatedLibrary();
  const entryId = archive.entries[0]?.id;
  assert.ok(entryId);
  const projection = projectFallenCityLibraryAtWorldTime(
    createFallenCityLibrary(archive, city(), 1_000),
    1_000 + 10 * DAY,
  );
  const bundle = copyFallenLibraryKnowledgeToBundle(
    projection,
    "explorer-01",
    [entryId],
  );
  assert.equal(bundle.kind, "physical-knowledge-bundle");
  assert.equal(bundle.sourceId, "fallen-library-city-a");
  assert.equal(bundle.carrierId, "explorer-01");
  assert.equal(bundle.createdAtWorldTimeSeconds, projection.worldTimeSeconds);
});

test("LIBRARY-002: falling and projection do not mutate the live snapshot", () => {
  const archive = populatedLibrary();
  const before = JSON.stringify(archive);
  const fallen = createFallenCityLibrary(archive, city(), 1_000);
  projectFallenCityLibraryAtWorldTime(fallen, 1_000 + 20 * DAY);
  assert.equal(JSON.stringify(archive), before);
  assert.equal(archive.entries[0]?.confidence, "confirmed");
});

test("LIBRARY-002: city identity and world chronology are validated", () => {
  const archive = populatedLibrary();
  assert.throws(
    () => createFallenCityLibrary(archive, { ...city(), id: "city-b" }, 1_000),
    /library.cityId must match/,
  );
  const fallen = createFallenCityLibrary(archive, city(), 1_000);
  assert.throws(
    () => projectFallenCityLibraryAtWorldTime(fallen, 999),
    /must not precede city fall/,
  );
});
