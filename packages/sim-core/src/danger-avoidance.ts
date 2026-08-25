import {
  type ExpeditionMonsterDangerDetection,
  DEFAULT_DANGER_DETECTION_RADIUS_METERS,
  findFirstExpeditionMonsterDangerDetection,
} from "./danger-detection.js";
import {
  findFirstExpeditionMonsterContact,
  type ExpeditionMonsterContact,
} from "./expedition-contact.js";
import {
  destinationPoint,
  greatCircleDistance,
  initialBearingDegrees,
} from "./geometry.js";
import type { WanderingMonster } from "./monster.js";
import {
  createRoutePlan,
  positionAtTime,
  type DurationSeconds,
  type RouteCommand,
  type RoutePlan,
} from "./route.js";
import { normalizeBearing, type WorldCoordinate } from "./types.js";

export type DangerAvoidanceDoctrine = "AVOID" | "CONTINUE";
export type DangerAvoidanceSide = "left" | "right";
export type DangerAvoidanceStatus =
  | "not-triggered"
  | "blocked-by-contact"
  | "continued"
  | "avoided"
  | "detour-unavailable";

/**
 * The first ring is deliberately wider than the 1000 m warning boundary.
 * Later Fibonacci-like rings provide deterministic fallbacks when patrol
 * motion makes the nearest left/right waypoint unsafe.
 */
export const DEFAULT_DANGER_AVOIDANCE_RADIUS_MULTIPLIERS = Object.freeze([
  2,
  3,
  5,
  8,
  13,
]);

export interface ExpeditionMonsterDangerResponsePlan {
  readonly doctrine: DangerAvoidanceDoctrine;
  readonly status: DangerAvoidanceStatus;
  readonly detection: ExpeditionMonsterDangerDetection | null;
  readonly originalRoute: RoutePlan;
  readonly effectiveRoute: RoutePlan;
  readonly routeChanged: boolean;
  readonly originalContact: ExpeditionMonsterContact | null;
  readonly effectiveContact: ExpeditionMonsterContact | null;
  readonly decisionAtSeconds: DurationSeconds | null;
  readonly decisionRouteElapsedSeconds: DurationSeconds | null;
  readonly decisionPosition: WorldCoordinate | null;
  readonly decisionSegmentIndex: number | null;
  readonly decisionRouteDistanceMeters: number | null;
  readonly detourWaypoint: WorldCoordinate | null;
  readonly detourSide: DangerAvoidanceSide | null;
  readonly detourWaypointRadiusMeters: number | null;
  readonly detourSegmentIndexes: readonly [number, number] | null;
  readonly detourDistanceMeters: number | null;
  readonly addedDistanceMeters: number | null;
  readonly rejoinPosition: WorldCoordinate | null;
  readonly rejoinOriginalSegmentIndex: number | null;
}

interface SafeDetourCandidate {
  readonly route: RoutePlan;
  readonly waypoint: WorldCoordinate;
  readonly side: DangerAvoidanceSide;
  readonly waypointRadiusMeters: number;
  readonly segmentIndexes: readonly [number, number];
  readonly detourDistanceMeters: number;
  readonly rejoinPosition: WorldCoordinate;
  readonly rejoinOriginalSegmentIndex: number;
}

const TIME_EPSILON_SECONDS = 1e-9;
const DISTANCE_EPSILON_METERS = 1e-7;
const SIDE_OFFSETS_DEGREES: ReadonlyArray<
  readonly [DangerAvoidanceSide, number]
> = Object.freeze([
  ["left", -90],
  ["right", 90],
]);

/**
 * GAME-020 — executes the first `AVOID | CONTINUE` decision for one moving
 * patrol on an uninterrupted expedition route.
 *
 * `CONTINUE` returns the original RoutePlan object unchanged. `AVOID` keeps
 * every fully executed command plus the exact partial command to the warning
 * coordinate, inserts one deterministic waypoint, rejoins the end of the
 * interrupted original segment and then keeps the untouched command suffix.
 * A candidate is accepted only when the continuous moving-contact solver
 * proves the complete resolved route never enters this patrol's 500 m radius.
 */
