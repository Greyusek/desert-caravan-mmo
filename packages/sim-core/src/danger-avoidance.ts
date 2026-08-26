import {
  type ExpeditionMonsterDangerDetection,
  DEFAULT_DANGER_DETECTION_RADIUS_METERS,
  findFirstExpeditionMonsterDangerDetection,
  findFirstExpeditionMonsterDangerDetectionAmongPatrols,
  findFirstExpeditionMonsterDangerDetectionDuringIdleStop,
  findFirstExpeditionMonsterDangerDetectionDuringIdleStopAmongPatrols,
} from "./danger-detection.js";
import { ENCOUNTER_TIME_TOLERANCE_SECONDS } from "./encounter.js";
import {
  findFirstExpeditionMonsterContact,
  findFirstExpeditionMonsterContactAmongPatrols,
  findFirstExpeditionMonsterContactWithIdleStop,
  findFirstExpeditionMonsterContactWithIdleStopAmongPatrols,
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
  | "blocked-by-earlier-boundary"
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

export interface IdleStopExpeditionMonsterDangerResponsePlan
  extends ExpeditionMonsterDangerResponsePlan {
  readonly triggersDuringIdleStop: boolean;
  readonly scheduledIdleDurationSeconds: DurationSeconds;
  readonly effectiveIdleDurationSeconds: DurationSeconds;
  readonly interruptsIdleStop: boolean;
  /** Earlier non-warning expedition boundary supplied by the composer. */
  readonly blockingExpeditionAtSeconds: DurationSeconds | null;
  /** World time including elapsed idle time. */
  readonly completionAtExpeditionSeconds: DurationSeconds | null;
}

export interface MultiPatrolExpeditionMonsterDangerResponsePlan
  extends ExpeditionMonsterDangerResponsePlan {
  readonly patrolCount: number;
  /** Stable identity order for the patrols included in every clearance check. */
  readonly clearanceMonsterIds: readonly string[];
}

export interface MultiPatrolIdleStopExpeditionMonsterDangerResponsePlan
  extends IdleStopExpeditionMonsterDangerResponsePlan {
  readonly patrolCount: number;
  /** Stable identity order for the patrols included in every clearance check. */
  readonly clearanceMonsterIds: readonly string[];
}

interface SafeDetourCandidate {
  readonly route: RoutePlan;
  readonly continuationRoute: RoutePlan;
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
    detection,
    decision.segmentIndex,
    (candidateRoute) =>
      findFirstExpeditionMonsterContact(
        candidateRoute,
        monster,
        expeditionStartsAtSeconds,
      ) !== null,
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

/**
 * GAME-023 — executes the moving danger doctrine for the first authoritative
 * warning across several patrols. The trigger keeps GAME-022 time/identity
 * ordering. CONTINUE preserves the original route, while AVOID accepts a
 * candidate only if the continuous contact solver proves the complete timed
 * route clear of every patrol in the set.
 */
export function planExpeditionMonsterDangerResponseAmongPatrols(
  expeditionRoute: RoutePlan,
  monsters: readonly WanderingMonster[],
  doctrine: DangerAvoidanceDoctrine,
  expeditionStartsAtSeconds: DurationSeconds = 0,
  detectionRadiusMeters = DEFAULT_DANGER_DETECTION_RADIUS_METERS,
): MultiPatrolExpeditionMonsterDangerResponsePlan {
  assertDoctrine(doctrine);
  const clearanceMonsterIds = monsters
    .map((monster) => monster.id)
    .sort(compareMonsterIds);
  const detection = findFirstExpeditionMonsterDangerDetectionAmongPatrols(
    expeditionRoute,
    monsters,
    expeditionStartsAtSeconds,
    detectionRadiusMeters,
  );
  if (!detection) {
    return multiPatrolPlan(
      unchangedPlan(
        expeditionRoute,
        doctrine,
        "not-triggered",
        null,
        null,
      ),
      clearanceMonsterIds,
    );
  }

  const originalContact = findFirstExpeditionMonsterContactAmongPatrols(
    expeditionRoute,
    monsters,
    expeditionStartsAtSeconds,
  );
  if (
    originalContact &&
    originalContact.atSeconds <=
      detection.atSeconds + ENCOUNTER_TIME_TOLERANCE_SECONDS
  ) {
    return multiPatrolPlan(
      unchangedPlan(
        expeditionRoute,
        doctrine,
        "blocked-by-contact",
        detection,
        originalContact,
      ),
      clearanceMonsterIds,
    );
  }

  if (doctrine === "CONTINUE") {
    return multiPatrolPlan(
      unchangedPlan(
        expeditionRoute,
        doctrine,
        "continued",
        detection,
        originalContact,
      ),
      clearanceMonsterIds,
    );
  }

  const decision = positionAtTime(
    expeditionRoute,
    detection.routeElapsedSeconds,
  );
  if (decision.segmentIndex === null) {
    return multiPatrolPlan(
      unchangedPlan(
        expeditionRoute,
        doctrine,
        "detour-unavailable",
        detection,
        originalContact,
      ),
      clearanceMonsterIds,
    );
  }

  const candidate = findSafeDetourCandidate(
    expeditionRoute,
    detection,
    decision.segmentIndex,
    (candidateRoute) =>
      monsters.some((monster) =>
        findFirstExpeditionMonsterContact(
          candidateRoute,
          monster,
          expeditionStartsAtSeconds,
        ) !== null
      ),
  );
  if (!candidate) {
    return multiPatrolPlan(
      unchangedPlan(
        expeditionRoute,
        doctrine,
        "detour-unavailable",
        detection,
        originalContact,
      ),
      clearanceMonsterIds,
    );
  }

  return multiPatrolPlan(
    {
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
    },
    clearanceMonsterIds,
  );
}

/**
 * GAME-021 — executes the same danger doctrine when the first 1000 m warning
 * is raised while the caravan is stationary at a scheduled discovery STOP.
 * CONTINUE preserves both the original route object and full idle duration.
 * AVOID keeps the exact route prefix to STOP, cancels only the unelapsed wait,
 * departs from that coordinate, and validates the post-decision route against
 * the patrol at its real world time. A contact or caller-supplied boundary at
 * the same or an earlier expedition instant keeps priority.
 */
export function planExpeditionMonsterDangerResponseDuringIdleStop(
  expeditionRoute: RoutePlan,
  monster: WanderingMonster,
  doctrine: DangerAvoidanceDoctrine,
  stopAtRouteSeconds: DurationSeconds,
  idleDurationSeconds: DurationSeconds,
  expeditionStartsAtSeconds: DurationSeconds = 0,
  detectionRadiusMeters = DEFAULT_DANGER_DETECTION_RADIUS_METERS,
  blockingExpeditionAtSeconds: DurationSeconds | null = null,
): IdleStopExpeditionMonsterDangerResponsePlan {
  assertDoctrine(doctrine);
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
  if (blockingExpeditionAtSeconds !== null) {
    assertNonNegativeFinite(
      blockingExpeditionAtSeconds,
      "blockingExpeditionAtSeconds",
    );
  }

  const detection =
    findFirstExpeditionMonsterDangerDetectionDuringIdleStop(
      expeditionRoute,
      monster,
      stopAtRouteSeconds,
      idleDurationSeconds,
      expeditionStartsAtSeconds,
      detectionRadiusMeters,
    );
  const originalContact = findFirstExpeditionMonsterContactWithIdleStop(
    expeditionRoute,
    monster,
    stopAtRouteSeconds,
    idleDurationSeconds,
    expeditionStartsAtSeconds,
  );
  if (!detection) {
    return unchangedIdleStopPlan(
      expeditionRoute,
      doctrine,
      "not-triggered",
      null,
      originalContact,
      idleDurationSeconds,
      blockingExpeditionAtSeconds,
    );
  }

  if (
    originalContact &&
    originalContact.expeditionElapsedSeconds <=
      detection.expeditionElapsedSeconds +
        ENCOUNTER_TIME_TOLERANCE_SECONDS
  ) {
    return unchangedIdleStopPlan(
      expeditionRoute,
      doctrine,
      "blocked-by-contact",
      detection,
      originalContact,
      idleDurationSeconds,
      blockingExpeditionAtSeconds,
    );
  }

  if (
    blockingExpeditionAtSeconds !== null &&
    blockingExpeditionAtSeconds <=
      detection.expeditionElapsedSeconds + TIME_EPSILON_SECONDS
  ) {
    return unchangedIdleStopPlan(
      expeditionRoute,
      doctrine,
      "blocked-by-earlier-boundary",
      detection,
      originalContact,
      idleDurationSeconds,
      blockingExpeditionAtSeconds,
    );
  }

  if (doctrine === "CONTINUE") {
    return unchangedIdleStopPlan(
      expeditionRoute,
      doctrine,
      "continued",
      detection,
      originalContact,
      idleDurationSeconds,
      blockingExpeditionAtSeconds,
    );
  }

  const decision = positionAtTime(expeditionRoute, stopAtRouteSeconds);
  if (decision.segmentIndex === null) {
    return unchangedIdleStopPlan(
      expeditionRoute,
      doctrine,
      "detour-unavailable",
      detection,
      originalContact,
      idleDurationSeconds,
      blockingExpeditionAtSeconds,
    );
  }

  const candidate = findSafeDetourCandidate(
    expeditionRoute,
    detection,
    decision.segmentIndex,
    (_candidateRoute, continuationRoute) =>
      findFirstExpeditionMonsterContact(
        continuationRoute,
        monster,
        detection.atSeconds,
      ) !== null,
  );
  if (!candidate) {
    return unchangedIdleStopPlan(
      expeditionRoute,
      doctrine,
      "detour-unavailable",
      detection,
      originalContact,
      idleDurationSeconds,
      blockingExpeditionAtSeconds,
    );
  }

  const effectiveIdleDurationSeconds = Math.max(
    0,
    detection.expeditionElapsedSeconds - stopAtRouteSeconds,
  );
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
    triggersDuringIdleStop: true,
    scheduledIdleDurationSeconds: idleDurationSeconds,
    effectiveIdleDurationSeconds,
    interruptsIdleStop:
      effectiveIdleDurationSeconds <
      idleDurationSeconds - TIME_EPSILON_SECONDS,
    blockingExpeditionAtSeconds,
    completionAtExpeditionSeconds:
      candidate.route.totalDurationSeconds + effectiveIdleDurationSeconds,
  };
}

/**
 * GAME-024 — executes the first aggregate patrol warning raised during one
 * scheduled discovery STOP. CONTINUE preserves the complete wait and stable
 * first contact. AVOID cancels only the unelapsed wait and accepts a departure
 * route only when every patrol remains continuously outside contact range.
 */
export function planExpeditionMonsterDangerResponseDuringIdleStopAmongPatrols(
  expeditionRoute: RoutePlan,
  monsters: readonly WanderingMonster[],
  doctrine: DangerAvoidanceDoctrine,
  stopAtRouteSeconds: DurationSeconds,
  idleDurationSeconds: DurationSeconds,
  expeditionStartsAtSeconds: DurationSeconds = 0,
  detectionRadiusMeters = DEFAULT_DANGER_DETECTION_RADIUS_METERS,
  blockingExpeditionAtSeconds: DurationSeconds | null = null,
): MultiPatrolIdleStopExpeditionMonsterDangerResponsePlan {
  assertDoctrine(doctrine);
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
  if (blockingExpeditionAtSeconds !== null) {
    assertNonNegativeFinite(
      blockingExpeditionAtSeconds,
      "blockingExpeditionAtSeconds",
    );
  }

  const clearanceMonsterIds = monsters
    .map((monster) => monster.id)
    .sort(compareMonsterIds);
  const detection =
    findFirstExpeditionMonsterDangerDetectionDuringIdleStopAmongPatrols(
      expeditionRoute,
      monsters,
      stopAtRouteSeconds,
      idleDurationSeconds,
      expeditionStartsAtSeconds,
      detectionRadiusMeters,
    );
  const originalContact =
    findFirstExpeditionMonsterContactWithIdleStopAmongPatrols(
      expeditionRoute,
      monsters,
      stopAtRouteSeconds,
      idleDurationSeconds,
      expeditionStartsAtSeconds,
    );
  if (!detection) {
    return multiPatrolIdleStopPlan(
      unchangedIdleStopPlan(
        expeditionRoute,
        doctrine,
        "not-triggered",
        null,
        originalContact,
        idleDurationSeconds,
        blockingExpeditionAtSeconds,
      ),
      clearanceMonsterIds,
    );
  }

  if (
    originalContact &&
    originalContact.expeditionElapsedSeconds <=
      detection.expeditionElapsedSeconds +
        ENCOUNTER_TIME_TOLERANCE_SECONDS
  ) {
    return multiPatrolIdleStopPlan(
      unchangedIdleStopPlan(
        expeditionRoute,
        doctrine,
        "blocked-by-contact",
        detection,
        originalContact,
        idleDurationSeconds,
        blockingExpeditionAtSeconds,
      ),
      clearanceMonsterIds,
    );
  }

  if (
    blockingExpeditionAtSeconds !== null &&
    blockingExpeditionAtSeconds <=
      detection.expeditionElapsedSeconds + TIME_EPSILON_SECONDS
  ) {
    return multiPatrolIdleStopPlan(
      unchangedIdleStopPlan(
        expeditionRoute,
        doctrine,
        "blocked-by-earlier-boundary",
        detection,
        originalContact,
        idleDurationSeconds,
        blockingExpeditionAtSeconds,
      ),
      clearanceMonsterIds,
    );
  }

  if (doctrine === "CONTINUE") {
    return multiPatrolIdleStopPlan(
      unchangedIdleStopPlan(
        expeditionRoute,
        doctrine,
        "continued",
        detection,
        originalContact,
        idleDurationSeconds,
        blockingExpeditionAtSeconds,
      ),
      clearanceMonsterIds,
    );
  }

  const decision = positionAtTime(expeditionRoute, stopAtRouteSeconds);
  if (decision.segmentIndex === null) {
    return multiPatrolIdleStopPlan(
      unchangedIdleStopPlan(
        expeditionRoute,
        doctrine,
        "detour-unavailable",
        detection,
        originalContact,
        idleDurationSeconds,
        blockingExpeditionAtSeconds,
      ),
      clearanceMonsterIds,
    );
  }

  const candidate = findSafeDetourCandidate(
    expeditionRoute,
    detection,
    decision.segmentIndex,
    (_candidateRoute, continuationRoute) =>
      monsters.some((monster) =>
        findFirstExpeditionMonsterContact(
          continuationRoute,
          monster,
          detection.atSeconds,
        ) !== null
      ),
  );
  if (!candidate) {
    return multiPatrolIdleStopPlan(
      unchangedIdleStopPlan(
        expeditionRoute,
        doctrine,
        "detour-unavailable",
        detection,
        originalContact,
        idleDurationSeconds,
        blockingExpeditionAtSeconds,
      ),
      clearanceMonsterIds,
    );
  }

  const effectiveIdleDurationSeconds = Math.max(
    0,
    detection.expeditionElapsedSeconds - stopAtRouteSeconds,
  );
  return multiPatrolIdleStopPlan(
    {
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
      triggersDuringIdleStop: true,
      scheduledIdleDurationSeconds: idleDurationSeconds,
      effectiveIdleDurationSeconds,
      interruptsIdleStop:
        effectiveIdleDurationSeconds <
        idleDurationSeconds - TIME_EPSILON_SECONDS,
      blockingExpeditionAtSeconds,
      completionAtExpeditionSeconds:
        candidate.route.totalDurationSeconds + effectiveIdleDurationSeconds,
    },
    clearanceMonsterIds,
  );
}

function findSafeDetourCandidate(
  route: RoutePlan,
  detection: ExpeditionMonsterDangerDetection,
  decisionSegmentIndex: number,
  candidateHasContact: (
    route: RoutePlan,
    continuationRoute: RoutePlan,
  ) => boolean,
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
      const continuationRoute = createRoutePlan(
        detection.caravanPosition,
        commands.slice(prefix.length),
        route.speedMetersPerSecond,
        route.planetRadiusMeters,
      );
      if (candidateHasContact(candidateRoute, continuationRoute)) continue;

      safeAtThisRadius.push({
        route: candidateRoute,
        continuationRoute,
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

function multiPatrolPlan(
  plan: ExpeditionMonsterDangerResponsePlan,
  clearanceMonsterIds: readonly string[],
): MultiPatrolExpeditionMonsterDangerResponsePlan {
  return {
    ...plan,
    patrolCount: clearanceMonsterIds.length,
    clearanceMonsterIds,
  };
}

function multiPatrolIdleStopPlan(
  plan: IdleStopExpeditionMonsterDangerResponsePlan,
  clearanceMonsterIds: readonly string[],
): MultiPatrolIdleStopExpeditionMonsterDangerResponsePlan {
  return {
    ...plan,
    patrolCount: clearanceMonsterIds.length,
    clearanceMonsterIds,
  };
}

function compareMonsterIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function unchangedIdleStopPlan(
  route: RoutePlan,
  doctrine: DangerAvoidanceDoctrine,
  status: Exclude<DangerAvoidanceStatus, "avoided">,
  detection: ExpeditionMonsterDangerDetection | null,
  contact: ExpeditionMonsterContact | null,
  idleDurationSeconds: DurationSeconds,
  blockingExpeditionAtSeconds: DurationSeconds | null,
): IdleStopExpeditionMonsterDangerResponsePlan {
  return {
    ...unchangedPlan(route, doctrine, status, detection, contact),
    triggersDuringIdleStop: detection !== null,
    scheduledIdleDurationSeconds: idleDurationSeconds,
    effectiveIdleDurationSeconds: idleDurationSeconds,
    interruptsIdleStop: false,
    blockingExpeditionAtSeconds,
    completionAtExpeditionSeconds:
      route.totalDurationSeconds + idleDurationSeconds,
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
