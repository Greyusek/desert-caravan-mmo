import type { DurationSeconds } from "./route.js";
import type {
  ApproximateTravelDirection,
  ApproximateTrackAge,
} from "./caravan-track.js";
import type { WorldEvidenceConfidence } from "./world-evidence.js";

export type WorldRumorType =
  | "caravan-passage"
  | "caravan-loss"
  | "creature-sighting"
  | "fallen-library";
export type WorldRumorQuality =
  | "unverified"
  | "rough"
  | "reliable"
  | "corroborated";
export type WorldRumorAge = "fresh" | "recent" | "old" | "ancient";

export type WorldRumorFacts =
  | {
      readonly type: "caravan-passage";
      readonly direction: ApproximateTravelDirection;
      readonly trackAge: ApproximateTrackAge;
    }
  | {
      readonly type: "caravan-loss";
      readonly condition: "fresh" | "weathered" | "ruined";
    }
  | {
      readonly type: "creature-sighting";
      readonly direction: ApproximateTravelDirection;
      readonly strength: "weak" | "dangerous" | "overwhelming";
    }
  | {
      readonly type: "fallen-library";
      readonly readability: "clear" | "fragmentary" | "illegible";
    };

export interface WorldRumorInput {
  readonly worldSeed: string;
  readonly originCityId: string;
  readonly subjectId: string;
  readonly observedAtWorldTimeSeconds: DurationSeconds;
  readonly createdAtWorldTimeSeconds: DurationSeconds;
  readonly sourceEvidenceIds: readonly string[];
  readonly sourceConfidence: WorldEvidenceConfidence;
  readonly facts: WorldRumorFacts;
}

/** Player-facing rumor. It never contains a server coordinate. */
export interface WorldRumor {
  readonly id: string;
  readonly type: WorldRumorType;
  readonly originCityId: string;
  readonly subjectId: string;
  readonly createdAtWorldTimeSeconds: DurationSeconds;
  readonly approximateAge: WorldRumorAge;
  readonly quality: WorldRumorQuality;
  readonly sourceCount: number;
  readonly sourceConfidence: WorldEvidenceConfidence;
  readonly facts: WorldRumorFacts;
}

/**
 * HISTORY-001 — composes several rumor kinds through one deterministic quality
 * ladder. More independent sources and confirmed evidence improve quality;
 * no hidden coordinates or exact observation time enter the public rumor.
 */
export function createWorldRumor(input: WorldRumorInput): WorldRumor {
  assertNonEmptyString(input.worldSeed, "worldSeed");
  assertNonEmptyString(input.originCityId, "originCityId");
  assertNonEmptyString(input.subjectId, "subjectId");
  assertNonNegativeFinite(
    input.observedAtWorldTimeSeconds,
    "observedAtWorldTimeSeconds",
  );
  assertNonNegativeFinite(
    input.createdAtWorldTimeSeconds,
    "createdAtWorldTimeSeconds",
  );
  if (input.createdAtWorldTimeSeconds < input.observedAtWorldTimeSeconds) {
    throw new RangeError("rumor creation must not precede observation");
  }
  if (
    !Array.isArray(input.sourceEvidenceIds) ||
    input.sourceEvidenceIds.length === 0
  ) {
    throw new RangeError("sourceEvidenceIds must contain at least one source");
  }
  const sources = [...new Set(input.sourceEvidenceIds)].sort(compareRaw);
  if (sources.length !== input.sourceEvidenceIds.length) {
    throw new RangeError("sourceEvidenceIds must be unique");
  }
  for (const sourceId of sources) {
    assertNonEmptyString(sourceId, "sourceEvidenceIds entry");
  }
  assertConfidence(input.sourceConfidence);
  assertRumorFacts(input.facts);

  const identity = `${input.worldSeed}:${input.originCityId}:${input.subjectId}:${input.facts.type}:${input.createdAtWorldTimeSeconds}:${sources.join(",")}`;
  return {
    id: `world-rumor-${hashSeed(identity).toString(16).padStart(8, "0")}`,
    type: input.facts.type,
    originCityId: input.originCityId,
    subjectId: input.subjectId,
    createdAtWorldTimeSeconds: input.createdAtWorldTimeSeconds,
    approximateAge: rumorAge(
      input.createdAtWorldTimeSeconds - input.observedAtWorldTimeSeconds,
    ),
    quality: rumorQuality(input.sourceConfidence, sources.length),
    sourceCount: sources.length,
    sourceConfidence: input.sourceConfidence,
    facts: { ...input.facts },
  };
}

export function rumorQuality(
  confidence: WorldEvidenceConfidence,
  sourceCount: number,
): WorldRumorQuality {
  assertConfidence(confidence);
  if (!Number.isSafeInteger(sourceCount) || sourceCount <= 0) {
    throw new RangeError("sourceCount must be a positive safe integer");
  }
  if (confidence === "confirmed") {
    return sourceCount >= 2 ? "corroborated" : "reliable";
  }
  if (sourceCount >= 3) return "reliable";
  return sourceCount >= 2 ? "rough" : "unverified";
}

export function rumorAge(ageSeconds: DurationSeconds): WorldRumorAge {
  assertNonNegativeFinite(ageSeconds, "ageSeconds");
  if (ageSeconds < 60 * 60) return "fresh";
  if (ageSeconds < 24 * 60 * 60) return "recent";
  if (ageSeconds < 30 * 24 * 60 * 60) return "old";
  return "ancient";
}

function assertRumorFacts(facts: WorldRumorFacts): void {
  if (
    facts.type !== "caravan-passage" &&
    facts.type !== "caravan-loss" &&
    facts.type !== "creature-sighting" &&
    facts.type !== "fallen-library"
  ) {
    throw new RangeError("rumor facts type is invalid");
  }
}

function assertConfidence(
  value: string,
): asserts value is WorldEvidenceConfidence {
  if (value !== "probable" && value !== "confirmed") {
    throw new RangeError("confidence must be probable or confirmed");
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
