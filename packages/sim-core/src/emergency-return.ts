import {
  greatCircleDistance,
  initialBearingDegrees,
} from "./geometry.js";
import {
  createRoutePlan,
  positionAtTime,
  type DurationSeconds,
  type RouteCommand,
  type RoutePlan,
} from "./route.js";
import {
  projectSupplies,
  type CaravanActivity,
  type ConsumptionProfile,
  type SupplyStock,
} from "./supplies.js";
import type { WorldCoordinate } from "./types.js";

export const DEFAULT_EMERGENCY_SUPPLY_FRACTION = 0.5;

export type SupplyEmergencyDoctrine = "RETURN_TO_ORIGIN" | "CONTINUE";
export type SupplyEmergencyCause = "food" | "water" | "both";

export interface SupplyEmergencyThreshold {
  readonly atSeconds: DurationSeconds;
  readonly cause: SupplyEmergencyCause;
  readonly remainingFraction: number;
  readonly foodRemaining: number;
  readonly waterRemaining: number;
}

export interface IdleStopSupplyEmergencyThreshold
  extends SupplyEmergencyThreshold {
  /** SIM-005 route time remains pinned here while the threshold is reached. */
  readonly routeAtSeconds: DurationSeconds;
  /** Time spent consuming the idle profile after discovery STOP. */
  readonly idleElapsedSeconds: DurationSeconds;
}

export interface EmergencyReturnPlan {
  readonly doctrine: SupplyEmergencyDoctrine;
  readonly threshold: SupplyEmergencyThreshold | null;
  readonly triggersBeforeRouteEnd: boolean;
  readonly originalRoute: RoutePlan;
  readonly effectiveRoute: RoutePlan;
  readonly triggerPosition: WorldCoordinate | null;
  readonly triggerSegmentIndex: number | null;
  readonly triggerRouteDistanceMeters: number | null;
  readonly returnSegmentIndex: number | null;
  readonly returnBearingDeg: number | null;
  readonly returnDistanceMeters: number | null;
  readonly returnToOriginAtSeconds: DurationSeconds | null;
}

export interface IdleStopEmergencyReturnPlan {
  readonly doctrine: SupplyEmergencyDoctrine;
  readonly threshold: IdleStopSupplyEmergencyThreshold | null;
  readonly triggersDuringIdleStop: boolean;
  readonly originalRoute: RoutePlan;
  readonly effectiveRoute: RoutePlan;
  readonly scheduledIdleDurationSeconds: DurationSeconds;
  readonly effectiveIdleDurationSeconds: DurationSeconds;
  readonly interruptsIdleStop: boolean;
  readonly triggerPosition: WorldCoordinate | null;
  readonly triggerSegmentIndex: number | null;
  readonly triggerRouteDistanceMeters: number | null;
  readonly returnSegmentIndex: number | null;
  readonly returnBearingDeg: number | null;
  readonly returnDistanceMeters: number | null;
  /** SIM-005 movement time at the route origin, excluding idle time. */
  readonly returnToOriginAtRouteSeconds: DurationSeconds | null;
  /** Expedition/world time at the route origin, including elapsed idle time. */
  readonly returnToOriginAtExpeditionSeconds: DurationSeconds | null;
}

const TIME_EPSILON_SECONDS = 1e-9;

/**
 * GAME-017 — finds the exact instant at which food or water first reaches an
 * explicit remaining-stock fraction during one continuous activity.
 */
export function timeToSupplyEmergencyThreshold(
  initialSupplies: SupplyStock,
  consumptionProfile: ConsumptionProfile,
  activity: CaravanActivity,
  remainingFraction = DEFAULT_EMERGENCY_SUPPLY_FRACTION,
): SupplyEmergencyThreshold | null {
  assertRemainingFraction(remainingFraction);
  projectSupplies(initialSupplies, consumptionProfile, activity, 0);

  const rates = consumptionProfile[activity];
  const foodAtSeconds = thresholdTime(
    initialSupplies.foodUnits,
    rates.foodUnitsPerHour,
    remainingFraction,
  );
  const waterAtSeconds = thresholdTime(
    initialSupplies.waterUnits,
    rates.waterUnitsPerHour,
    remainingFraction,
  );
  if (foodAtSeconds === null && waterAtSeconds === null) return null;

  const atSeconds = Math.min(
    foodAtSeconds ?? Number.POSITIVE_INFINITY,
    waterAtSeconds ?? Number.POSITIVE_INFINITY,
  );
  const foodMatches =
    foodAtSeconds !== null &&
    Math.abs(foodAtSeconds - atSeconds) <= TIME_EPSILON_SECONDS;
  const waterMatches =
    waterAtSeconds !== null &&
    Math.abs(waterAtSeconds - atSeconds) <= TIME_EPSILON_SECONDS;
  const projected = projectSupplies(
    initialSupplies,
    consumptionProfile,
    activity,
    atSeconds,
  );

  return {
    atSeconds,
    cause: foodMatches && waterMatches
      ? "both"
      : foodMatches
        ? "food"
        : "water",
    remainingFraction,
    foodRemaining: projected.foodRemaining,
    waterRemaining: projected.waterRemaining,
  };
}