export function planExpeditionMonsterDangerResponse(
  expeditionRoute: RoutePlan,
  monster: WanderingMonster,
  doctrine: DangerAvoidanceDoctrine,
  expeditionStartsAtSeconds: DurationSeconds = 0,
  detectionRadiusMeters = DEFAULT_DANGER_DETECTION_RADIUS_METERS,
): ExpeditionMonsterDangerResponsePlan {
  assertDoctrine(doctrine);
  const detection = findFirstExpeditionMonsterDangerDetection(
    expeditionRoute,
    monster,
    expeditionStartsAtSeconds,
    detectionRadiusMeters,
  );
  if (!detection) {
    return unchangedPlan(
      expeditionRoute,
      doctrine,
      "not-triggered",
      null,
      null,
    );
  }

  const originalContact = findFirstExpeditionMonsterContact(
    expeditionRoute,
    monster,
    expeditionStartsAtSeconds,
  );
  if (detection.contactOrder === "at-contact") {
    return unchangedPlan(
      expeditionRoute,
      doctrine,
      "blocked-by-contact",
      detection,
      originalContact,
    );
  }

  if (doctrine === "CONTINUE") {
    return unchangedPlan(
      expeditionRoute,
      doctrine,
      "continued",
      detection,
      originalContact,
    );
  }

  const decision = positionAtTime(
    expeditionRoute,
    detection.routeElapsedSeconds,
  );
  if (decision.segmentIndex === null) {
    return unchangedPlan(
      expeditionRoute,
      doctrine,
      "detour-unavailable",
      detection,
      originalContact,
    );
  }

  const candidate = findSafeDetourCandidate(
    expeditionRoute,
    monster,
    detection,
    expeditionStartsAtSeconds,
    decision.segmentIndex,
  );
  if (!candidate) {
    return unchangedPlan(
      expeditionRoute,
      doctrine,
      "detour-unavailable",
      detection,
      originalContact,
    );
  }

  return {
    doctrine,
    status: "avoided",
    detection,
    originalRoute: expeditionRoute,
    effectiveRoute: candidate.route,
    routeChanged: true,
    originalContact,
    effectiveContact: null,
    decisionAtSeconds: detection.atSeconds,
    decisionRouteElapsedSeconds: detection.routeElapsedSeconds,
    decisionPosition: detection.caravanPosition,
    decisionSegmentIndex: decision.segmentIndex,
    decisionRouteDistanceMeters: decision.traveledDistanceMeters,
    detourWaypoint: candidate.waypoint,
    detourSide: candidate.side,
    detourWaypointRadiusMeters: candidate.waypointRadiusMeters,
    detourSegmentIndexes: candidate.segmentIndexes,
    detourDistanceMeters: candidate.detourDistanceMeters,
    addedDistanceMeters:
      candidate.route.totalDistanceMeters -
      expeditionRoute.totalDistanceMeters,
    rejoinPosition: candidate.rejoinPosition,
    rejoinOriginalSegmentIndex: candidate.rejoinOriginalSegmentIndex,
  };
}

