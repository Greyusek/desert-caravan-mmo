import type { RoutePlan, DurationSeconds } from "./route.js";
import {
  timeToFirstDepletion,
  type ConsumptionProfile,
  type SupplyDepletionCause,
  type SupplyStock,
} from "./supplies.js";

export type ExpeditionOutcomeStatus =
  | "in-progress"
  | "paused"
  | "completed"
  | "failed";

export type PlannedExpeditionOutcomeStatus = Exclude<
  ExpeditionOutcomeStatus,
  "in-progress"
>;

export interface PlannedExpeditionOutcome {
  readonly status: PlannedExpeditionOutcomeStatus;
  readonly atSeconds: DurationSeconds;
  readonly failureCause: SupplyDepletionCause;
}

export interface ExpeditionOutcomeEvaluation {
  readonly status: ExpeditionOutcomeStatus;
  readonly evaluatedAtSeconds: DurationSeconds;
  /** Elapsed route time that SIM-005 should evaluate after the outcome boundary. */
  readonly movementElapsedSeconds: DurationSeconds;
  readonly planned: PlannedExpeditionOutcome;
  readonly endedAtSeconds: DurationSeconds | null;
  readonly failureCause: SupplyDepletionCause;
  readonly terminal: boolean;
}

const TIME_EPSILON_SECONDS = 1e-9;

/**
 * GAME-003 — resolves the first authoritative expedition boundary.
 *
 * A doctrine pause wins only when it happens strictly before both arrival and
 * fatal depletion. Depletion wins an exact tie with arrival or pause because
 * SIM-006 defines an exactly empty critical stock as non-survivable for MVP.
 */
export function evaluateExpeditionOutcome(
  route: RoutePlan,
  initialSupplies: SupplyStock,
  consumptionProfile: ConsumptionProfile,
  elapsedSeconds: DurationSeconds,
  pausedAtSeconds: DurationSeconds | null = null,
): ExpeditionOutcomeEvaluation {
  assertNonNegativeFinite(elapsedSeconds, "elapsedSeconds");
  if (pausedAtSeconds !== null) {
    assertNonNegativeFinite(pausedAtSeconds, "pausedAtSeconds");
  }

  const firstDepletion = timeToFirstDepletion(
    initialSupplies,
    consumptionProfile,
    "moving",
  );
  const failureAtSeconds =
    firstDepletion.atSeconds !== null &&
    firstDepletion.atSeconds <=
      route.totalDurationSeconds + TIME_EPSILON_SECONDS
      ? firstDepletion.atSeconds
      : null;

  const pauseWins =
    pausedAtSeconds !== null &&
    pausedAtSeconds < route.totalDurationSeconds - TIME_EPSILON_SECONDS &&
    (failureAtSeconds === null ||
      pausedAtSeconds < failureAtSeconds - TIME_EPSILON_SECONDS);

  const planned: PlannedExpeditionOutcome = pauseWins
    ? {
        status: "paused",
        atSeconds: pausedAtSeconds,
        failureCause: null,
      }
    : failureAtSeconds !== null
      ? {
          status: "failed",
          atSeconds: failureAtSeconds,
          failureCause: firstDepletion.cause,
        }
      : {
          status: "completed",
          atSeconds: route.totalDurationSeconds,
          failureCause: null,
        };

  if (elapsedSeconds + TIME_EPSILON_SECONDS < planned.atSeconds) {
    return {
      status: "in-progress",
      evaluatedAtSeconds: elapsedSeconds,
      movementElapsedSeconds: elapsedSeconds,
      planned,
      endedAtSeconds: null,
      failureCause: null,
      terminal: false,
    };
  }

  return {
    status: planned.status,
    evaluatedAtSeconds: elapsedSeconds,
    movementElapsedSeconds: planned.atSeconds,
    planned,
    endedAtSeconds: planned.atSeconds,
    failureCause: planned.failureCause,
    terminal: planned.status === "completed" || planned.status === "failed",
  };
}

function assertNonNegativeFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative finite number`);
  }
}
