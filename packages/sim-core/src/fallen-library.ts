import {
  copyCityLibraryKnowledgeToBundle,
  type CityLibraryArchive,
  type PhysicalKnowledgeBundle,
} from "./city-library.js";
import type { DurationSeconds } from "./route.js";
import type { WorldCoordinate } from "./types.js";
import type { PlayerWorldEvidenceEntry } from "./world-evidence.js";
import type { City } from "./world.js";

export const FALLEN_LIBRARY_FULL_INFORMATION_LOSS_SECONDS =
  30 * 24 * 60 * 60;
export const FALLEN_LIBRARY_STALE_INFORMATION_SECONDS = 7 * 24 * 60 * 60;

export type FallenLibraryCondition = "intact" | "damaged" | "ruined";
export type FallenInformationReadability =
  | "clear"
  | "fragmentary"
  | "illegible";
export type FallenInformationActuality = "current" | "stale" | "obsolete";

/** Permanent authoritative world object; position stays server-side. */
export interface FallenCityLibrary {
  readonly id: string;
  readonly kind: "fallen-city-library";
  readonly cityId: string;
  readonly worldSeed: string;
  readonly position: WorldCoordinate;
  readonly fellAtWorldTimeSeconds: DurationSeconds;
  readonly archiveSnapshot: CityLibraryArchive;
}

export interface FallenLibraryEntryState {
  readonly entryId: string;
  readonly completenessFraction: number;
  readonly readability: FallenInformationReadability;
  readonly actuality: FallenInformationActuality;
  readonly retainedConfidence: "probable" | "confirmed";
  readonly recoverable: boolean;
}

export interface ProjectedFallenCityLibrary {
  readonly library: FallenCityLibrary;
  readonly worldTimeSeconds: DurationSeconds;
  readonly ageSeconds: DurationSeconds;
  readonly condition: FallenLibraryCondition;
  readonly permanentlyPresent: true;
  readonly entryStates: readonly FallenLibraryEntryState[];
  readonly recoverableArchive: CityLibraryArchive;
}

/** Turns a local archive into a permanent discoverable world object. */
export function createFallenCityLibrary(
  library: CityLibraryArchive,
  city: City,
  fellAtWorldTimeSeconds: DurationSeconds,
): FallenCityLibrary {
  if (library.cityId !== city.id) {
    throw new RangeError("library.cityId must match the fallen city");
  }
  if (library.worldSeed.length === 0) {
    throw new RangeError("library.worldSeed must not be empty");
  }
  assertNonNegativeFinite(
    fellAtWorldTimeSeconds,
    "fellAtWorldTimeSeconds",
  );
  return {
    id: `fallen-library-${city.id}`,
    kind: "fallen-city-library",
    cityId: city.id,
    worldSeed: library.worldSeed,
    position: city.position,
    fellAtWorldTimeSeconds,
    archiveSnapshot: {
      ...library,
      entries: library.entries.map(cloneEntry),
      acceptedBundleIds: [...library.acceptedBundleIds],
    },
  };
}

/**
 * LIBRARY-002 — information loses completeness continuously, becomes stale,
 * loses confirmed precision below 50%, and becomes unreadable after 30 days.
 * The physical library world object is never deleted.
 */
export function projectFallenCityLibraryAtWorldTime(
  library: FallenCityLibrary,
  worldTimeSeconds: DurationSeconds,
): ProjectedFallenCityLibrary {
  assertNonNegativeFinite(worldTimeSeconds, "worldTimeSeconds");
  if (worldTimeSeconds < library.fellAtWorldTimeSeconds) {
    throw new RangeError("worldTimeSeconds must not precede city fall");
  }
  const ageSeconds = worldTimeSeconds - library.fellAtWorldTimeSeconds;
  const completenessFraction = Math.max(
    0,
    1 - ageSeconds / FALLEN_LIBRARY_FULL_INFORMATION_LOSS_SECONDS,
  );
  const readability: FallenInformationReadability =
    completenessFraction >= 2 / 3
      ? "clear"
      : completenessFraction > 0
        ? "fragmentary"
        : "illegible";
  const actuality: FallenInformationActuality =
    ageSeconds < FALLEN_LIBRARY_STALE_INFORMATION_SECONDS
      ? "current"
      : ageSeconds < FALLEN_LIBRARY_FULL_INFORMATION_LOSS_SECONDS
        ? "stale"
        : "obsolete";
  const condition: FallenLibraryCondition =
    completenessFraction >= 2 / 3
      ? "intact"
      : completenessFraction > 0
        ? "damaged"
        : "ruined";
  const entryStates = library.archiveSnapshot.entries.map((entry) => ({
    entryId: entry.id,
    completenessFraction,
    readability,
    actuality,
    retainedConfidence:
      completenessFraction >= 0.5 ? entry.confidence : "probable",
    recoverable: completenessFraction > 0,
  }));
  const recoverableEntries = library.archiveSnapshot.entries
    .filter(() => completenessFraction > 0)
    .map((entry) => ({
      ...cloneEntry(entry),
      confidence:
        completenessFraction >= 0.5 ? entry.confidence : "probable",
    }));

  return {
    library,
    worldTimeSeconds,
    ageSeconds,
    condition,
    permanentlyPresent: true,
    entryStates,
    recoverableArchive: {
      cityId: library.id,
      worldSeed: library.worldSeed,
      entries: recoverableEntries,
      acceptedBundleIds: [],
    },
  };
}

/** Physically extracts a copy from the still-readable projected archive. */
export function copyFallenLibraryKnowledgeToBundle(
  projection: ProjectedFallenCityLibrary,
  carrierId: string,
  selectedEntryIds: readonly string[],
): PhysicalKnowledgeBundle {
  return copyCityLibraryKnowledgeToBundle(
    projection.recoverableArchive,
    carrierId,
    selectedEntryIds,
    projection.worldTimeSeconds,
  );
}

function cloneEntry(
  entry: PlayerWorldEvidenceEntry,
): PlayerWorldEvidenceEntry {
  return { ...entry, facts: { ...entry.facts }, provenance: [...entry.provenance] };
}

function assertNonNegativeFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative finite number`);
  }
}
