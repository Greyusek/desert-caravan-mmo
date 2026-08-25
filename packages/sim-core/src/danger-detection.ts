import {
  ENCOUNTER_TIME_TOLERANCE_SECONDS,
  findFirstMovingEncounter,
} from "./encounter.js";
import { findFirstExpeditionMonsterContact } from "./expedition-contact.js";
import { DEFAULT_FLEE_SAFE_SEPARATION_MULTIPLIER } from "./flee.js";
import {
  DEFAULT_INTERACTION_RADIUS_METERS,
  type WanderingMonster,
} from "./monster.js";
import type {
  DurationSeconds,
  RoutePlan,
  SpeedMetersPerSecond,
} from "./route.js";
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
