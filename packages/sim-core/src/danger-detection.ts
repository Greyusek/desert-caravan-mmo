import {
  ENCOUNTER_TIME_TOLERANCE_SECONDS,
  findFirstMovingEncounter,
} from "./encounter.js";
import {
  findFirstExpeditionMonsterContact,
  findFirstExpeditionMonsterContactWithIdleStop,
} from "./expedition-contact.js";
import { DEFAULT_FLEE_SAFE_SEPARATION_MULTIPLIER } from "./flee.js";
import {
  DEFAULT_INTERACTION_RADIUS_METERS,
  type WanderingMonster,
} from "./monster.js";
import {
  createRoutePlan,
  positionAtTime,
  type DurationSeconds,
  type RoutePlan,
  type SpeedMetersPerSecond,
} from "./route.js";
import type { CaravanActivity } from "./supplies.js";
import type { DistanceMeters, WorldCoordinate } from "./types.js";

/**
 * GAME-019 uses the already established GAME-006 safe separation as the first
 * technical warning boundary. Optical visibility and concealed detection stay
 * separate sensor-layer concerns; this radius exists only to make a future
 * AVOID decision authoritatively earlier than the current contact boundary.
 */
export const DEFAULT_DANGER_DETECTION_RADIUS_METERS =
  DEFAULT_INTERACTION_RADIUS_METERS *
  DEFAULT_FLEE_SAFE_SEPARATION_MULTIPLIER;

export type DangerContactOrder =
  | "before-contact"
  | "at-contact"
  | "no-contact";

export interface ExpeditionMonsterDangerDetection {
  readonly monsterId: string;
  readonly monsterPower: number;
  readonly monsterSpeedMetersPerSecond: SpeedMetersPerSecond;
  readonly atSeconds: DurationSeconds;
  /** World/expedition time since departure. */
  readonly expeditionElapsedSeconds: DurationSeconds;
  /** SIM-005 time on the uninterrupted expedition route. */
  readonly routeElapsedSeconds: DurationSeconds;
  readonly monsterPatrolElapsedSeconds: DurationSeconds;
  /** Whether the warning was raised while moving or waiting at STOP. */
  readonly caravanActivity: CaravanActivity;
  readonly separationMeters: DistanceMeters;
  readonly detectionRadiusMeters: DistanceMeters;
  readonly interactionRadiusMeters: DistanceMeters;
  readonly caravanPosition: WorldCoordinate;
  readonly monsterPosition: WorldCoordinate;
  readonly contactOrder: DangerContactOrder;
  readonly plannedContactAtSeconds: DurationSeconds | null;
  readonly secondsUntilContact: DurationSeconds | null;
}

/**
 * GAME-019 — returns the first server-truth entry into the technical danger
 * warning radius for an uninterrupted moving expedition. The warning radius
 * must be strictly larger than this monster's contact radius, so a normal
 * approach always exposes a decision boundary before contact. If the
 * expedition begins already inside contact, both boundaries occur at T=0 and
 * `at-contact` records that contact has priority.
 */
