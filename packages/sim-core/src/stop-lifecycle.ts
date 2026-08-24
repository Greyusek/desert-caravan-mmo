import type {
  ExpeditionOutcomeEvaluation,
  ExpeditionOutcomeStatus,
  PlannedExpeditionOutcomeStatus,
} from "./expedition.js";
import type { DurationSeconds, RoutePlan } from "./route.js";
import {
  projectSupplies,
  timeToFirstDepletion,
  type CaravanActivity,
  type ConsumptionProfile,
  type SupplyDepletionCause,
  type SupplyStock,
} from "./supplies.js";

export type DiscoveryStopPhase =
  | "moving-to-stop"
  | "idle-at-stop"
  | "moving-after-stop"
  | "ended";

export interface MixedActivitySupplyProjection {
  readonly movementElapsedSeconds: DurationSeconds;
  readonly idleElapsedSeconds: DurationSeconds;
  readonly foodConsumed: number;
  readonly waterConsumed: number;
  readonly foodRemaining: number;
  readonly waterRemaining: number;
  readonly depleted: boolean;
  readonly depletionCause: SupplyDepletionCause;
}

export interface PlannedDiscoveryStopOutcome {
  readonly status: PlannedExpeditionOutcomeStatus;
  /** Expedition/world time, including the explicit stop duration. */
  readonly atSeconds: DurationSeconds;
  /** SIM-005 route time at the same authoritative boundary. */
  readonly movementElapsedSeconds: DurationSeconds;
  readonly failureCause: SupplyDepletionCause;
}

export interface DiscoveryStopLifecycleEvaluation
  extends Omit<ExpeditionOutcomeEvaluation, "planned"> {
  readonly phase: DiscoveryStopPhase;
  readonly stopAtRouteSeconds: DurationSeconds;
  readonly idleDurationSeconds: DurationSeconds;
  readonly idleElapsedSeconds: DurationSeconds;
  readonly resumeAtSeconds: DurationSeconds | null;
  readonly completionAtSeconds: DurationSeconds | null;
  readonly failureActivity: CaravanActivity | null;
  readonly supplies: MixedActivitySupplyProjection;
  readonly planned: PlannedDiscoveryStopOutcome;
}

const TIME_EPSILON_SECONDS = 1e-9;

/**
 * GAME-009 — evaluates one scheduled discovery STOP as an explicit idle phase.
 *
 * Expedition time keeps advancing while SIM-005 route time is pinned to the
 * discovery coordinate. Moving consumption applies before/after the stop and
 * idle consumption applies during it. Fatal depletion wins an exact tie with
 * STOP completion, route completion or city entry.
 */
