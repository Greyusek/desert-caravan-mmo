import { findFirstMovingEncounter } from "./encounter.js";
import type { WanderingMonster } from "./monster.js";
import type {
  DurationSeconds,
  RoutePlan,
  SpeedMetersPerSecond,
} from "./route.js";
import type { DistanceMeters, WorldCoordinate } from "./types.js";

export interface ExpeditionMonsterContact {
  readonly monsterId: string;
  readonly monsterPower: number;
  readonly monsterSpeedMetersPerSecond: SpeedMetersPerSecond;
  readonly atSeconds: DurationSeconds;
  readonly expeditionElapsedSeconds: DurationSeconds;
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
    monsterPatrolElapsedSeconds: encounter.secondRouteElapsedSeconds,
    separationMeters: encounter.separationMeters,
    interactionRadiusMeters: monster.interactionRadiusMeters,
    caravanPosition: encounter.firstPosition,
    monsterPosition: encounter.secondPosition,
  };
}

function assertNonNegativeFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative finite number`);
  }
}
