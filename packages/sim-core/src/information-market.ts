import {
  depositKnowledgeBundle,
  type CityLibraryArchive,
  type LibraryKnowledgeDeposit,
  type PhysicalKnowledgeBundle,
} from "./city-library.js";
import type { DurationSeconds } from "./route.js";
import type {
  PlayerWorldEvidenceEntry,
  WorldEvidenceProvenance,
} from "./world-evidence.js";

export const INFORMATION_STRATEGIC_VALUE_CREDITS = Object.freeze({
  "caravan-track": 60,
  "caravan-remains": 120,
});

export interface InformationEntryQuote {
  readonly entryId: string;
  readonly evidenceKind: PlayerWorldEvidenceEntry["evidenceKind"];
  readonly novelObservationCount: number;
  readonly knownObservationCount: number;
  readonly noveltyMultiplier: number;
  readonly accuracyMultiplier: number;
  readonly bundleFidelityMultiplier: number;
  readonly ageSeconds: DurationSeconds;
  readonly ageMultiplier: number;
  readonly confirmationCount: number;
  readonly confirmationMultiplier: number;
  readonly strategicValueCredits: number;
  readonly valueCredits: number;
}

export interface InformationBundleQuote {
  readonly targetLibraryCityId: string;
  readonly bundleId: string;
  readonly quotedAtWorldTimeSeconds: DurationSeconds;
  readonly entryQuotes: readonly InformationEntryQuote[];
  readonly totalValueCredits: number;
}

export interface InformationBundleSale {
  readonly quote: InformationBundleQuote;
  readonly payoutCredits: number;
  readonly deposit: LibraryKnowledgeDeposit;
}

/**
 * INFO-TRADE-001 prices only a physical bundle against one target archive.
 * Every coefficient is visible in the quote; there is no global information
 * price and an archive pays zero for an identical already-known observation.
 */
export function quoteKnowledgeBundleForLibrary(
  library: CityLibraryArchive,
  bundle: PhysicalKnowledgeBundle,
  quotedAtWorldTimeSeconds: DurationSeconds,
): InformationBundleQuote {
  assertQuoteContext(library, bundle, quotedAtWorldTimeSeconds);
  const entryQuotes = bundle.entries.map((entry) =>
    quoteEntry(library, bundle, entry, quotedAtWorldTimeSeconds),
  );
  return {
    targetLibraryCityId: library.cityId,
    bundleId: bundle.id,
    quotedAtWorldTimeSeconds,
    entryQuotes,
    totalValueCredits: entryQuotes.reduce(
      (total, quote) => total + quote.valueCredits,
      0,
    ),
  };
}

export function sellKnowledgeBundleToLibrary(
  library: CityLibraryArchive,
  bundle: PhysicalKnowledgeBundle,
  quotedAtWorldTimeSeconds: DurationSeconds,
): InformationBundleSale {
  const quote = quoteKnowledgeBundleForLibrary(
    library,
    bundle,
    quotedAtWorldTimeSeconds,
  );
  const deposit = depositKnowledgeBundle(library, bundle);
  return { quote, payoutCredits: quote.totalValueCredits, deposit };
}

function quoteEntry(
  library: CityLibraryArchive,
  bundle: PhysicalKnowledgeBundle,
  entry: PlayerWorldEvidenceEntry,
  quotedAtWorldTimeSeconds: DurationSeconds,
): InformationEntryQuote {
  const known = library.entries.find((candidate) => candidate.id === entry.id);
  const knownKeys = new Set(
    known?.provenance.map(provenanceIdentity) ?? [],
  );
  const novelObservationCount = entry.provenance.filter(
    (item) => !knownKeys.has(provenanceIdentity(item)),
  ).length;
  const knownObservationCount = entry.provenance.length - novelObservationCount;
  const noveltyMultiplier =
    known === undefined
      ? 1
      : novelObservationCount === 0
        ? 0
        : roundMultiplier(
            0.5 * (novelObservationCount / entry.provenance.length),
          );
  const accuracyMultiplier = informationAccuracyMultiplier(entry);
  const bundleFidelityMultiplier = knowledgeBundleFidelityAtWorldTime(
    bundle,
    quotedAtWorldTimeSeconds,
  );
  const ageSeconds =
    quotedAtWorldTimeSeconds - entry.latestObservedAtWorldTimeSeconds;
  const ageMultiplier = informationAgeMultiplier(ageSeconds);
  const confirmationCount = new Set(
    entry.provenance.map(provenanceIdentity),
  ).size;
  const confidenceBase = entry.confidence === "confirmed" ? 1.25 : 0.8;
  const confirmationMultiplier = roundMultiplier(
    confidenceBase * Math.min(1.5, 1 + 0.2 * (confirmationCount - 1)),
  );
  const strategicValueCredits =
    INFORMATION_STRATEGIC_VALUE_CREDITS[entry.evidenceKind];
  const valueCredits = Math.max(
    0,
    Math.round(
      strategicValueCredits *
        noveltyMultiplier *
        accuracyMultiplier *
        bundleFidelityMultiplier *
        ageMultiplier *
        confirmationMultiplier,
    ),
  );

  return {
    entryId: entry.id,
    evidenceKind: entry.evidenceKind,
    novelObservationCount,
    knownObservationCount,
    noveltyMultiplier,
    accuracyMultiplier,
    bundleFidelityMultiplier,
    ageSeconds,
    ageMultiplier,
    confirmationCount,
    confirmationMultiplier,
    strategicValueCredits,
    valueCredits,
  };
}