export function findFirstExpeditionMonsterDangerDetection(
  expeditionRoute: RoutePlan,
  monster: WanderingMonster,
  expeditionStartsAtSeconds: DurationSeconds = 0,
  detectionRadiusMeters: DistanceMeters =
    DEFAULT_DANGER_DETECTION_RADIUS_METERS,
): ExpeditionMonsterDangerDetection | null {
  assertNonNegativeFinite(
    expeditionStartsAtSeconds,
    "expeditionStartsAtSeconds",
  );
  assertPositiveFinite(detectionRadiusMeters, "detectionRadiusMeters");
  assertNonNegativeFinite(
    monster.interactionRadiusMeters,
    "monster.interactionRadiusMeters",
  );
  if (detectionRadiusMeters <= monster.interactionRadiusMeters) {
    throw new RangeError(
      "detectionRadiusMeters must be greater than monster.interactionRadiusMeters",
    );
  }

  const detection = findFirstMovingEncounter(
    {
      route: expeditionRoute,
      startsAtSeconds: expeditionStartsAtSeconds,
      mode: "finite",
    },
    {
      route: monster.patrolRoute,
      startsAtSeconds: 0,
      mode: "cyclic",
    },
    {
      startSeconds: expeditionStartsAtSeconds,
      endSeconds:
        expeditionStartsAtSeconds + expeditionRoute.totalDurationSeconds,
    },
    detectionRadiusMeters,
  );

  if (!detection) return null;

  const contact = findFirstExpeditionMonsterContact(
    expeditionRoute,
    monster,
    expeditionStartsAtSeconds,
  );
  const secondsUntilContact = contact
    ? contact.atSeconds - detection.atSeconds
    : null;
  if (
    secondsUntilContact !== null &&
    secondsUntilContact < -ENCOUNTER_TIME_TOLERANCE_SECONDS
  ) {
    throw new Error("danger detection must not occur after monster contact");
  }
  const contactOrder: DangerContactOrder = contact === null
    ? "no-contact"
    : Math.abs(secondsUntilContact ?? 0) <=
        ENCOUNTER_TIME_TOLERANCE_SECONDS
      ? "at-contact"
      : "before-contact";

  return {
    monsterId: monster.id,
    monsterPower: monster.power,
    monsterSpeedMetersPerSecond: monster.patrolRoute.speedMetersPerSecond,
    atSeconds: detection.atSeconds,
    expeditionElapsedSeconds: detection.firstRouteElapsedSeconds,
    routeElapsedSeconds: detection.firstRouteElapsedSeconds,
    monsterPatrolElapsedSeconds: detection.secondRouteElapsedSeconds,
    caravanActivity: "moving",
    separationMeters: detection.separationMeters,
    detectionRadiusMeters,
    interactionRadiusMeters: monster.interactionRadiusMeters,
    caravanPosition: detection.firstPosition,
    monsterPosition: detection.secondPosition,
    contactOrder,
    plannedContactAtSeconds: contact?.atSeconds ?? null,
    secondsUntilContact:
      secondsUntilContact === null ? null : Math.max(0, secondsUntilContact),
  };
}

/**
 * GAME-021 — returns the first warning whose authoritative entry happens
 * strictly inside one scheduled discovery STOP. A warning already raised
 * before STOP is not emitted a second time, while an entry exactly at STOP
 * belongs to the idle phase. The exact resume instant belongs to moving
 * execution and is therefore outside this slice.
 */
