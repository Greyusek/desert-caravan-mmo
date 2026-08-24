import type { DurationSeconds } from "./route.js";
import type { DistanceMeters } from "./types.js";
import type { StaticWorldObjectKind } from "./world.js";

export type PlayerKnowledgeSource = "direct-observation";
export type PlayerKnowledgeConfidence = "confirmed";

export interface DirectDiscoveryObservationInput {
  readonly expeditionNumber: number;
  readonly objectId: string;
  readonly objectKind: StaticWorldObjectKind;
  readonly originCityId: string;
  readonly rumorId: string;
  readonly observedAtSeconds: DurationSeconds;
  readonly segmentIndex: number;
  readonly routeDistanceMeters: DistanceMeters;
}

export interface PlayerDiscoveryObservation
  extends DirectDiscoveryObservationInput {
  readonly source: PlayerKnowledgeSource;
  readonly confidence: PlayerKnowledgeConfidence;
}

export interface PlayerDiscoveryLedgerEntry {
  readonly objectId: string;
  readonly objectKind: StaticWorldObjectKind;
  readonly source: PlayerKnowledgeSource;
  readonly confidence: PlayerKnowledgeConfidence;
  readonly firstObservation: PlayerDiscoveryObservation;
  readonly latestObservation: PlayerDiscoveryObservation;
  readonly observationCount: number;
}

export interface PlayerDiscoveryLedger {
  readonly worldSeed: string;
  readonly entries: readonly PlayerDiscoveryLedgerEntry[];
}

export type DiscoveryLedgerRecordStatus =
  | "first-observation"
  | "reobserved"
  | "already-recorded";

export interface DiscoveryLedgerRecordResult {
  readonly ledger: PlayerDiscoveryLedger;
  readonly entry: PlayerDiscoveryLedgerEntry;
  readonly status: DiscoveryLedgerRecordStatus;
}

/**
 * GAME-011 — creates browser-session knowledge for exactly one deterministic
 * world. Persistence, physical map ownership and database concerns deliberately
 * remain outside this value object.
 */
export function createPlayerDiscoveryLedger(
  worldSeed: string,
): PlayerDiscoveryLedger {
  assertNonEmptyString(worldSeed, "worldSeed");
  return { worldSeed, entries: [] };
}

/**
 * Records a confirmed personal observation without storing server coordinates.
 * One object contributes at most one observation per expedition, making the
 * operation safe to repeat while a browser view re-renders the same boundary.
 */
export function recordDirectDiscoveryObservation(
  ledger: PlayerDiscoveryLedger,
  input: DirectDiscoveryObservationInput,
): DiscoveryLedgerRecordResult {
  assertLedger(ledger);
  assertObservationInput(input);

  const observation: PlayerDiscoveryObservation = {
    ...input,
    source: "direct-observation",
    confidence: "confirmed",
  };
  const existingIndex = ledger.entries.findIndex(
    (entry) => entry.objectId === input.objectId,
  );

  if (existingIndex < 0) {
    const entry: PlayerDiscoveryLedgerEntry = {
      objectId: input.objectId,
      objectKind: input.objectKind,
      source: observation.source,
      confidence: observation.confidence,
      firstObservation: observation,
      latestObservation: observation,
      observationCount: 1,
    };
    return {
      ledger: {
        worldSeed: ledger.worldSeed,
        entries: [...ledger.entries, entry],
      },
      entry,
      status: "first-observation",
    };
  }

  const existing = ledger.entries[existingIndex];
  if (!existing) throw new Error("discovery ledger index invariant failed");
  if (existing.objectKind !== input.objectKind) {
    throw new RangeError("objectKind must match the existing ledger entry");
  }
  if (input.expeditionNumber < existing.latestObservation.expeditionNumber) {
    throw new RangeError(
      "expeditionNumber must not precede the latest observation",
    );
  }
  if (existing.latestObservation.expeditionNumber === input.expeditionNumber) {
    return { ledger, entry: existing, status: "already-recorded" };
  }

  const entry: PlayerDiscoveryLedgerEntry = {
    ...existing,
    latestObservation: observation,
    observationCount: existing.observationCount + 1,
  };
  return {
    ledger: {
      worldSeed: ledger.worldSeed,
      entries: ledger.entries.map((candidate, index) =>
        index === existingIndex ? entry : candidate,
      ),
    },
    entry,
    status: "reobserved",
  };
}

/** True only when the object was learned in an earlier expedition. */
export function wasObjectKnownBeforeExpedition(
  ledger: PlayerDiscoveryLedger,
  objectId: string,
  expeditionNumber: number,
): boolean {
  assertLedger(ledger);
  assertNonEmptyString(objectId, "objectId");
  assertPositiveSafeInteger(expeditionNumber, "expeditionNumber");
  return ledger.entries.some(
    (entry) =>
      entry.objectId === objectId &&
      entry.firstObservation.expeditionNumber < expeditionNumber,
  );
}

function assertLedger(ledger: PlayerDiscoveryLedger): void {
  assertNonEmptyString(ledger.worldSeed, "ledger.worldSeed");
  if (!Array.isArray(ledger.entries)) {
    throw new TypeError("ledger.entries must be an array");
  }
}

function assertObservationInput(input: DirectDiscoveryObservationInput): void {
  assertPositiveSafeInteger(input.expeditionNumber, "expeditionNumber");
  assertNonEmptyString(input.objectId, "objectId");
  assertStaticObjectKind(input.objectKind);
  assertNonEmptyString(input.originCityId, "originCityId");
  assertNonEmptyString(input.rumorId, "rumorId");
  assertNonNegativeFinite(input.observedAtSeconds, "observedAtSeconds");
  if (!Number.isSafeInteger(input.segmentIndex) || input.segmentIndex < 0) {
    throw new RangeError("segmentIndex must be a non-negative safe integer");
  }
  assertNonNegativeFinite(input.routeDistanceMeters, "routeDistanceMeters");
}

function assertStaticObjectKind(
  value: string,
): asserts value is StaticWorldObjectKind {
  if (!["oasis", "mine", "ruins", "cave"].includes(value)) {
    throw new RangeError("objectKind must be oasis, mine, ruins or cave");
  }
}

function assertNonEmptyString(value: string, name: string): void {
  if (typeof value !== "string" || value.length === 0) {
    throw new RangeError(`${name} must not be empty`);
  }
}

function assertPositiveSafeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive safe integer`);
  }
}

function assertNonNegativeFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative finite number`);
  }
}
