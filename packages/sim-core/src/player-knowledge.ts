import type { DurationSeconds, RouteCommand } from "./route.js";
import {
  normalizeBearing,
  type BearingDegrees,
  type DistanceMeters,
} from "./types.js";
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
  readonly originBearingDeg: BearingDegrees;
  readonly originDistanceMeters: DistanceMeters;
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

export interface KnownObjectReturnNavigation {
  readonly objectId: string;
  readonly objectKind: StaticWorldObjectKind;
  readonly originCityId: string;
  readonly source: PlayerKnowledgeSource;
  readonly confidence: PlayerKnowledgeConfidence;
  readonly firstObservedInExpedition: number;
  readonly command: RouteCommand;
}

export interface ExpeditionTravelTrack {
  readonly expeditionNumber: number;
  readonly originCityId: string;
  readonly legs: readonly RouteCommand[];
  readonly traveledDistanceMeters: DistanceMeters;
}

export interface PlayerTravelLedger {
  readonly worldSeed: string;
  readonly tracks: readonly ExpeditionTravelTrack[];
  readonly reachedCityLandmarks: readonly ReachedCityLandmark[];
}

export interface ReachedCityLandmark {
  readonly expeditionNumber: number;
  readonly originCityId: string;
  readonly cityId: string;
  readonly arrivedAtSeconds: DurationSeconds;
  readonly bearingDeg: BearingDegrees;
  readonly distanceMeters: DistanceMeters;
  readonly source: "authoritative-arrival";
  readonly confidence: PlayerKnowledgeConfidence;
}

export interface ReachedCityLandmarkInput {
  readonly expeditionNumber: number;
  readonly originCityId: string;
  readonly cityId: string;
  readonly arrivedAtSeconds: DurationSeconds;
  readonly originBearingDeg: BearingDegrees;
  readonly originDistanceMeters: DistanceMeters;
}

export interface ExpeditionTravelProgressInput {
  readonly expeditionNumber: number;
  readonly originCityId: string;
  readonly routeCommands: readonly RouteCommand[];
  readonly traveledDistanceMeters: DistanceMeters;
}

export type TravelLedgerRecordStatus =
  | "no-progress"
  | "first-progress"
  | "progressed"
  | "unchanged";

