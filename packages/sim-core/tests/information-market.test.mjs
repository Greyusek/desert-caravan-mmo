import test from "node:test";
import assert from "node:assert/strict";
import {
  copyPlayerKnowledgeToBundle,
  createCityLibraryArchive,
  quoteKnowledgeBundleForLibrary,
  sellKnowledgeBundleToLibrary,
} from "../dist/src/index.js";

const DAY = 24 * 60 * 60;

function entry({
  id = "knowledge-caravan-track-track-a",
  evidenceKind = "caravan-track",
  observedAt = 100,
  confidence = "probable",
  observations = 1,
} = {}) {
  return {
    id,
    evidenceKind,
    subjectId: id.replace("knowledge-", ""),
    firstObservedAtWorldTimeSeconds: observedAt,
    latestObservedAtWorldTimeSeconds: observedAt + observations - 1,
    confidence,
    facts:
      evidenceKind === "caravan-remains"
        ? {
            kind: "caravan-remains",
            condition: "fresh",
            lootAvailability: "recoverable",
          }
        : {
            kind: "caravan-track",
            approximateAge: "fresh",
            approximateDirection: "east",
          },
    provenance: Array.from({ length: observations }, (_, index) => ({
      source:
        evidenceKind === "caravan-remains"
          ? "direct-remains-observation"
          : "direct-track-observation",
      sourceEvidenceId: `${id}-source-${index + 1}`,
      observedAtWorldTimeSeconds: observedAt + index,
      confidence,
    })),
  };
}

function bundleFor(entries, createdAt = 200) {
  const state = {
    worldSeed: "info-trade-world",
    entries,
    journal: [],
  };
  return copyPlayerKnowledgeToBundle(
    state,
    "physical-carrier-01",
    entries.map((item) => item.id),
    createdAt,
  );
}

test("INFO-TRADE-001: a novel physical bundle has local positive value", () => {
  const bundle = bundleFor([entry()]);
  const library = createCityLibraryArchive("info-trade-world", "city-a");
  const quote = quoteKnowledgeBundleForLibrary(library, bundle, 300);

  assert.equal(quote.targetLibraryCityId, "city-a");
  assert.equal(quote.entryQuotes[0]?.noveltyMultiplier, 1);
  assert.equal(quote.entryQuotes[0]?.novelObservationCount, 1);
  assert.ok(quote.totalValueCredits > 0);
});

test("INFO-TRADE-001: identical known information is worth zero", () => {
  const bundle = bundleFor([entry()]);
  const first = sellKnowledgeBundleToLibrary(
    createCityLibraryArchive("info-trade-world", "city-a"),
    bundle,
    300,
  );
  const repeated = quoteKnowledgeBundleForLibrary(
    first.deposit.library,
    bundle,
    400,
  );

  assert.equal(repeated.entryQuotes[0]?.novelObservationCount, 0);
  assert.equal(repeated.entryQuotes[0]?.noveltyMultiplier, 0);
  assert.equal(repeated.totalValueCredits, 0);
});

test("INFO-TRADE-001: the same knowledge can remain valuable in another city", () => {
  const bundle = bundleFor([entry()]);
  const cityA = sellKnowledgeBundleToLibrary(
    createCityLibraryArchive("info-trade-world", "city-a"),
    bundle,
    300,
  );
  const cityB = quoteKnowledgeBundleForLibrary(
    createCityLibraryArchive("info-trade-world", "city-b"),
    bundle,
    300,
  );

  assert.equal(
    quoteKnowledgeBundleForLibrary(cityA.deposit.library, bundle, 300)
      .totalValueCredits,
    0,
  );
  assert.ok(cityB.totalValueCredits > 0);
});

