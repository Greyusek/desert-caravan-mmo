import test from "node:test";
import assert from "node:assert/strict";
import {
  CITY_LIBRARY_COPY_FIDELITY,
  KNOWLEDGE_COPY_FIDELITY_MULTIPLIER,
  MAX_KNOWLEDGE_BUNDLE_ENTRIES,
  MAX_KNOWLEDGE_COPY_GENERATION,
  copyCityLibraryKnowledgeToBundle,
  copyFallenLibraryKnowledgeToBundle,
  copyPhysicalKnowledgeBundle,
  copyPlayerKnowledgeToBundle,
  createCityLibraryArchive,
  createFallenCityLibrary,
  createWorldCoordinate,
  depositKnowledgeBundle,
  knowledgeBundleFidelityAtWorldTime,
  projectFallenCityLibraryAtWorldTime,
  quoteKnowledgeBundleForLibrary,
} from "../dist/src/index.js";

const DAY = 24 * 60 * 60;

function knowledgeEntry(sequence, observedAt = 100) {
  return {
    id: `knowledge-caravan-track-track-${sequence}`,
    evidenceKind: "caravan-track",
    subjectId: `track-${sequence}`,
    firstObservedAtWorldTimeSeconds: observedAt,
    latestObservedAtWorldTimeSeconds: observedAt,
    confidence: "probable",
    facts: {
      kind: "caravan-track",
      approximateAge: "fresh",
      approximateDirection: "north",
    },
    provenance: [
      {
        source: "direct-track-observation",
        sourceEvidenceId: `track-${sequence}`,
        observedAtWorldTimeSeconds: observedAt,
        confidence: "probable",
      },
    ],
  };
}

function directBundle(entryCount = 1, createdAt = 200) {
  const entries = Array.from({ length: entryCount }, (_, index) =>
    knowledgeEntry(index + 1),
  );
  return copyPlayerKnowledgeToBundle(
    { worldSeed: "info-copy-world", entries, journal: [] },
    "researcher-01",
    entries.map((entry) => entry.id),
    createdAt,
  );
}

test("INFO-TRADE-002: direct research starts pristine at generation zero", () => {
  const bundle = directBundle();
  assert.equal(bundle.copyGeneration, 0);
  assert.equal(bundle.fidelityFraction, 1);
  assert.equal(MAX_KNOWLEDGE_COPY_GENERATION, 2);
  assert.equal(MAX_KNOWLEDGE_BUNDLE_ENTRIES, 3);
});

test("INFO-TRADE-002: library copy has lower fidelity and lower local value", () => {
  const original = directBundle();
  const sourceLibrary = depositKnowledgeBundle(
    createCityLibraryArchive("info-copy-world", "city-source"),
    original,
  ).library;
  const copy = copyCityLibraryKnowledgeToBundle(
    sourceLibrary,
    "carrier-copy",
    [original.entries[0].id],
    300,
  );
  const directValue = quoteKnowledgeBundleForLibrary(
    createCityLibraryArchive("info-copy-world", "city-direct"),
    original,
    400,
  );
  const copyValue = quoteKnowledgeBundleForLibrary(
    createCityLibraryArchive("info-copy-world", "city-copy"),
    copy,
    400,
  );

  assert.equal(copy.copyGeneration, 1);
  assert.equal(copy.fidelityFraction, CITY_LIBRARY_COPY_FIDELITY);
  assert.ok(copyValue.totalValueCredits < directValue.totalValueCredits);
});

test("INFO-TRADE-002: physical copy chain loses fidelity and stops", () => {
  const original = directBundle();
  const first = copyPhysicalKnowledgeBundle(
    original,
    "copy-carrier-01",
    [original.entries[0].id],
    300,
  );
  const second = copyPhysicalKnowledgeBundle(
    first,
    "copy-carrier-02",
    [first.entries[0].id],
    400,
  );

  assert.equal(first.copyGeneration, 1);
  assert.equal(first.fidelityFraction, KNOWLEDGE_COPY_FIDELITY_MULTIPLIER);
  assert.equal(second.copyGeneration, 2);
  assert.ok(
    Math.abs(
      second.fidelityFraction - KNOWLEDGE_COPY_FIDELITY_MULTIPLIER ** 2,
    ) <= 1e-9,
  );
  assert.throws(
    () =>
      copyPhysicalKnowledgeBundle(
        second,
        "copy-carrier-03",
        [second.entries[0].id],
        500,
      ),
    /generation limit reached/,
  );
});