/**
 * GAME-018 — finds the first 50% boundary inside one scheduled discovery STOP.
 * The target remains a fraction of the original expedition stock, not a new
 * fraction of whatever happened to remain when the caravan stopped.
 */
export function timeToSupplyEmergencyThresholdDuringIdleStop(
  initialSupplies: SupplyStock,
  consumptionProfile: ConsumptionProfile,
  stopAtRouteSeconds: DurationSeconds,
  idleDurationSeconds: DurationSeconds,
  remainingFraction = DEFAULT_EMERGENCY_SUPPLY_FRACTION,
): IdleStopSupplyEmergencyThreshold | null {
  assertRemainingFraction(remainingFraction);
  assertNonNegativeFinite(stopAtRouteSeconds, "stopAtRouteSeconds");
  assertNonNegativeFinite(idleDurationSeconds, "idleDurationSeconds");

  const movingThreshold = timeToSupplyEmergencyThreshold(
    initialSupplies,
    consumptionProfile,
    "moving",
    remainingFraction,
  );
  if (
    movingThreshold !== null &&
    movingThreshold.atSeconds < stopAtRouteSeconds - TIME_EPSILON_SECONDS
  ) {
    return null;
  }

  const atStop = projectSupplies(
    initialSupplies,
    consumptionProfile,
    "moving",
    stopAtRouteSeconds,
  );
  if (atStop.depleted) return null;

  const foodAtSeconds = timeToAbsoluteRemainingStock(
    initialSupplies.foodUnits,
    atStop.foodRemaining,
    consumptionProfile.idle.foodUnitsPerHour,
    remainingFraction,
  );
  const waterAtSeconds = timeToAbsoluteRemainingStock(
    initialSupplies.waterUnits,
    atStop.waterRemaining,
    consumptionProfile.idle.waterUnitsPerHour,
    remainingFraction,
  );
  if (foodAtSeconds === null && waterAtSeconds === null) return null;

  const idleElapsedSeconds = Math.min(
    foodAtSeconds ?? Number.POSITIVE_INFINITY,
    waterAtSeconds ?? Number.POSITIVE_INFINITY,
  );
  if (idleElapsedSeconds > idleDurationSeconds + TIME_EPSILON_SECONDS) {
    return null;
  }

  const foodMatches =
    foodAtSeconds !== null &&
    Math.abs(foodAtSeconds - idleElapsedSeconds) <= TIME_EPSILON_SECONDS;
  const waterMatches =
    waterAtSeconds !== null &&
    Math.abs(waterAtSeconds - idleElapsedSeconds) <= TIME_EPSILON_SECONDS;
  const duringIdle = projectSupplies(
    {
      foodUnits: atStop.foodRemaining,
      waterUnits: atStop.waterRemaining,
    },
    consumptionProfile,
    "idle",
    idleElapsedSeconds,
  );

  return {
    atSeconds: stopAtRouteSeconds + idleElapsedSeconds,
    routeAtSeconds: stopAtRouteSeconds,
    idleElapsedSeconds,
    cause: foodMatches && waterMatches
      ? "both"
      : foodMatches
        ? "food"
        : "water",
    remainingFraction,
    foodRemaining: duringIdle.foodRemaining,
    waterRemaining: duringIdle.waterRemaining,
  };
}

/**
 * GAME-018 — RETURN cancels only the unelapsed part of discovery STOP and
 * departs from its exact route coordinate. CONTINUE keeps the original wait
 * and route while exposing the same deterministic decision boundary.
 */