export function evaluateDiscoveryStopLifecycle(
  route: RoutePlan,
  initialSupplies: SupplyStock,
  consumptionProfile: ConsumptionProfile,
  elapsedSeconds: DurationSeconds,
  stopAtRouteSeconds: DurationSeconds,
  idleDurationSeconds: DurationSeconds,
  completionAtRouteSeconds: DurationSeconds | null =
    route.totalDurationSeconds,
): DiscoveryStopLifecycleEvaluation {
  assertNonNegativeFinite(elapsedSeconds, "elapsedSeconds");
  assertRouteTime(route, stopAtRouteSeconds, "stopAtRouteSeconds");
  assertNonNegativeFinite(idleDurationSeconds, "idleDurationSeconds");
  if (completionAtRouteSeconds !== null) {
    assertRouteTime(
      route,
      completionAtRouteSeconds,
      "completionAtRouteSeconds",
    );
  }

  const executionEndRouteSeconds = completionAtRouteSeconds ??
    route.totalDurationSeconds;
  const preStopMovementSeconds = Math.min(
    stopAtRouteSeconds,
    executionEndRouteSeconds,
  );
  const preStopDepletion = timeToFirstDepletion(
    initialSupplies,
    consumptionProfile,
    "moving",
  );

  let plannedStatus: PlannedExpeditionOutcomeStatus;
  let plannedAtSeconds: DurationSeconds;
  let plannedMovementElapsedSeconds: DurationSeconds;
  let plannedFailureCause: SupplyDepletionCause = null;
  let failureActivity: CaravanActivity | null = null;
  let resumeAtSeconds: DurationSeconds | null = null;
  let completionAtSeconds: DurationSeconds | null = null;

  const failsBeforeOrAtStop =
    preStopDepletion.atSeconds !== null &&
    preStopDepletion.atSeconds <=
      preStopMovementSeconds + TIME_EPSILON_SECONDS;

  if (failsBeforeOrAtStop && preStopDepletion.atSeconds !== null) {
    plannedStatus = "failed";
    plannedAtSeconds = preStopDepletion.atSeconds;
    plannedMovementElapsedSeconds = preStopDepletion.atSeconds;
    plannedFailureCause = preStopDepletion.cause;
    failureActivity = "moving";
  } else if (
    executionEndRouteSeconds <=
    stopAtRouteSeconds + TIME_EPSILON_SECONDS
  ) {
    plannedStatus = completionAtRouteSeconds === null ? "paused" : "completed";
    plannedAtSeconds = executionEndRouteSeconds;
    plannedMovementElapsedSeconds = executionEndRouteSeconds;
    completionAtSeconds =
      completionAtRouteSeconds === null ? null : executionEndRouteSeconds;
  } else {
    resumeAtSeconds = stopAtRouteSeconds + idleDurationSeconds;
    completionAtSeconds =
      completionAtRouteSeconds === null
        ? null
        : completionAtRouteSeconds + idleDurationSeconds;

    const suppliesAtStop = projectSupplies(
      initialSupplies,
      consumptionProfile,
      "moving",
      stopAtRouteSeconds,
    );
    const stockAtStop = {
      foodUnits: suppliesAtStop.foodRemaining,
      waterUnits: suppliesAtStop.waterRemaining,
    };
    const idleDepletion = timeToFirstDepletion(
      stockAtStop,
      consumptionProfile,
      "idle",
    );
    const failsDuringIdle =
      idleDepletion.atSeconds !== null &&
      idleDepletion.atSeconds <= idleDurationSeconds + TIME_EPSILON_SECONDS;

    if (failsDuringIdle && idleDepletion.atSeconds !== null) {
      plannedStatus = "failed";
      plannedAtSeconds = stopAtRouteSeconds + idleDepletion.atSeconds;
      plannedMovementElapsedSeconds = stopAtRouteSeconds;
      plannedFailureCause = idleDepletion.cause;
      failureActivity = "idle";
    } else {
      const suppliesAfterIdle = projectSupplies(
        stockAtStop,
        consumptionProfile,
        "idle",
        idleDurationSeconds,
      );
      const stockAfterIdle = {
        foodUnits: suppliesAfterIdle.foodRemaining,
        waterUnits: suppliesAfterIdle.waterRemaining,
      };
      const postStopDepletion = timeToFirstDepletion(
        stockAfterIdle,
        consumptionProfile,
        "moving",
      );
      const remainingMovementSeconds =
        executionEndRouteSeconds - stopAtRouteSeconds;
      const failsAfterResume =
        postStopDepletion.atSeconds !== null &&
        postStopDepletion.atSeconds <=
          remainingMovementSeconds + TIME_EPSILON_SECONDS;

      if (failsAfterResume && postStopDepletion.atSeconds !== null) {
        plannedStatus = "failed";
        plannedAtSeconds =
          resumeAtSeconds + postStopDepletion.atSeconds;
        plannedMovementElapsedSeconds =
          stopAtRouteSeconds + postStopDepletion.atSeconds;
        plannedFailureCause = postStopDepletion.cause;
        failureActivity = "moving";
      } else {
        plannedStatus =
          completionAtRouteSeconds === null ? "paused" : "completed";
        plannedAtSeconds =
          executionEndRouteSeconds + idleDurationSeconds;
        plannedMovementElapsedSeconds = executionEndRouteSeconds;
      }
    }
  }

  const planned: PlannedDiscoveryStopOutcome = {
    status: plannedStatus,
    atSeconds: plannedAtSeconds,
    movementElapsedSeconds: plannedMovementElapsedSeconds,
    failureCause: plannedFailureCause,
  };
  const occurred =
    elapsedSeconds + TIME_EPSILON_SECONDS >= plannedAtSeconds;
  const evaluatedBoundarySeconds = Math.min(elapsedSeconds, plannedAtSeconds);
  const movementElapsedSeconds = expeditionTimeToRouteTime(
    evaluatedBoundarySeconds,
    stopAtRouteSeconds,
    idleDurationSeconds,
    resumeAtSeconds !== null,
  );
  const idleElapsedSeconds = resumeAtSeconds === null
    ? 0
    : Math.min(
        idleDurationSeconds,
        Math.max(0, evaluatedBoundarySeconds - stopAtRouteSeconds),
      );
  const supplies = projectMixedActivitySupplies(
    initialSupplies,
    consumptionProfile,
    movementElapsedSeconds,
    idleElapsedSeconds,
  );
  const status: ExpeditionOutcomeStatus = occurred
    ? planned.status
    : "in-progress";
  const phase: DiscoveryStopPhase = occurred
    ? "ended"
    : resumeAtSeconds !== null &&
        evaluatedBoundarySeconds + TIME_EPSILON_SECONDS >= stopAtRouteSeconds &&
        evaluatedBoundarySeconds < resumeAtSeconds - TIME_EPSILON_SECONDS
      ? "idle-at-stop"
      : resumeAtSeconds !== null &&
          evaluatedBoundarySeconds + TIME_EPSILON_SECONDS >= resumeAtSeconds
        ? "moving-after-stop"
        : "moving-to-stop";

  return {
    status,
    evaluatedAtSeconds: elapsedSeconds,
    movementElapsedSeconds,
    planned,
    endedAtSeconds: occurred ? planned.atSeconds : null,
    failureCause: occurred ? planned.failureCause : null,
    terminal:
      occurred &&
      (planned.status === "completed" || planned.status === "failed"),
    phase,
    stopAtRouteSeconds,
    idleDurationSeconds,
    idleElapsedSeconds,
    resumeAtSeconds,
    completionAtSeconds,
    failureActivity,
    supplies,
  };
}