export function findFirstExpeditionMonsterDangerDetectionDuringIdleStop(
  expeditionRoute: RoutePlan,
  monster: WanderingMonster,
  stopAtRouteSeconds: DurationSeconds,
  idleDurationSeconds: DurationSeconds,
  expeditionStartsAtSeconds: DurationSeconds = 0,
  detectionRadiusMeters: DistanceMeters =
    DEFAULT_DANGER_DETECTION_RADIUS_METERS,
): ExpeditionMonsterDangerDetection | null {
  assertRouteTime(
    expeditionRoute,
    stopAtRouteSeconds,
    "stopAtRouteSeconds",
  );
  assertNonNegativeFinite(idleDurationSeconds, "idleDurationSeconds");
  assertNonNegativeFinite(
    expeditionStartsAtSeconds,
    "expeditionStartsAtSeconds",
  );
  assertPositiveFinite(detectionRadiusMeters, "detectionRadiusMeters");
  assertNonNegativeFinite(
    monster.interactionRadiusMeters,
    "monster.interactionRadiusMeters",
  );
  if (detectionRadiusMeters <= monster.interactionRadiusMeters) {
    throw new RangeError(
      "detectionRadiusMeters must be greater than monster.interactionRadiusMeters",
    );
  }
  if (idleDurationSeconds <= ENCOUNTER_TIME_TOLERANCE_SECONDS) {
    return null;
  }

  const stopAtWorldSeconds =
    expeditionStartsAtSeconds + stopAtRouteSeconds;
  const resumeAtWorldSeconds = stopAtWorldSeconds + idleDurationSeconds;
  const firstBeforeOrAtStop = findFirstMovingEncounter(
    {
      route: expeditionRoute,
      startsAtSeconds: expeditionStartsAtSeconds,
      mode: "finite",
    },
    {
      route: monster.patrolRoute,
      startsAtSeconds: 0,
      mode: "cyclic",
    },
    {
      startSeconds: expeditionStartsAtSeconds,
      endSeconds: stopAtWorldSeconds,
    },
    detectionRadiusMeters,
  );
  if (
    firstBeforeOrAtStop &&
    firstBeforeOrAtStop.atSeconds <
      stopAtWorldSeconds - ENCOUNTER_TIME_TOLERANCE_SECONDS
  ) {
    return null;
  }

  const stopPosition = positionAtTime(
    expeditionRoute,
    stopAtRouteSeconds,
  ).coordinate;
  const stationaryRoute = createRoutePlan(
    stopPosition,
    [{ bearingDeg: 0, distanceMeters: 0 }],
    expeditionRoute.speedMetersPerSecond,
    expeditionRoute.planetRadiusMeters,
  );
  const warning = findFirstMovingEncounter(
    {
      route: stationaryRoute,
      startsAtSeconds: stopAtWorldSeconds,
      mode: "stationary",
    },
    {
      route: monster.patrolRoute,
      startsAtSeconds: 0,
      mode: "cyclic",
    },
    {
      startSeconds: stopAtWorldSeconds,
      endSeconds: resumeAtWorldSeconds,
    },
    detectionRadiusMeters,
  );
  if (
    !warning ||
    warning.atSeconds >=
      resumeAtWorldSeconds - ENCOUNTER_TIME_TOLERANCE_SECONDS
  ) {
    return null;
  }

  const contact = findFirstExpeditionMonsterContactWithIdleStop(
    expeditionRoute,
    monster,
    stopAtRouteSeconds,
    idleDurationSeconds,
    expeditionStartsAtSeconds,
  );
  const secondsUntilContact = contact
    ? contact.atSeconds - warning.atSeconds
    : null;
  if (
    secondsUntilContact !== null &&
    secondsUntilContact < -ENCOUNTER_TIME_TOLERANCE_SECONDS
  ) {
    throw new Error("danger detection must not occur after monster contact");
  }
  const contactOrder: DangerContactOrder = contact === null
    ? "no-contact"
    : Math.abs(secondsUntilContact ?? 0) <=
        ENCOUNTER_TIME_TOLERANCE_SECONDS
      ? "at-contact"
      : "before-contact";

  return {
    monsterId: monster.id,
    monsterPower: monster.power,
    monsterSpeedMetersPerSecond: monster.patrolRoute.speedMetersPerSecond,
    atSeconds: warning.atSeconds,
    expeditionElapsedSeconds:
      warning.atSeconds - expeditionStartsAtSeconds,
    routeElapsedSeconds: stopAtRouteSeconds,
    monsterPatrolElapsedSeconds: warning.secondRouteElapsedSeconds,
    caravanActivity: "idle",
    separationMeters: warning.separationMeters,
    detectionRadiusMeters,
    interactionRadiusMeters: monster.interactionRadiusMeters,
    caravanPosition: warning.firstPosition,
    monsterPosition: warning.secondPosition,
    contactOrder,
    plannedContactAtSeconds: contact?.atSeconds ?? null,
    secondsUntilContact:
      secondsUntilContact === null ? null : Math.max(0, secondsUntilContact),
  };
}

function assertRouteTime(
  route: RoutePlan,
  value: number,
  name: string,
): void {
  assertNonNegativeFinite(value, name);
  if (value > route.totalDurationSeconds + 1e-9) {
    throw new RangeError(`${name} must not exceed route total duration`);
  }
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