export function planEmergencySupplyReturnDuringIdleStop(
  route: RoutePlan,
  initialSupplies: SupplyStock,
  consumptionProfile: ConsumptionProfile,
  doctrine: SupplyEmergencyDoctrine,
  stopAtRouteSeconds: DurationSeconds,
  idleDurationSeconds: DurationSeconds,
  remainingFraction = DEFAULT_EMERGENCY_SUPPLY_FRACTION,
): IdleStopEmergencyReturnPlan {
  assertDoctrine(doctrine);
  assertRouteTime(route, stopAtRouteSeconds, "stopAtRouteSeconds");
  assertNonNegativeFinite(idleDurationSeconds, "idleDurationSeconds");
  const threshold = timeToSupplyEmergencyThresholdDuringIdleStop(
    initialSupplies,
    consumptionProfile,
    stopAtRouteSeconds,
    idleDurationSeconds,
    remainingFraction,
  );

  if (!threshold) {
    return createIdleStopNoReturnPlan(
      route,
      doctrine,
      idleDurationSeconds,
    );
  }

  const trigger = positionAtTime(route, stopAtRouteSeconds);
  if (doctrine === "CONTINUE") {
    return {
      ...createIdleStopNoReturnPlan(route, doctrine, idleDurationSeconds),
      threshold,
      triggersDuringIdleStop: true,
      triggerPosition: trigger.coordinate,
      triggerSegmentIndex: trigger.segmentIndex,
      triggerRouteDistanceMeters: trigger.traveledDistanceMeters,
    };
  }

  const returnPlan = buildTriggeredEmergencyReturnPlan(
    route,
    doctrine,
    threshold,
    stopAtRouteSeconds,
  );
  const effectiveIdleDurationSeconds = threshold.idleElapsedSeconds;

  return {
    doctrine,
    threshold,
    triggersDuringIdleStop: true,
    originalRoute: route,
    effectiveRoute: returnPlan.effectiveRoute,
    scheduledIdleDurationSeconds: idleDurationSeconds,
    effectiveIdleDurationSeconds,
    interruptsIdleStop:
      effectiveIdleDurationSeconds <
      idleDurationSeconds - TIME_EPSILON_SECONDS,
    triggerPosition: returnPlan.triggerPosition,
    triggerSegmentIndex: returnPlan.triggerSegmentIndex,
    triggerRouteDistanceMeters: returnPlan.triggerRouteDistanceMeters,
    returnSegmentIndex: returnPlan.returnSegmentIndex,
    returnBearingDeg: returnPlan.returnBearingDeg,
    returnDistanceMeters: returnPlan.returnDistanceMeters,
    returnToOriginAtRouteSeconds: returnPlan.returnToOriginAtSeconds,
    returnToOriginAtExpeditionSeconds:
      returnPlan.returnToOriginAtSeconds === null
        ? null
        : returnPlan.returnToOriginAtSeconds + effectiveIdleDurationSeconds,
  };
}

/**
 * Builds the first minimal emergency action for uninterrupted movement. The
 * outbound prefix remains authoritative until the exact threshold; RETURN then
 * replaces every future leg with one shortest great-circle leg to the origin.
 */
export function planEmergencySupplyReturn(
  route: RoutePlan,
  initialSupplies: SupplyStock,
  consumptionProfile: ConsumptionProfile,
  doctrine: SupplyEmergencyDoctrine,
  remainingFraction = DEFAULT_EMERGENCY_SUPPLY_FRACTION,
): EmergencyReturnPlan {
  assertDoctrine(doctrine);
  const threshold = timeToSupplyEmergencyThreshold(
    initialSupplies,
    consumptionProfile,
    "moving",
    remainingFraction,
  );
  const triggersBeforeRouteEnd =
    threshold !== null &&
    threshold.atSeconds <
      route.totalDurationSeconds - TIME_EPSILON_SECONDS;

  if (!threshold || !triggersBeforeRouteEnd) {
    return {
      doctrine,
      threshold,
      triggersBeforeRouteEnd,
      originalRoute: route,
      effectiveRoute: route,
      triggerPosition: null,
      triggerSegmentIndex: null,
      triggerRouteDistanceMeters: null,
      returnSegmentIndex: null,
      returnBearingDeg: null,
      returnDistanceMeters: null,
      returnToOriginAtSeconds: null,
    };
  }

  return buildTriggeredEmergencyReturnPlan(
    route,
    doctrine,
    threshold,
    threshold.atSeconds,
  );
}