/** Maps expedition/world time to SIM-005 time for one scheduled STOP. */
export function expeditionTimeToRouteTime(
  expeditionElapsedSeconds: DurationSeconds,
  stopAtRouteSeconds: DurationSeconds,
  idleDurationSeconds: DurationSeconds,
  stopExecutes = true,
): DurationSeconds {
  assertNonNegativeFinite(
    expeditionElapsedSeconds,
    "expeditionElapsedSeconds",
  );
  assertNonNegativeFinite(stopAtRouteSeconds, "stopAtRouteSeconds");
  assertNonNegativeFinite(idleDurationSeconds, "idleDurationSeconds");
  if (!stopExecutes || expeditionElapsedSeconds <= stopAtRouteSeconds) {
    return expeditionElapsedSeconds;
  }
  if (expeditionElapsedSeconds < stopAtRouteSeconds + idleDurationSeconds) {
    return stopAtRouteSeconds;
  }
  return expeditionElapsedSeconds - idleDurationSeconds;
}

/** Maps SIM-005 route time to expedition/world time for one scheduled STOP. */
export function routeTimeToExpeditionTime(
  routeElapsedSeconds: DurationSeconds,
  stopAtRouteSeconds: DurationSeconds,
  idleDurationSeconds: DurationSeconds,
  stopExecutes = true,
): DurationSeconds {
  assertNonNegativeFinite(routeElapsedSeconds, "routeElapsedSeconds");
  assertNonNegativeFinite(stopAtRouteSeconds, "stopAtRouteSeconds");
  assertNonNegativeFinite(idleDurationSeconds, "idleDurationSeconds");
  return stopExecutes && routeElapsedSeconds > stopAtRouteSeconds
    ? routeElapsedSeconds + idleDurationSeconds
    : routeElapsedSeconds;
}

/** Projects the combined linear consumption of moving and idle phases. */
export function projectMixedActivitySupplies(
  initialSupplies: SupplyStock,
  consumptionProfile: ConsumptionProfile,
  movementElapsedSeconds: DurationSeconds,
  idleElapsedSeconds: DurationSeconds,
): MixedActivitySupplyProjection {
  const afterMovement = projectSupplies(
    initialSupplies,
    consumptionProfile,
    "moving",
    movementElapsedSeconds,
  );
  const afterIdle = projectSupplies(
    {
      foodUnits: afterMovement.foodRemaining,
      waterUnits: afterMovement.waterRemaining,
    },
    consumptionProfile,
    "idle",
    idleElapsedSeconds,
  );
  const foodRemaining = afterIdle.foodRemaining;
  const waterRemaining = afterIdle.waterRemaining;
  const foodDepleted = foodRemaining <= TIME_EPSILON_SECONDS;
  const waterDepleted = waterRemaining <= TIME_EPSILON_SECONDS;

  return {
    movementElapsedSeconds,
    idleElapsedSeconds,
    foodConsumed: initialSupplies.foodUnits - foodRemaining,
    waterConsumed: initialSupplies.waterUnits - waterRemaining,
    foodRemaining,
    waterRemaining,
    depleted: foodDepleted || waterDepleted,
    depletionCause:
      foodDepleted && waterDepleted
        ? "both"
        : foodDepleted
          ? "food"
          : waterDepleted
            ? "water"
            : null,
  };
}

function assertRouteTime(
  route: RoutePlan,
  value: number,
  name: string,
): void {
  assertNonNegativeFinite(value, name);
  if (value > route.totalDurationSeconds + TIME_EPSILON_SECONDS) {
    throw new RangeError(`${name} must not exceed route total duration`);
  }
}

function assertNonNegativeFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative finite number`);
  }
}
