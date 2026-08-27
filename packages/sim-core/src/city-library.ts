import type { DurationSeconds } from "./route.js";
import type {
  PlayerWorldEvidenceEntry,
  PlayerWorldEvidenceState,
  WorldEvidenceConfidence,
  WorldEvidenceProvenance,
} from "./world-evidence.js";

export const MAX_KNOWLEDGE_BUNDLE_ENTRIES = 3;
export const MAX_KNOWLEDGE_COPY_GENERATION = 2;
export const KNOWLEDGE_COPY_FIDELITY_MULTIPLIER = 0.8;
export const CITY_LIBRARY_COPY_FIDELITY = 0.85;

export type PhysicalKnowledgeSourceKind =
  | "traveller"
  | "city-library"
  | "physical-copy"
  | "fallen-city-library";

export interface PhysicalKnowledgeBundle {
  readonly id: string;
  readonly kind: "physical-knowledge-bundle";
  readonly worldSeed: string;
  readonly sourceKind: PhysicalKnowledgeSourceKind;
  readonly sourceId: string;
  readonly carrierId: string;
  readonly createdAtWorldTimeSeconds: DurationSeconds;
  readonly copyGeneration: number;
  readonly fidelityFraction: number;
  readonly entries: readonly PlayerWorldEvidenceEntry[];
}

export interface CityLibraryArchive {
  readonly cityId: string;
  readonly worldSeed: string;
  readonly entries: readonly PlayerWorldEvidenceEntry[];
  readonly acceptedBundleIds: readonly string[];
}

export type LibraryDepositStatus = "accepted" | "already-deposited";

export interface LibraryKnowledgeDeposit {
  readonly library: CityLibraryArchive;
  readonly status: LibraryDepositStatus;
  readonly acceptedBundleId: string;
  readonly newEntryCount: number;
  readonly newProvenanceCount: number;
  /** Temporary deterministic exchange stub; not money or a market price. */
  readonly informationValueUnits: number;
}

export function createCityLibraryArchive(
  worldSeed: string,
  cityId: string,
): CityLibraryArchive {
  assertNonEmptyString(worldSeed, "worldSeed");
  assertNonEmptyString(cityId, "cityId");
  return { cityId, worldSeed, entries: [], acceptedBundleIds: [] };
}

/** Creates a physical copy carried by one traveller; player knowledge remains. */
export function copyPlayerKnowledgeToBundle(
  state: PlayerWorldEvidenceState,
  carrierId: string,
  selectedEntryIds: readonly string[],
  createdAtWorldTimeSeconds: DurationSeconds,
): PhysicalKnowledgeBundle {
  return createBundle(
    state.worldSeed,
    "traveller",
    carrierId,
    carrierId,
    state.entries,
    selectedEntryIds,
    createdAtWorldTimeSeconds,
    0,
    1,
  );
}

/** Creates a physical copy from one local archive without mutating it. */
export function copyCityLibraryKnowledgeToBundle(
  library: CityLibraryArchive,
  carrierId: string,
  selectedEntryIds: readonly string[],
  createdAtWorldTimeSeconds: DurationSeconds,
): PhysicalKnowledgeBundle {
  assertLibrary(library);
  return createBundle(
    library.worldSeed,
    "city-library",
    library.cityId,
    carrierId,
    library.entries,
    selectedEntryIds,
    createdAtWorldTimeSeconds,
    1,
    CITY_LIBRARY_COPY_FIDELITY,
  );
}

/**
 * INFO-TRADE-002 copies an existing physical carrier without restoring source
 * quality. Each generation loses fidelity and the chain stops after two copies.
 */
export function copyPhysicalKnowledgeBundle(
  source: PhysicalKnowledgeBundle,
  carrierId: string,
  selectedEntryIds: readonly string[],
  createdAtWorldTimeSeconds: DurationSeconds,
): PhysicalKnowledgeBundle {
  assertBundle(source);
  if (source.copyGeneration >= MAX_KNOWLEDGE_COPY_GENERATION) {
    throw new RangeError("physical knowledge copy generation limit reached");
  }
  if (createdAtWorldTimeSeconds < source.createdAtWorldTimeSeconds) {
    throw new RangeError("physical copy cannot precede source bundle");
  }
  return createBundle(
    source.worldSeed,
    "physical-copy",
    source.id,
    carrierId,
    source.entries,
    selectedEntryIds,
    createdAtWorldTimeSeconds,
    source.copyGeneration + 1,
    source.fidelityFraction * KNOWLEDGE_COPY_FIDELITY_MULTIPLIER,
  );
}

/**
 * LIBRARY-001 — only the explicitly targeted city archive receives this
 * physical bundle. Merging is deterministic and retains all distinct
 * provenance. Value units count novel observations as a temporary exchange
 * stub; they are not currency and do not start Trading Prototype.
 */