function findSafeDetourCandidate(
  route: RoutePlan,
  monster: WanderingMonster,
  detection: ExpeditionMonsterDangerDetection,
  expeditionStartsAtSeconds: DurationSeconds,
  decisionSegmentIndex: number,
): SafeDetourCandidate | null {
  const interruptedSegment = route.segments[decisionSegmentIndex];
  if (!interruptedSegment) return null;

  const prefix = routePrefixCommands(route, detection.routeElapsedSeconds);
  const suffix = route.segments.slice(decisionSegmentIndex + 1).map(
    (segment): RouteCommand => ({
      bearingDeg: segment.bearingDeg,
      distanceMeters: segment.distanceMeters,
    }),
  );
  const radialBearing = initialBearingDegrees(
    detection.monsterPosition,
    detection.caravanPosition,
  );

  for (const multiplier of DEFAULT_DANGER_AVOIDANCE_RADIUS_MULTIPLIERS) {
    const waypointRadiusMeters =
      detection.detectionRadiusMeters * multiplier;
    const safeAtThisRadius: SafeDetourCandidate[] = [];

    for (const [side, bearingOffset] of SIDE_OFFSETS_DEGREES) {
      const waypoint = destinationPoint(
        detection.monsterPosition,
        normalizeBearing(radialBearing + bearingOffset),
        waypointRadiusMeters,
        route.planetRadiusMeters,
      );
      const firstDetourDistance = greatCircleDistance(
        detection.caravanPosition,
        waypoint,
        route.planetRadiusMeters,
      );
      const rejoinDistance = greatCircleDistance(
        waypoint,
        interruptedSegment.end,
        route.planetRadiusMeters,
      );
      const commands: RouteCommand[] = [
        ...prefix,
        {
          bearingDeg: bearingForLeg(
            detection.caravanPosition,
            waypoint,
            firstDetourDistance,
          ),
          distanceMeters: firstDetourDistance,
        },
        {
          bearingDeg: bearingForLeg(
            waypoint,
            interruptedSegment.end,
            rejoinDistance,
          ),
          distanceMeters: rejoinDistance,
        },
        ...suffix,
      ];
      const candidateRoute = createRoutePlan(
        route.start,
        commands,
        route.speedMetersPerSecond,
        route.planetRadiusMeters,
      );
      const contact = findFirstExpeditionMonsterContact(
        candidateRoute,
        monster,
        expeditionStartsAtSeconds,
      );
      if (contact) continue;

      safeAtThisRadius.push({
        route: candidateRoute,
        waypoint,
        side,
        waypointRadiusMeters,
        segmentIndexes: [prefix.length, prefix.length + 1],
        detourDistanceMeters: firstDetourDistance + rejoinDistance,
        rejoinPosition: interruptedSegment.end,
        rejoinOriginalSegmentIndex: decisionSegmentIndex,
      });
    }

    safeAtThisRadius.sort(
      (left, right) =>
        left.route.totalDistanceMeters - right.route.totalDistanceMeters ||
        sideOrder(left.side) - sideOrder(right.side),
    );
    const selected = safeAtThisRadius[0];
    if (selected) return selected;
  }

  return null;
}

function unchangedPlan(
  route: RoutePlan,
  doctrine: DangerAvoidanceDoctrine,
  status: Exclude<DangerAvoidanceStatus, "avoided">,
  detection: ExpeditionMonsterDangerDetection | null,
  contact: ExpeditionMonsterContact | null,
): ExpeditionMonsterDangerResponsePlan {
  const decision = detection
    ? positionAtTime(route, detection.routeElapsedSeconds)
    : null;
  return {
    doctrine,
    status,
    detection,
    originalRoute: route,
    effectiveRoute: route,
    routeChanged: false,
    originalContact: contact,
    effectiveContact: contact,
    decisionAtSeconds: detection?.atSeconds ?? null,
    decisionRouteElapsedSeconds: detection?.routeElapsedSeconds ?? null,
    decisionPosition: detection?.caravanPosition ?? null,
    decisionSegmentIndex: decision?.segmentIndex ?? null,
    decisionRouteDistanceMeters: decision?.traveledDistanceMeters ?? null,
    detourWaypoint: null,
    detourSide: null,
    detourWaypointRadiusMeters: null,
    detourSegmentIndexes: null,
    detourDistanceMeters: null,
    addedDistanceMeters: null,
    rejoinPosition: null,
    rejoinOriginalSegmentIndex: null,
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
    if (distanceInside > DISTANCE_EPSILON_METERS) {
      commands.push({
        bearingDeg: segment.bearingDeg,
        distanceMeters: distanceInside,
      });
    }
    break;
  }

  return commands;
}

function bearingForLeg(
  start: WorldCoordinate,
  end: WorldCoordinate,
  distanceMeters: number,
): number {
  return distanceMeters <= DISTANCE_EPSILON_METERS
    ? 0
    : initialBearingDegrees(start, end);
}

function sideOrder(side: DangerAvoidanceSide): number {
  return side === "left" ? 0 : 1;
}

function assertDoctrine(
  doctrine: string,
): asserts doctrine is DangerAvoidanceDoctrine {
  if (doctrine !== "AVOID" && doctrine !== "CONTINUE") {
    throw new RangeError("doctrine must be AVOID or CONTINUE");
  }
}
