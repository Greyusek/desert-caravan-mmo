import type { ProjectedCaravanRemains } from "./caravan-remains.js";
import type {
  ApproximateTrackAge,
  ApproximateTravelDirection,
  ObservedCaravanTrack,
} from "./caravan-track.js";
import type { DurationSeconds } from "./route.js";

export type WorldEvidenceKind = "caravan-track" | "caravan-remains";
export type WorldEvidenceConfidence = "probable" | "confirmed";
export type WorldEvidenceSource =
  | "direct-track-observation"
  | "direct-remains-observation";

export interface WorldEvidenceProvenance {
  readonly source: WorldEvidenceSource;
  readonly sourceEvidenceId: string;
  readonly observedAtWorldTimeSeconds: DurationSeconds;
  readonly confidence: WorldEvidenceConfidence;
}

export interface CaravanTrackKnowledgeFacts {
  readonly kind: "caravan-track";
  readonly approximateAge: ApproximateTrackAge;
  readonly approximateDirection: ApproximateTravelDirection;
}

export interface CaravanRemainsKnowledgeFacts {
  readonly kind: "caravan-remains";
  readonly condition: "fresh" | "weathered" | "ruined";
  readonly lootAvailability: "recoverable" | "empty";
}

export type WorldEvidenceFacts =
  | CaravanTrackKnowledgeFacts
  | CaravanRemainsKnowledgeFacts;

export interface PlayerWorldEvidenceEntry {
  readonly id: string;
  readonly evidenceKind: WorldEvidenceKind;
  readonly subjectId: string;
  readonly firstObservedAtWorldTimeSeconds: DurationSeconds;
  readonly latestObservedAtWorldTimeSeconds: DurationSeconds;
  readonly confidence: WorldEvidenceConfidence;
  readonly facts: WorldEvidenceFacts;
  readonly provenance: readonly WorldEvidenceProvenance[];
}

export interface WorldEvidenceJournalEvent {
  readonly id: string;
  readonly kind: "world-evidence-observed";
  readonly evidenceKind: WorldEvidenceKind;
  readonly knowledgeEntryId: string;
  readonly atWorldTimeSeconds: DurationSeconds;
  readonly source: WorldEvidenceSource;
  readonly confidence: WorldEvidenceConfidence;
  readonly summary: string;
}

export interface PlayerWorldEvidenceState {
  readonly worldSeed: string;
  readonly entries: readonly PlayerWorldEvidenceEntry[];
  readonly journal: readonly WorldEvidenceJournalEvent[];
}

export type WorldEvidenceRecordStatus =
  | "first-observation"
  | "reobserved"
  | "already-recorded";

export interface WorldEvidenceRecordResult {
  readonly state: PlayerWorldEvidenceState;
  readonly entry: PlayerWorldEvidenceEntry;
  readonly journalEvent: WorldEvidenceJournalEvent | null;
  readonly status: WorldEvidenceRecordStatus;
}

export function createPlayerWorldEvidenceState(
  worldSeed: string,
): PlayerWorldEvidenceState {
  assertNonEmptyString(worldSeed, "worldSeed");
  return { worldSeed, entries: [], journal: [] };
}

/** Records the already coordinate-free clue with probable confidence. */
export function recordObservedCaravanTrack(
  state: PlayerWorldEvidenceState,
  observation: ObservedCaravanTrack,
): WorldEvidenceRecordResult {
  return recordEvidence(state, {
    evidenceKind: "caravan-track",
    subjectId: observation.trackId,
    observedAtWorldTimeSeconds: observation.observedAtWorldTimeSeconds,
    source: "direct-track-observation",
    confidence: "probable",
    facts: {
      kind: "caravan-track",
      approximateAge: observation.approximateAge,
      approximateDirection: observation.approximateDirection,
    },
    summary: `Caravan tracks: ${observation.approximateAge}, heading ${observation.approximateDirection}`,
  });
}

/**
 * Converts authoritative remains projection into coordinate-free knowledge.
 * Exact position, destruction time, source caravan and loot amounts are not
 * copied into player state or its event journal.
 */
export function recordObservedCaravanRemains(
  state: PlayerWorldEvidenceState,
  observation: ProjectedCaravanRemains,
): WorldEvidenceRecordResult {
  const hasLoot = Object.values(observation.availableLoot).some(
    (value) => value > 0,
  );
  return recordEvidence(state, {
    evidenceKind: "caravan-remains",
    subjectId: observation.remains.id,
    observedAtWorldTimeSeconds: observation.worldTimeSeconds,
    source: "direct-remains-observation",
    confidence: "confirmed",
    facts: {
      kind: "caravan-remains",
      condition: observation.condition,
      lootAvailability: hasLoot ? "recoverable" : "empty",
    },
    summary: `Caravan remains: ${observation.condition}, loot ${hasLoot ? "recoverable" : "empty"}`,
  });
}