test("INFO-TRADE-001: old information is worth less than fresh information", () => {
  const bundle = bundleFor([entry()]);
  const library = createCityLibraryArchive("info-trade-world", "city-a");
  const fresh = quoteKnowledgeBundleForLibrary(library, bundle, 300);
  const ancient = quoteKnowledgeBundleForLibrary(
    library,
    bundle,
    300 + 31 * DAY,
  );

  assert.equal(fresh.entryQuotes[0]?.ageMultiplier, 1);
  assert.equal(ancient.entryQuotes[0]?.ageMultiplier, 0.2);
  assert.ok(ancient.totalValueCredits < fresh.totalValueCredits);
});

test("INFO-TRADE-001: accuracy and strategic evidence type are explicit", () => {
  const track = entry();
  const remains = entry({
    id: "knowledge-caravan-remains-remains-a",
    evidenceKind: "caravan-remains",
    confidence: "confirmed",
  });
  const quote = quoteKnowledgeBundleForLibrary(
    createCityLibraryArchive("info-trade-world", "city-a"),
    bundleFor([track, remains]),
    300,
  );
  const trackQuote = quote.entryQuotes.find(
    (item) => item.evidenceKind === "caravan-track",
  );
  const remainsQuote = quote.entryQuotes.find(
    (item) => item.evidenceKind === "caravan-remains",
  );
  assert.ok(trackQuote && remainsQuote);

  assert.equal(trackQuote.accuracyMultiplier, 0.6);
  assert.equal(remainsQuote.accuracyMultiplier, 1);
  assert.ok(remainsQuote.strategicValueCredits > trackQuote.strategicValueCredits);
  assert.ok(remainsQuote.valueCredits > trackQuote.valueCredits);
});

test("INFO-TRADE-001: confirmation and multiple observations raise value", () => {
  const probable = entry();
  const confirmed = entry({
    id: "knowledge-caravan-track-track-b",
    confidence: "confirmed",
    observations: 2,
  });
  const quote = quoteKnowledgeBundleForLibrary(
    createCityLibraryArchive("info-trade-world", "city-a"),
    bundleFor([probable, confirmed]),
    300,
  );
  const probableQuote = quote.entryQuotes.find(
    (item) => item.entryId === probable.id,
  );
  const confirmedQuote = quote.entryQuotes.find(
    (item) => item.entryId === confirmed.id,
  );
  assert.ok(probableQuote && confirmedQuote);

  assert.equal(confirmedQuote.confirmationCount, 2);
  assert.ok(
    confirmedQuote.confirmationMultiplier >
      probableQuote.confirmationMultiplier,
  );
  assert.ok(confirmedQuote.valueCredits > probableQuote.valueCredits);
});

test("INFO-TRADE-001: sale pays the quote and deposits only into target library", () => {
  const bundle = bundleFor([entry()]);
  const cityA = createCityLibraryArchive("info-trade-world", "city-a");
  const cityB = createCityLibraryArchive("info-trade-world", "city-b");
  const sale = sellKnowledgeBundleToLibrary(cityA, bundle, 300);

  assert.equal(sale.payoutCredits, sale.quote.totalValueCredits);
  assert.equal(sale.deposit.library.entries.length, 1);
  assert.equal(cityB.entries.length, 0);
  const repeat = sellKnowledgeBundleToLibrary(
    sale.deposit.library,
    bundle,
    400,
  );
  assert.equal(repeat.payoutCredits, 0);
  assert.equal(repeat.deposit.status, "already-deposited");
});

test("INFO-TRADE-001: quotes remain coordinate-free and validate chronology", () => {
  const bundle = bundleFor([entry()]);
  const library = createCityLibraryArchive("info-trade-world", "city-a");
  const quote = quoteKnowledgeBundleForLibrary(library, bundle, 300);
  const serialized = JSON.stringify(quote);
  assert.equal(serialized.includes("latitude"), false);
  assert.equal(serialized.includes("longitude"), false);
  assert.throws(
    () => quoteKnowledgeBundleForLibrary(library, bundle, 199),
    /must not precede bundle creation/,
  );
  assert.throws(
    () =>
      quoteKnowledgeBundleForLibrary(
        { ...library, worldSeed: "another-world" },
        bundle,
        300,
      ),
    /worldSeed must match/,
  );
});