export function depositKnowledgeBundle(
  library: CityLibraryArchive,
  bundle: PhysicalKnowledgeBundle,
): LibraryKnowledgeDeposit {
  assertLibrary(library);
  assertBundle(bundle);
  if (library.worldSeed !== bundle.worldSeed) {
    throw new RangeError("bundle worldSeed must match the city library");
  }
  if (library.acceptedBundleIds.includes(bundle.id)) {
    return {
      library,
      status: "already-deposited",
      acceptedBundleId: bundle.id,
      newEntryCount: 0,
      newProvenanceCount: 0,
      informationValueUnits: 0,
    };
  }

  let entries = [...library.entries];
  let newEntryCount = 0;
  let newProvenanceCount = 0;
  for (const incoming of bundle.entries) {
    const existingIndex = entries.findIndex((entry) => entry.id === incoming.id);
    if (existingIndex < 0) {
      entries.push(cloneEntry(incoming));
      newEntryCount += 1;
      newProvenanceCount += incoming.provenance.length;
      continue;
    }
    const existing = entries[existingIndex];
    if (!existing) throw new Error("library entry index invariant failed");
    const merged = mergeEvidenceEntries(existing, incoming);
    newProvenanceCount +=
      merged.provenance.length - existing.provenance.length;
    entries[existingIndex] = merged;
  }
  entries = entries.sort((first, second) => compareRaw(first.id, second.id));

  return {
    library: {
      ...library,
      entries,
      acceptedBundleIds: [...library.acceptedBundleIds, bundle.id],
    },
    status: "accepted",
    acceptedBundleId: bundle.id,
    newEntryCount,
    newProvenanceCount,
    informationValueUnits: newProvenanceCount,
  };
}

function createBundle(
  worldSeed: string,
  sourceKind: PhysicalKnowledgeSourceKind,
  sourceId: string,
  carrierId: string,
  availableEntries: readonly PlayerWorldEvidenceEntry[],
  selectedEntryIds: readonly string[],
  createdAtWorldTimeSeconds: DurationSeconds,
  copyGeneration: number,
  fidelityFraction: number,
): PhysicalKnowledgeBundle {
  assertNonEmptyString(worldSeed, "worldSeed");
  assertNonEmptyString(sourceId, "sourceId");
  assertNonEmptyString(carrierId, "carrierId");
  assertNonNegativeFinite(
    createdAtWorldTimeSeconds,
    "createdAtWorldTimeSeconds",
  );
  if (!Array.isArray(selectedEntryIds) || selectedEntryIds.length === 0) {
    throw new RangeError("selectedEntryIds must contain at least one entry");
  }
  if (selectedEntryIds.length > MAX_KNOWLEDGE_BUNDLE_ENTRIES) {
    throw new RangeError(
      `selectedEntryIds cannot exceed ${MAX_KNOWLEDGE_BUNDLE_ENTRIES} physical entries`,
    );
  }
  if (
    !Number.isSafeInteger(copyGeneration) ||
    copyGeneration < 0 ||
    copyGeneration > MAX_KNOWLEDGE_COPY_GENERATION
  ) {
    throw new RangeError("copyGeneration is outside physical copy limits");
  }
  if (
    !Number.isFinite(fidelityFraction) ||
    fidelityFraction <= 0 ||
    fidelityFraction > 1
  ) {
    throw new RangeError("fidelityFraction must be finite and in (0, 1]");
  }
  const uniqueIds = [...new Set(selectedEntryIds)].sort(compareRaw);
  if (uniqueIds.length !== selectedEntryIds.length) {
    throw new RangeError("selectedEntryIds must be unique");
  }
  const entries = uniqueIds.map((entryId) => {
    const entry = availableEntries.find((candidate) => candidate.id === entryId);
    if (!entry) {
      throw new RangeError("selectedEntryIds must reference available knowledge");
    }
    return cloneEntry(entry);
  });
  const roundedFidelity = Math.round(fidelityFraction * 1_000_000) / 1_000_000;
  const identity = `${worldSeed}:${sourceKind}:${sourceId}:${carrierId}:${createdAtWorldTimeSeconds}:${copyGeneration}:${roundedFidelity}:${uniqueIds.join(",")}`;
  return {
    id: `knowledge-bundle-${hashSeed(identity).toString(16).padStart(8, "0")}`,
    kind: "physical-knowledge-bundle",
    worldSeed,
    sourceKind,
    sourceId,
    carrierId,
    createdAtWorldTimeSeconds,
    copyGeneration,
    fidelityFraction: roundedFidelity,
    entries,
  };
}