interface EvidenceObservationInput {
  readonly evidenceKind: WorldEvidenceKind;
  readonly subjectId: string;
  readonly observedAtWorldTimeSeconds: DurationSeconds;
  readonly source: WorldEvidenceSource;
  readonly confidence: WorldEvidenceConfidence;
  readonly facts: WorldEvidenceFacts;
  readonly summary: string;
}

function recordEvidence(
  state: PlayerWorldEvidenceState,
  input: EvidenceObservationInput,
): WorldEvidenceRecordResult {
  assertState(state);
  assertNonEmptyString(input.subjectId, "subjectId");
  assertNonNegativeFinite(
    input.observedAtWorldTimeSeconds,
    "observedAtWorldTimeSeconds",
  );
  const entryId = `knowledge-${input.evidenceKind}-${input.subjectId}`;
  const existingIndex = state.entries.findIndex(
    (entry) => entry.id === entryId,
  );
  const provenance: WorldEvidenceProvenance = {
    source: input.source,
    sourceEvidenceId: input.subjectId,
    observedAtWorldTimeSeconds: input.observedAtWorldTimeSeconds,
    confidence: input.confidence,
  };

  if (existingIndex >= 0) {
    const existing = state.entries[existingIndex];
    if (!existing) throw new Error("world evidence index invariant failed");
    if (
      input.observedAtWorldTimeSeconds <
      existing.latestObservedAtWorldTimeSeconds
    ) {
      throw new RangeError(
        "observation time must not precede the latest observation",
      );
    }
    if (
      input.observedAtWorldTimeSeconds ===
      existing.latestObservedAtWorldTimeSeconds
    ) {
      return {
        state,
        entry: existing,
        journalEvent: null,
        status: "already-recorded",
      };
    }

    const entry: PlayerWorldEvidenceEntry = {
      ...existing,
      latestObservedAtWorldTimeSeconds: input.observedAtWorldTimeSeconds,
      confidence: strongerConfidence(existing.confidence, input.confidence),
      facts: input.facts,
      provenance: [...existing.provenance, provenance],
    };
    const journalEvent = createJournalEvent(entry, input);
    return {
      state: {
        ...state,
        entries: state.entries.map((candidate, index) =>
          index === existingIndex ? entry : candidate,
        ),
        journal: [...state.journal, journalEvent],
      },
      entry,
      journalEvent,
      status: "reobserved",
    };
  }

  const entry: PlayerWorldEvidenceEntry = {
    id: entryId,
    evidenceKind: input.evidenceKind,
    subjectId: input.subjectId,
    firstObservedAtWorldTimeSeconds: input.observedAtWorldTimeSeconds,
    latestObservedAtWorldTimeSeconds: input.observedAtWorldTimeSeconds,
    confidence: input.confidence,
    facts: input.facts,
    provenance: [provenance],
  };
  const journalEvent = createJournalEvent(entry, input);
  return {
    state: {
      ...state,
      entries: [...state.entries, entry],
      journal: [...state.journal, journalEvent],
    },
    entry,
    journalEvent,
    status: "first-observation",
  };
}

function createJournalEvent(
  entry: PlayerWorldEvidenceEntry,
  input: EvidenceObservationInput,
): WorldEvidenceJournalEvent {
  return {
    id: `journal-${entry.id}-${entry.provenance.length}`,
    kind: "world-evidence-observed",
    evidenceKind: input.evidenceKind,
    knowledgeEntryId: entry.id,
    atWorldTimeSeconds: input.observedAtWorldTimeSeconds,
    source: input.source,
    confidence: input.confidence,
    summary: input.summary,
  };
}

function strongerConfidence(
  first: WorldEvidenceConfidence,
  second: WorldEvidenceConfidence,
): WorldEvidenceConfidence {
  return first === "confirmed" || second === "confirmed"
    ? "confirmed"
    : "probable";
}

function assertState(state: PlayerWorldEvidenceState): void {
  assertNonEmptyString(state.worldSeed, "state.worldSeed");
  if (!Array.isArray(state.entries)) {
    throw new TypeError("state.entries must be an array");
  }
  if (!Array.isArray(state.journal)) {
    throw new TypeError("state.journal must be an array");
  }
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