/** Physical medium fidelity decays separately from the age of the observation. */
export function knowledgeBundleFidelityAtWorldTime(
  bundle: PhysicalKnowledgeBundle,
  worldTimeSeconds: DurationSeconds,
): number {
  assertNonNegativeFinite(worldTimeSeconds, "worldTimeSeconds");
  if (worldTimeSeconds < bundle.createdAtWorldTimeSeconds) {
    throw new RangeError("bundle fidelity projection must not precede creation");
  }
  const carrierAgeSeconds = worldTimeSeconds - bundle.createdAtWorldTimeSeconds;
  const carrierAgeMultiplier =
    carrierAgeSeconds < 7 * 24 * 60 * 60
      ? 1
      : carrierAgeSeconds < 30 * 24 * 60 * 60
        ? 0.9
        : carrierAgeSeconds < 90 * 24 * 60 * 60
          ? 0.7
          : 0.5;
  return roundMultiplier(bundle.fidelityFraction * carrierAgeMultiplier);
}

export function informationAgeMultiplier(
  ageSeconds: DurationSeconds,
): number {
  assertNonNegativeFinite(ageSeconds, "ageSeconds");
  if (ageSeconds < 24 * 60 * 60) return 1;
  if (ageSeconds < 7 * 24 * 60 * 60) return 0.8;
  if (ageSeconds < 30 * 24 * 60 * 60) return 0.5;
  return 0.2;
}

export function informationAccuracyMultiplier(
  entry: PlayerWorldEvidenceEntry,
): number {
  if (entry.facts.kind === "caravan-remains") {
    return entry.confidence === "confirmed" ? 1 : 0.8;
  }
  return entry.confidence === "confirmed" ? 0.75 : 0.6;
}

function provenanceIdentity(provenance: WorldEvidenceProvenance): string {
  return `${provenance.source}:${provenance.sourceEvidenceId}:${provenance.observedAtWorldTimeSeconds}:${provenance.confidence}`;
}

function assertQuoteContext(
  library: CityLibraryArchive,
  bundle: PhysicalKnowledgeBundle,
  quotedAtWorldTimeSeconds: DurationSeconds,
): void {
  assertNonNegativeFinite(
    quotedAtWorldTimeSeconds,
    "quotedAtWorldTimeSeconds",
  );
  if (library.worldSeed !== bundle.worldSeed) {
    throw new RangeError("bundle worldSeed must match target library");
  }
  if (quotedAtWorldTimeSeconds < bundle.createdAtWorldTimeSeconds) {
    throw new RangeError("information quote must not precede bundle creation");
  }
  if (!Array.isArray(bundle.entries) || bundle.entries.length === 0) {
    throw new RangeError("bundle.entries must contain information");
  }
  for (const entry of bundle.entries) {
    if (
      quotedAtWorldTimeSeconds < entry.latestObservedAtWorldTimeSeconds
    ) {
      throw new RangeError("information quote must not precede observation");
    }
    if (!Array.isArray(entry.provenance) || entry.provenance.length === 0) {
      throw new RangeError("information entry must retain provenance");
    }
  }
}

function roundMultiplier(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function assertNonNegativeFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative finite number`);
  }
}