function mergeEvidenceEntries(
  first: PlayerWorldEvidenceEntry,
  second: PlayerWorldEvidenceEntry,
): PlayerWorldEvidenceEntry {
  if (
    first.id !== second.id ||
    first.evidenceKind !== second.evidenceKind ||
    first.subjectId !== second.subjectId
  ) {
    throw new RangeError("knowledge identities must match before merge");
  }
  const provenance = uniqueSortedProvenance([
    ...first.provenance,
    ...second.provenance,
  ]);
  const latest = chooseLatestEntry(first, second);
  return {
    ...latest,
    firstObservedAtWorldTimeSeconds: Math.min(
      first.firstObservedAtWorldTimeSeconds,
      second.firstObservedAtWorldTimeSeconds,
    ),
    latestObservedAtWorldTimeSeconds: Math.max(
      first.latestObservedAtWorldTimeSeconds,
      second.latestObservedAtWorldTimeSeconds,
    ),
    confidence: strongerConfidence(first.confidence, second.confidence),
    provenance,
  };
}

function chooseLatestEntry(
  first: PlayerWorldEvidenceEntry,
  second: PlayerWorldEvidenceEntry,
): PlayerWorldEvidenceEntry {
  if (
    first.latestObservedAtWorldTimeSeconds !==
    second.latestObservedAtWorldTimeSeconds
  ) {
    return first.latestObservedAtWorldTimeSeconds >
      second.latestObservedAtWorldTimeSeconds
      ? first
      : second;
  }
  return JSON.stringify(first.facts) <= JSON.stringify(second.facts)
    ? first
    : second;
}

function uniqueSortedProvenance(
  provenance: readonly WorldEvidenceProvenance[],
): WorldEvidenceProvenance[] {
  const unique = new Map<string, WorldEvidenceProvenance>();
  for (const item of provenance) {
    const key = `${item.observedAtWorldTimeSeconds}:${item.source}:${item.sourceEvidenceId}:${item.confidence}`;
    unique.set(key, item);
  }
  return [...unique.values()].sort((first, second) => {
    if (
      first.observedAtWorldTimeSeconds !== second.observedAtWorldTimeSeconds
    ) {
      return (
        first.observedAtWorldTimeSeconds - second.observedAtWorldTimeSeconds
      );
    }
    const sourceOrder = compareRaw(first.source, second.source);
    if (sourceOrder !== 0) return sourceOrder;
    return compareRaw(first.sourceEvidenceId, second.sourceEvidenceId);
  });
}

function strongerConfidence(
  first: WorldEvidenceConfidence,
  second: WorldEvidenceConfidence,
): WorldEvidenceConfidence {
  return first === "confirmed" || second === "confirmed"
    ? "confirmed"
    : "probable";
}

function cloneEntry(
  entry: PlayerWorldEvidenceEntry,
): PlayerWorldEvidenceEntry {
  return { ...entry, facts: { ...entry.facts }, provenance: [...entry.provenance] };
}

function assertLibrary(library: CityLibraryArchive): void {
  assertNonEmptyString(library.worldSeed, "library.worldSeed");
  assertNonEmptyString(library.cityId, "library.cityId");
  if (!Array.isArray(library.entries)) {
    throw new TypeError("library.entries must be an array");
  }
  if (!Array.isArray(library.acceptedBundleIds)) {
    throw new TypeError("library.acceptedBundleIds must be an array");
  }
}

function assertBundle(bundle: PhysicalKnowledgeBundle): void {
  assertNonEmptyString(bundle.id, "bundle.id");
  assertNonEmptyString(bundle.worldSeed, "bundle.worldSeed");
  assertNonEmptyString(bundle.carrierId, "bundle.carrierId");
  if (
    !Number.isSafeInteger(bundle.copyGeneration) ||
    bundle.copyGeneration < 0 ||
    bundle.copyGeneration > MAX_KNOWLEDGE_COPY_GENERATION
  ) {
    throw new RangeError("bundle.copyGeneration is outside physical copy limits");
  }
  if (
    !Number.isFinite(bundle.fidelityFraction) ||
    bundle.fidelityFraction <= 0 ||
    bundle.fidelityFraction > 1
  ) {
    throw new RangeError("bundle.fidelityFraction must be finite and in (0, 1]");
  }
  if (!Array.isArray(bundle.entries) || bundle.entries.length === 0) {
    throw new RangeError("bundle.entries must contain at least one entry");
  }
}

function compareRaw(first: string, second: string): number {
  return first < second ? -1 : first > second ? 1 : 0;
}

function assertNonEmptyString(value: string, name: string): void {
  if (typeof value !== "string" || value.length === 0) {
    throw new RangeError(`${name} must not be empty`);
  }
}

function assertNonNegativeFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative finite number`);
  }
}

function hashSeed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