function buildTriggeredEmergencyReturnPlan(
  route: RoutePlan,
  doctrine: SupplyEmergencyDoctrine,
  threshold: SupplyEmergencyThreshold,
  triggerAtRouteSeconds: DurationSeconds,
): EmergencyReturnPlan {
  const trigger = positionAtTime(route, triggerAtRouteSeconds);
  if (doctrine === "CONTINUE") {
    return {
      doctrine,
      threshold,
      triggersBeforeRouteEnd: true,
      originalRoute: route,
      effectiveRoute: route,
      triggerPosition: trigger.coordinate,
      triggerSegmentIndex: trigger.segmentIndex,
      triggerRouteDistanceMeters: trigger.traveledDistanceMeters,
      returnSegmentIndex: null,
      returnBearingDeg: null,
      returnDistanceMeters: null,
      returnToOriginAtSeconds: null,
    };
  }

  const outboundPrefix = routePrefixCommands(route, triggerAtRouteSeconds);
  const returnDistanceMeters = greatCircleDistance(
    trigger.coordinate,
    route.start,
    route.planetRadiusMeters,
  );
  const returnBearingDeg = returnDistanceMeters <= 1e-7
    ? 0
    : initialBearingDegrees(trigger.coordinate, route.start);
  const commands: RouteCommand[] = [
    ...outboundPrefix,
    { bearingDeg: returnBearingDeg, distanceMeters: returnDistanceMeters },
  ];
  const effectiveRoute = createRoutePlan(
    route.start,
    commands,
    route.speedMetersPerSecond,
    route.planetRadiusMeters,
  );

  return {
    doctrine,
    threshold,
    triggersBeforeRouteEnd: true,
    originalRoute: route,
    effectiveRoute,
    triggerPosition: trigger.coordinate,
    triggerSegmentIndex: trigger.segmentIndex,
    triggerRouteDistanceMeters: trigger.traveledDistanceMeters,
    returnSegmentIndex: commands.length - 1,
    returnBearingDeg,
    returnDistanceMeters,
    returnToOriginAtSeconds: effectiveRoute.totalDurationSeconds,
  };
}

function createIdleStopNoReturnPlan(
  route: RoutePlan,
  doctrine: SupplyEmergencyDoctrine,
  idleDurationSeconds: DurationSeconds,
): IdleStopEmergencyReturnPlan {
  return {
    doctrine,
    threshold: null,
    triggersDuringIdleStop: false,
    originalRoute: route,
    effectiveRoute: route,
    scheduledIdleDurationSeconds: idleDurationSeconds,
    effectiveIdleDurationSeconds: idleDurationSeconds,
    interruptsIdleStop: false,
    triggerPosition: null,
    triggerSegmentIndex: null,
    triggerRouteDistanceMeters: null,
    returnSegmentIndex: null,
    returnBearingDeg: null,
    returnDistanceMeters: null,
    returnToOriginAtRouteSeconds: null,
    returnToOriginAtExpeditionSeconds: null,
  };
}

function routePrefixCommands(
  route: RoutePlan,
  elapsedSeconds: DurationSeconds,
): RouteCommand[] {
  const commands: RouteCommand[] = [];

  for (const segment of route.segments) {
    if (segment.etaEndSeconds <= elapsedSeconds + TIME_EPSILON_SECONDS) {
      commands.push({
        bearingDeg: segment.bearingDeg,
        distanceMeters: segment.distanceMeters,
      });
      continue;
    }

    const secondsInside = Math.max(0, elapsedSeconds - segment.etaStartSeconds);
    const distanceInside = Math.min(
      segment.distanceMeters,
      secondsInside * route.speedMetersPerSecond,
    );
    if (distanceInside > 1e-7) {
      commands.push({
        bearingDeg: segment.bearingDeg,
        distanceMeters: distanceInside,
      });
    }
    break;
  }

  return commands;
}

function thresholdTime(
  stock: number,
  ratePerHour: number,
  remainingFraction: number,
): number | null {
  if (stock === 0) return 0;
  if (ratePerHour === 0) return null;
  return (stock * (1 - remainingFraction) * 3_600) / ratePerHour;
}

function timeToAbsoluteRemainingStock(
  initialStock: number,
  currentStock: number,
  ratePerHour: number,
  remainingFraction: number,
): number | null {
  const targetStock = initialStock * remainingFraction;
  if (currentStock < targetStock - TIME_EPSILON_SECONDS) return null;
  if (Math.abs(currentStock - targetStock) <= TIME_EPSILON_SECONDS) return 0;
  if (ratePerHour === 0) return null;
  return ((currentStock - targetStock) * 3_600) / ratePerHour;
}

function assertRemainingFraction(value: number): void {
  if (!Number.isFinite(value) || value <= 0 || value >= 1) {
    throw new RangeError("remainingFraction must be finite and in (0, 1)");
  }
}

function assertDoctrine(
  doctrine: string,
): asserts doctrine is SupplyEmergencyDoctrine {
  if (doctrine !== "RETURN_TO_ORIGIN" && doctrine !== "CONTINUE") {
    throw new RangeError(
      "doctrine must be RETURN_TO_ORIGIN or CONTINUE",
    );
  }
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