export interface TravelLedgerRecordResult {
  readonly ledger: PlayerTravelLedger;
  readonly track: ExpeditionTravelTrack | null;
  readonly status: TravelLedgerRecordStatus;
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
 * GAME-014 — creates a coordinate-free browser-session record of corridors the
 * player has physically travelled. Like discovery knowledge, this is not yet a
 * persistent or transferable production map.
 */
export function createPlayerTravelLedger(
  worldSeed: string,
): PlayerTravelLedger {
  assertNonEmptyString(worldSeed, "worldSeed");
  return { worldSeed, tracks: [], reachedCityLandmarks: [] };
}

/**
 * GAME-016 — confirms a reached city only after authoritative arrival. The
 * session ledger retains a relative fix from the expedition origin and never
 * stores either city's server coordinate.
 */
export function recordReachedCityLandmark(
  ledger: PlayerTravelLedger,
  input: ReachedCityLandmarkInput,
): PlayerTravelLedger {
  assertTravelLedger(ledger);
  assertPositiveSafeInteger(input.expeditionNumber, "expeditionNumber");
  assertNonEmptyString(input.originCityId, "originCityId");
  assertNonEmptyString(input.cityId, "cityId");
  assertNonNegativeFinite(input.arrivedAtSeconds, "arrivedAtSeconds");
  if (!Number.isFinite(input.originBearingDeg)) {
    throw new TypeError("originBearingDeg must be a finite number");
  }
  assertNonNegativeFinite(input.originDistanceMeters, "originDistanceMeters");

  const existing = ledger.reachedCityLandmarks.find(
    (landmark) =>
      landmark.expeditionNumber === input.expeditionNumber &&
      landmark.cityId === input.cityId,
  );
  if (existing) return ledger;

  return {
    ...ledger,
    reachedCityLandmarks: [
      ...ledger.reachedCityLandmarks,
      {
        expeditionNumber: input.expeditionNumber,
        originCityId: input.originCityId,
        cityId: input.cityId,
        arrivedAtSeconds: input.arrivedAtSeconds,
        bearingDeg: normalizeBearing(input.originBearingDeg),
        distanceMeters: input.originDistanceMeters,
        source: "authoritative-arrival",
        confidence: "confirmed",
      },
    ],
  };
}

/**
 * Retains only the executed prefix of a route. Planned legs beyond
 * traveledDistanceMeters never enter the ledger, repeated renders are
 * idempotent, and rewinding a development clock cannot erase prior travel.
 */
export function recordExpeditionTravelProgress(
  ledger: PlayerTravelLedger,
  input: ExpeditionTravelProgressInput,
): TravelLedgerRecordResult {
  assertTravelLedger(ledger);
  assertPositiveSafeInteger(input.expeditionNumber, "expeditionNumber");
  assertNonEmptyString(input.originCityId, "originCityId");
  assertNonNegativeFinite(
    input.traveledDistanceMeters,
    "traveledDistanceMeters",
  );
  if (!Array.isArray(input.routeCommands) || input.routeCommands.length === 0) {
    throw new RangeError("routeCommands must contain at least one command");
  }

  const routeCommands = input.routeCommands.map((command, index) => {
    if (!Number.isFinite(command.bearingDeg)) {
      throw new TypeError(
        `routeCommands[${index}].bearingDeg must be a finite number`,
      );
    }
    assertNonNegativeFinite(
      command.distanceMeters,
      `routeCommands[${index}].distanceMeters`,
    );
    return {
      bearingDeg: normalizeBearing(command.bearingDeg),
      distanceMeters: command.distanceMeters,
    };
  });
  const totalDistanceMeters = routeCommands.reduce(
    (sum, command) => sum + command.distanceMeters,
    0,
  );
  if (input.traveledDistanceMeters > totalDistanceMeters + 1e-7) {
    throw new RangeError(
      "traveledDistanceMeters must not exceed the planned route distance",
    );
  }

  const existingIndex = ledger.tracks.findIndex(
    (track) => track.expeditionNumber === input.expeditionNumber,
  );
  const existing =
    existingIndex >= 0 ? ledger.tracks[existingIndex] ?? null : null;
  if (existing && existing.originCityId !== input.originCityId) {
    throw new RangeError(
      "originCityId must match the existing expedition travel track",
    );
  }
  if (
    !existing &&
    ledger.tracks.some(
      (track) => track.expeditionNumber > input.expeditionNumber,
    )
  ) {
    throw new RangeError(
      "expeditionNumber must not precede recorded travel tracks",
    );
  }

  const executedDistanceMeters = Math.min(
    input.traveledDistanceMeters,
    totalDistanceMeters,
  );
  if (executedDistanceMeters <= 1e-7) {
    return {
      ledger,
      track: existing,
      status: existing ? "unchanged" : "no-progress",
    };
  }
  if (
    existing &&
    executedDistanceMeters <= existing.traveledDistanceMeters + 1e-7
  ) {
    return { ledger, track: existing, status: "unchanged" };
  }

  const legs = executedRoutePrefix(routeCommands, executedDistanceMeters);
  if (existing) assertTravelTrackPrefix(existing.legs, legs);
  const track: ExpeditionTravelTrack = {
    expeditionNumber: input.expeditionNumber,
    originCityId: input.originCityId,
    legs,
    traveledDistanceMeters: legs.reduce(
      (sum, leg) => sum + leg.distanceMeters,
      0,
    ),
  };

  if (!existing) {
    return {
      ledger: {
        worldSeed: ledger.worldSeed,
        tracks: [...ledger.tracks, track],
        reachedCityLandmarks: ledger.reachedCityLandmarks,
      },
      track,
      status: "first-progress",
    };
  }
  return {
    ledger: {
      worldSeed: ledger.worldSeed,
      tracks: ledger.tracks.map((candidate, index) =>
        index === existingIndex ? track : candidate,
      ),
      reachedCityLandmarks: ledger.reachedCityLandmarks,
    },
    track,
    status: "progressed",
  };
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
    originBearingDeg: normalizeBearing(input.originBearingDeg),
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

/**
 * GAME-012 — turns one selected confirmed ledger entry into a coordinate-free
 * navigation command from the city where the object was first observed.
 * Later observations never rewrite this original personal-map anchor.
 */
export function createKnownObjectReturnNavigation(
  ledger: PlayerDiscoveryLedger,
  objectId: string,
): KnownObjectReturnNavigation {
  assertLedger(ledger);
  assertNonEmptyString(objectId, "objectId");

  const entry = ledger.entries.find(
    (candidate) => candidate.objectId === objectId,
  );
  if (!entry) {
    throw new RangeError("objectId must reference a known ledger entry");
  }

  const first = entry.firstObservation;
  return {
    objectId: entry.objectId,
    objectKind: entry.objectKind,
    originCityId: first.originCityId,
    source: entry.source,
    confidence: entry.confidence,
    firstObservedInExpedition: first.expeditionNumber,
    command: {
      bearingDeg: first.originBearingDeg,
      distanceMeters: first.originDistanceMeters,
    },
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

function assertTravelLedger(ledger: PlayerTravelLedger): void {
  assertNonEmptyString(ledger.worldSeed, "ledger.worldSeed");
  if (!Array.isArray(ledger.tracks)) {
    throw new TypeError("ledger.tracks must be an array");
  }
  if (!Array.isArray(ledger.reachedCityLandmarks)) {
    throw new TypeError("ledger.reachedCityLandmarks must be an array");
  }
}

function executedRoutePrefix(
  commands: readonly RouteCommand[],
  traveledDistanceMeters: DistanceMeters,
): RouteCommand[] {
  const legs: RouteCommand[] = [];
  let remainingDistanceMeters = traveledDistanceMeters;
  for (const command of commands) {
    if (remainingDistanceMeters <= 1e-7) break;
    const distanceMeters = Math.min(
      command.distanceMeters,
      remainingDistanceMeters,
    );
    if (distanceMeters > 1e-7) {
      legs.push({ bearingDeg: command.bearingDeg, distanceMeters });
      remainingDistanceMeters -= distanceMeters;
    }
  }
  return legs;
}

function assertTravelTrackPrefix(
  previous: readonly RouteCommand[],
  next: readonly RouteCommand[],
): void {
  for (let index = 0; index < previous.length; index += 1) {
    const previousLeg = previous[index];
    const nextLeg = next[index];
    if (!previousLeg || !nextLeg) {
      throw new RangeError("routeCommands must preserve recorded travel");
    }
    const isLastPreviousLeg = index === previous.length - 1;
    const distanceMatches = isLastPreviousLeg
      ? nextLeg.distanceMeters + 1e-7 >= previousLeg.distanceMeters
      : Math.abs(nextLeg.distanceMeters - previousLeg.distanceMeters) <= 1e-7;
    if (
      Math.abs(nextLeg.bearingDeg - previousLeg.bearingDeg) > 1e-9 ||
      !distanceMatches
    ) {
      throw new RangeError("routeCommands must preserve recorded travel");
    }
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
  if (!Number.isFinite(input.originBearingDeg)) {
    throw new TypeError("originBearingDeg must be a finite number");
  }
  assertPositiveFinite(input.originDistanceMeters, "originDistanceMeters");
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

function assertPositiveFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive finite number`);
  }
}
