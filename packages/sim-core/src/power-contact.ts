import {
  resolveFleeAttempt,
  type FleeAttemptInput,
  type FleeResolution,
} from "./flee.js";

export const DEFAULT_PLAYER_POWER = 100;

export type StrongMonsterContactDoctrine = "FLEE" | "ACCEPT_FIGHT";

export type PowerContactResolutionStatus =
  | "monster-defeated"
  | "flee-required"
  | "flee-succeeded"
  | "flee-failed"
  | "expedition-defeated";

export type PowerContactRouteDisposition = "continue" | "pause" | "fail";

export interface PowerContactResolution {
  readonly playerPower: number;
  readonly monsterPower: number;
  readonly powerDelta: number;
  readonly doctrine: StrongMonsterContactDoctrine | null;
  readonly status: PowerContactResolutionStatus;
  readonly routeDisposition: PowerContactRouteDisposition;
  readonly fleeResolution: FleeResolution | null;
  readonly monsterDefeated: boolean;
  readonly expeditionDefeated: boolean;
  readonly terminal: boolean;
}

/**
 * GAME-005 — resolves a moving-monster contact with the transparent MVP Power
 * stub. A stronger caravan defeats the monster and continues immediately. A
 * stronger or equal monster requires the explicit pre-combat doctrine: FLEE
 * uses GAME-006 movement inputs when supplied (or preserves the GAME-005 pause
 * when they are omitted), while ACCEPT_FIGHT is fatal.
 */
export function resolveMonsterPowerContact(
  monsterPower: number,
  doctrine: StrongMonsterContactDoctrine = "FLEE",
  playerPower: number = DEFAULT_PLAYER_POWER,
  fleeAttempt: FleeAttemptInput | null = null,
): PowerContactResolution {
  assertPositiveFinite(playerPower, "playerPower");
  assertPositiveFinite(monsterPower, "monsterPower");
  assertStrongMonsterDoctrine(doctrine);

  const powerDelta = playerPower - monsterPower;
  if (powerDelta > 0) {
    return {
      playerPower,
      monsterPower,
      powerDelta,
      doctrine: null,
      status: "monster-defeated",
      routeDisposition: "continue",
      fleeResolution: null,
      monsterDefeated: true,
      expeditionDefeated: false,
      terminal: false,
    };
  }

  if (doctrine === "FLEE") {
    if (fleeAttempt !== null) {
      const fleeResolution = resolveFleeAttempt(fleeAttempt);
      return {
        playerPower,
        monsterPower,
        powerDelta,
        doctrine,
        status: fleeResolution.status,
        routeDisposition: fleeResolution.routeDisposition,
        fleeResolution,
        monsterDefeated: false,
        expeditionDefeated: fleeResolution.expeditionDefeated,
        terminal: fleeResolution.terminal,
      };
    }

    return {
      playerPower,
      monsterPower,
      powerDelta,
      doctrine,
      status: "flee-required",
      routeDisposition: "pause",
      fleeResolution: null,
      monsterDefeated: false,
      expeditionDefeated: false,
      terminal: false,
    };
  }

  return {
    playerPower,
    monsterPower,
    powerDelta,
    doctrine,
    status: "expedition-defeated",
    routeDisposition: "fail",
    fleeResolution: null,
    monsterDefeated: false,
    expeditionDefeated: true,
    terminal: true,
  };
}

function assertPositiveFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive finite number`);
  }
}

function assertStrongMonsterDoctrine(
  doctrine: string,
): asserts doctrine is StrongMonsterContactDoctrine {
  if (doctrine !== "FLEE" && doctrine !== "ACCEPT_FIGHT") {
    throw new RangeError("doctrine must be FLEE or ACCEPT_FIGHT");
  }
}
