import { findFirstMovingEncounter } from "./encounter.js";
import { greatCircleDistance } from "./geometry.js";
import type { WanderingMonster } from "./monster.js";
import {
  createRoutePlan,
  positionAtTime,
  type RouteCommand,
  DurationSeconds,
  type RoutePlan,
  type SpeedMetersPerSecond,
} from "./route.js";
import {
  normalizeBearing,
  type DistanceMeters,
  type WorldCoordinate,
} from "./types.js";

export interface ExpeditionMonsterContact {
  readonly monsterId: string;
  readonly monsterPower: number;
  readonly monsterSpeedMetersPerSecond: SpeedMetersPerSecond;
  readonly atSeconds: DurationSeconds;
  /** World/expedition time since departure. */
  readonly expeditionElapsedSeconds: DurationSeconds;
  /** SIM-005 time on the original route, excluding any idle STOP duration. */
  readonly routeElapsedSeconds: DurationSeconds;
  readonly monsterPatrolElapsedSeconds: DurationSeconds;
  readonly separationMeters: DistanceMeters;
  readonly interactionRadiusMeters: DistanceMeters;
  readonly caravanPosition: WorldCoordinate;
  readonly monsterPosition: WorldCoordinate;
}

/**
 * GAME-004 — composes a finite expedition route with a cyclic WORLD-004
 * patrol and returns the first authoritative SIM-008 interaction-radius entry.
 * Absolute simulation time may differ from expedition route time when a
 * caravan leaves after T+00:00:00; monster patrols always follow world time.
 */
export function findFirstExpeditionMonsterContact(
  expeditionRoute: RoutePlan,
  monster: WanderingMonster,
  expeditionStartsAtSeconds: DurationSeconds = 0,
): ExpeditionMonsterContact | null {
  assertNonNegativeFinite(
    expeditionStartsAtSeconds,
    "expeditionStartsAtSeconds",
  );

  const encounter = findFirstMovingEncounter(
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
    monster.interactionRadiusMeters,
  );

  if (!encounter) return null;

  return {
    monsterId: monster.id,
    monsterPower: monster.power,
    monsterSpeedMetersPerSecond: monster.patrolRoute.speedMetersPerSecond,
    atSeconds: encounter.atSeconds,
    expeditionElapsedSeconds: encounter.firstRouteElapsedSeconds,
    routeElapsedSeconds: encounter.firstRouteElapsedSeconds,
    monsterPatrolElapsedSeconds: encounter.secondRouteElapsedSeconds,
    separationMeters: encounter.separationMeters,
    interactionRadiusMeters: monster.interactionRadiusMeters,
    caravanPosition: encounter.firstPosition,
    monsterPosition: encounter.secondPosition,
  };
}

/**
 * GAME-009 — searches moving contacts before a discovery STOP and after the
 * scheduled resume against uninterrupted world-time patrol motion.
 *
 * A patrol that enters and leaves interaction radius only while the caravan is
 * stationary is intentionally outside this checkpoint; stationary encounter
 * resolution requires its own lifecycle boundary. A patrol still inside the
 * radius when movement resumes is found immediately by the post-stop search.
 */
export function findFirstExpeditionMonsterContactWithIdleStop(
  expeditionRoute: RoutePlan,
  monster: WanderingMonster,
  stopAtRouteSeconds: DurationSeconds,
  idleDurationSeconds: DurationSeconds,
  expeditionStartsAtSeconds: DurationSeconds = 0,
): ExpeditionMonsterContact | null {
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

  const uninterrupted = findFirstExpeditionMonsterContact(
    expeditionRoute,
    monster,
    expeditionStartsAtSeconds,
  );
  if (
    uninterrupted &&
    uninterrupted.routeElapsedSeconds <= stopAtRouteSeconds + 1e-9
  ) {
    return uninterrupted;
  }
  if (stopAtRouteSeconds >= expeditionRoute.totalDurationSeconds - 1e-9) {
    return null;
  }

  const remainder = createRouteRemainder(
    expeditionRoute,
    stopAtRouteSeconds,
  );
  if (!remainder) return null;
  const resumeAtSeconds =
    expeditionStartsAtSeconds + stopAtRouteSeconds + idleDurationSeconds;
  const postStop = findFirstExpeditionMonsterContact(
    remainder,
    monster,
    resumeAtSeconds,
  );
  if (!postStop) return null;

  return {
    ...postStop,
    expeditionElapsedSeconds:
      postStop.atSeconds - expeditionStartsAtSeconds,
    routeElapsedSeconds:
      stopAtRouteSeconds + postStop.routeElapsedSeconds,
  };
}

function createRouteRemainder(
  route: RoutePlan,
  elapsedSeconds: DurationSeconds,
): RoutePlan | null {
  const position = positionAtTime(route, elapsedSeconds);
  if (position.segmentIndex === null) return null;
  const remainingSegments = route.segments.slice(position.segmentIndex);
  const currentSegment = remainingSegments[0];
  if (!currentSegment) return null;

  const firstDistanceMeters = greatCircleDistance(
    position.coordinate,
    currentSegment.end,
    route.planetRadiusMeters,
  );
  const commands: RouteCommand[] = [
    {
      bearingDeg:
        firstDistanceMeters <= 1e-9
          ? currentSegment.bearingDeg
          : initialBearing(position.coordinate, currentSegment.end),
      distanceMeters: firstDistanceMeters,
    },
    ...remainingSegments.slice(1).map((segment) => ({
      bearingDeg: segment.bearingDeg,
      distanceMeters: segment.distanceMeters,
    })),
  ];

  return createRoutePlan(
    position.coordinate,
    commands,
    route.speedMetersPerSecond,
    route.planetRadiusMeters,
  );
}

function initialBearing(
  start: WorldCoordinate,
  end: WorldCoordinate,
): number {
  const degreesToRadians = Math.PI / 180;
  const radiansToDegrees = 180 / Math.PI;
  const latitude1 = start.latitudeDeg * degreesToRadians;
  const latitude2 = end.latitudeDeg * degreesToRadians;
  const longitudeDelta =
    (end.longitudeDeg - start.longitudeDeg) * degreesToRadians;
  const y = Math.sin(longitudeDelta) * Math.cos(latitude2);
  const x =
    Math.cos(latitude1) * Math.sin(latitude2) -
    Math.sin(latitude1) * Math.cos(latitude2) * Math.cos(longitudeDelta);
  return normalizeBearing(Math.atan2(y, x) * radiansToDegrees);
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

function assertNonNegativeFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative finite number`);
  }
}