test("INFO-TRADE-002: one physical carrier cannot copy more than three entries", () => {
  assert.throws(
    () => directBundle(4),
    /cannot exceed 3 physical entries/,
  );
  assert.equal(directBundle(3).entries.length, 3);
});

test("INFO-TRADE-002: physical medium age lowers fidelity and quote", () => {
  const bundle = directBundle();
  const library = createCityLibraryArchive("info-copy-world", "city-a");
  const fresh = quoteKnowledgeBundleForLibrary(library, bundle, 300);
  const old = quoteKnowledgeBundleForLibrary(library, bundle, 100 * DAY);

  assert.equal(knowledgeBundleFidelityAtWorldTime(bundle, 300), 1);
  assert.equal(knowledgeBundleFidelityAtWorldTime(bundle, 100 * DAY), 0.5);
  assert.equal(fresh.entryQuotes[0].bundleFidelityMultiplier, 1);
  assert.equal(old.entryQuotes[0].bundleFidelityMultiplier, 0.5);
  assert.ok(old.totalValueCredits < fresh.totalValueCredits);
});

test("INFO-TRADE-002: fallen-library fragment inherits archive degradation", () => {
  const original = directBundle();
  const archive = depositKnowledgeBundle(
    createCityLibraryArchive("info-copy-world", "city-fallen"),
    original,
  ).library;
  const fallen = createFallenCityLibrary(
    archive,
    {
      id: "city-fallen",
      name: "Fallen City",
      position: createWorldCoordinate(0, 0),
    },
    300,
  );
  const projection = projectFallenCityLibraryAtWorldTime(
    fallen,
    300 + 15 * DAY,
  );
  const fragment = copyFallenLibraryKnowledgeToBundle(
    projection,
    "ruin-researcher",
    [original.entries[0].id],
  );
  const directQuote = quoteKnowledgeBundleForLibrary(
    createCityLibraryArchive("info-copy-world", "city-direct"),
    original,
    projection.worldTimeSeconds,
  );
  const fragmentQuote = quoteKnowledgeBundleForLibrary(
    createCityLibraryArchive("info-copy-world", "city-fragment"),
    fragment,
    projection.worldTimeSeconds,
  );

  assert.equal(fragment.sourceKind, "fallen-city-library");
  assert.ok(fragment.fidelityFraction < CITY_LIBRARY_COPY_FIDELITY);
  assert.ok(fragmentQuote.totalValueCredits < directQuote.totalValueCredits);
});

test("INFO-TRADE-002: known information remains zero regardless of fidelity", () => {
  const original = directBundle();
  const deposited = depositKnowledgeBundle(
    createCityLibraryArchive("info-copy-world", "city-a"),
    original,
  ).library;
  const copy = copyPhysicalKnowledgeBundle(
    original,
    "copy-carrier",
    [original.entries[0].id],
    300,
  );
  const quote = quoteKnowledgeBundleForLibrary(deposited, copy, 400);

  assert.equal(quote.entryQuotes[0].noveltyMultiplier, 0);
  assert.equal(quote.totalValueCredits, 0);
});

test("INFO-TRADE-002: copies are deterministic, physical and coordinate-free", () => {
  const makeCopy = () => {
    const original = directBundle();
    return copyPhysicalKnowledgeBundle(
      original,
      "copy-carrier",
      [original.entries[0].id],
      300,
    );
  };
  const first = makeCopy();
  assert.deepEqual(makeCopy(), first);
  const serialized = JSON.stringify(first);
  assert.equal(serialized.includes("latitude"), false);
  assert.equal(serialized.includes("longitude"), false);
  assert.throws(
    () =>
      copyPhysicalKnowledgeBundle(
        directBundle(),
        "copy-carrier",
        [directBundle().entries[0].id],
        199,
      ),
    /cannot precede source bundle/,
  );
});
