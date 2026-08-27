import type {
  AsymmetricCaravanDetections,
  CaravanSighting,
} from "./caravan-detection.js";
import { ENCOUNTER_TIME_TOLERANCE_SECONDS } from "./encounter.js";
import { initialBearingDegrees } from "./geometry.js";
import {
  npcCaravanPositionAtWorldTime,
  type NpcCaravan,
} from "./npc-caravan.js";
import {
  createRoutePlan,
  type DurationSeconds,
  type RoutePlan,
} from "./route.js";
import { normalizeBearing, type BearingDegrees } from "./types.js";

export const DEFAULT_CARAVAN_MANEUVER_DURATION_SECONDS = 5 * 60;

export type CaravanManeuverKind = "pursuit" | "evasion";

export interface CaravanManeuverPlan {
  readonly kind: CaravanManeuverKind;
  readonly actorId: string;
  readonly referenceCaravanId: string;
  readonly decisionAtWorldTimeSeconds: DurationSeconds;
  readonly durationSeconds: DurationSeconds;
  readonly bearingDeg: BearingDegrees;
  readonly route: RoutePlan;
  readonly motion: {
    readonly route: RoutePlan;
    readonly startsAtSeconds: DurationSeconds;
    readonly mode: "finite";
  };
}

export interface CaravanPursuitEvasionPlan {
  readonly pursuit: CaravanManeuverPlan | null;
  readonly evasion: CaravanManeuverPlan | null;
}

/**
 * LIVING-004 — the first caravan may pursue only after it sees the second. The
 * second caravan evades only when reciprocal detection exists at that same
 * boundary. A later sighting must be recomputed against the changed motion and
 * cannot reuse the abandoned original path. Each maneuver is a normal finite
 * RoutePlan starting at its authoritative sighting time.
 */
export function planNpcCaravanPursuitEvasion(
  first: NpcCaravan,
  second: NpcCaravan,
  detections: AsymmetricCaravanDetections,
  durationSeconds = DEFAULT_CARAVAN_MANEUVER_DURATION_SECONDS,
): CaravanPursuitEvasionPlan {
  assertDistinctCaravans(first, second);
  assertPositiveFinite(durationSeconds, "durationSeconds");

  const pursuit = detections.firstDetectsSecond
    ? planNpcCaravanManeuver(
        "pursuit",
        first,
        second,
        detections.firstDetectsSecond,
        durationSeconds,
      )
    : null;
  const reciprocalAtPursuitBoundary =
    pursuit &&
    detections.secondDetectsFirst &&
    Math.abs(
      detections.secondDetectsFirst.atWorldTimeSeconds -
        pursuit.decisionAtWorldTimeSeconds,
    ) <= ENCOUNTER_TIME_TOLERANCE_SECONDS;
  const evasion =
    reciprocalAtPursuitBoundary && detections.secondDetectsFirst
      ? planNpcCaravanManeuver(
          "evasion",
          second,
          first,
          detections.secondDetectsFirst,
          durationSeconds,
        )
      : null;

  return { pursuit, evasion };
}

export function planNpcCaravanManeuver(
  kind: CaravanManeuverKind,
  actor: NpcCaravan,
  reference: NpcCaravan,
  sighting: CaravanSighting,
  durationSeconds = DEFAULT_CARAVAN_MANEUVER_DURATION_SECONDS,
): CaravanManeuverPlan {
  assertManeuverKind(kind);
  assertDistinctCaravans(actor, reference);
  assertPositiveFinite(durationSeconds, "durationSeconds");
  if (
    sighting.observerId !== actor.id ||
    sighting.targetId !== reference.id
  ) {
    throw new RangeError(
      "sighting identities must match actor and reference caravans",
    );
  }
  assertNonNegativeFinite(
    sighting.atWorldTimeSeconds,
    "sighting.atWorldTimeSeconds",
  );

  const actorPosition = npcCaravanPositionAtWorldTime(
    actor,
    sighting.atWorldTimeSeconds,
  );
  const referencePosition = npcCaravanPositionAtWorldTime(
    reference,
    sighting.atWorldTimeSeconds,
  );
  const towardReference = initialBearingDegrees(
    actorPosition.coordinate,
    referencePosition.coordinate,
  );
  const bearingDeg =
    kind === "pursuit"
      ? towardReference
      : normalizeBearing(towardReference + 180);
  const route = createRoutePlan(
    actorPosition.coordinate,
    [
      {
        bearingDeg,
        distanceMeters: actor.route.speedMetersPerSecond * durationSeconds,
      },
    ],
    actor.route.speedMetersPerSecond,
    actor.route.planetRadiusMeters,
  );

  return {
    kind,
    actorId: actor.id,
    referenceCaravanId: reference.id,
    decisionAtWorldTimeSeconds: sighting.atWorldTimeSeconds,
    durationSeconds,
    bearingDeg,
    route,
    motion: {
      route,
      startsAtSeconds: sighting.atWorldTimeSeconds,
      mode: "finite",
    },
  };
}

function assertManeuverKind(value: string): asserts value is CaravanManeuverKind {
  if (value !== "pursuit" && value !== "evasion") {
    throw new RangeError("kind must be pursuit or evasion");
  }
}

function assertDistinctCaravans(first: NpcCaravan, second: NpcCaravan): void {
  if (first.id.length === 0 || second.id.length === 0) {
    throw new RangeError("caravan ids must not be empty");
  }
  if (first.id === second.id) {
    throw new RangeError("caravans must have unique ids");
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
