import type { DurationSeconds, SpeedMetersPerSecond } from "./route.js";
import type { DistanceMeters } from "./types.js";

export const DEFAULT_FLEE_SAFE_SEPARATION_MULTIPLIER = 2;

export type FleeResolutionStatus = "flee-succeeded" | "flee-failed";
export type FleeRouteDisposition = "continue" | "fail";
export type FleeResolutionReason = "caravan-faster" | "caravan-not-faster";

export interface FleeAttemptInput {
  readonly caravanSpeedMetersPerSecond: SpeedMetersPerSecond;
  readonly monsterSpeedMetersPerSecond: SpeedMetersPerSecond;
  readonly contactSeparationMeters: DistanceMeters;
  readonly safeSeparationMeters: DistanceMeters;
}

export interface FleeResolution extends FleeAttemptInput {
  readonly relativeSpeedMetersPerSecond: number;
  readonly requiredSeparationGainMeters: DistanceMeters;
  readonly secondsToSafeSeparation: DurationSeconds | null;
  readonly status: FleeResolutionStatus;
  readonly reason: FleeResolutionReason;
  readonly routeDisposition: FleeRouteDisposition;
  readonly escaped: boolean;
  readonly expeditionDefeated: boolean;
  readonly terminal: boolean;
}

/**
 * GAME-006 — resolves the MVP FLEE doctrine from explicit movement inputs.
 * A caravan must be strictly faster than the pursuing monster to open the
 * requested safe separation. Equal or lower speed is a deterministic defeat;
 * no probability, Power modifier or tactical round is introduced.
 */
export function resolveFleeAttempt(input: FleeAttemptInput): FleeResolution {
  assertPositiveFinite(
    input.caravanSpeedMetersPerSecond,
    "caravanSpeedMetersPerSecond",
  );
  assertPositiveFinite(
    input.monsterSpeedMetersPerSecond,
    "monsterSpeedMetersPerSecond",
  );
  assertNonNegativeFinite(
    input.contactSeparationMeters,
    "contactSeparationMeters",
  );
  assertNonNegativeFinite(input.safeSeparationMeters, "safeSeparationMeters");

  if (input.safeSeparationMeters <= input.contactSeparationMeters) {
    throw new RangeError(
      "safeSeparationMeters must be greater than contactSeparationMeters",
    );
  }

  const relativeSpeedMetersPerSecond =
    input.caravanSpeedMetersPerSecond - input.monsterSpeedMetersPerSecond;
  const requiredSeparationGainMeters =
    input.safeSeparationMeters - input.contactSeparationMeters;

  if (relativeSpeedMetersPerSecond <= 0) {
    return {
      ...input,
      relativeSpeedMetersPerSecond,
      requiredSeparationGainMeters,
      secondsToSafeSeparation: null,
      status: "flee-failed",
      reason: "caravan-not-faster",
      routeDisposition: "fail",
      escaped: false,
      expeditionDefeated: true,
      terminal: true,
    };
  }

  const secondsToSafeSeparation =
    requiredSeparationGainMeters / relativeSpeedMetersPerSecond;
  if (!Number.isFinite(secondsToSafeSeparation)) {
    throw new RangeError("calculated flee duration must be finite");
  }

  return {
    ...input,
    relativeSpeedMetersPerSecond,
    requiredSeparationGainMeters,
    secondsToSafeSeparation,
    status: "flee-succeeded",
    reason: "caravan-faster",
    routeDisposition: "continue",
    escaped: true,
    expeditionDefeated: false,
    terminal: false,
  };
}

function assertPositiveFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive finite number`);
  }
}

function assertNonNegativeFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative finite number`);
  }
}
