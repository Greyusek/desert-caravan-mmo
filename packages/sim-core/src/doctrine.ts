import type { StaticObjectDiscovery } from "./discovery.js";
import type { DurationSeconds } from "./route.js";
import type { DistanceMeters, WorldCoordinate } from "./types.js";
import type { StaticWorldObjectKind } from "./world.js";

export type StaticObjectDiscoveryDoctrine = "STOP" | "MARK_AND_CONTINUE";
export type StaticObjectDoctrineStatus =
  | "pending"
  | "stopped"
  | "marked-and-continuing";

export interface StaticObjectDoctrineDecision {
  readonly doctrine: StaticObjectDiscoveryDoctrine;
  readonly objectId: string;
  readonly objectKind: StaticWorldObjectKind;
  readonly decidedAtSeconds: DurationSeconds;
  readonly segmentIndex: number;
  readonly routeDistanceMeters: DistanceMeters;
  readonly caravanPosition: WorldCoordinate;
  readonly continuesRoute: boolean;
}

export interface StaticObjectDoctrineEvaluation {
  readonly doctrine: StaticObjectDiscoveryDoctrine;
  readonly status: StaticObjectDoctrineStatus;
  readonly evaluatedAtSeconds: DurationSeconds;
  /** Elapsed route time that SIM-005 should evaluate after doctrine is applied. */
  readonly movementElapsedSeconds: DurationSeconds;
  readonly decision: StaticObjectDoctrineDecision | null;
}

const TIME_EPSILON_SECONDS = 1e-9;

/**
 * GAME-002 — evaluates the first automatic response to a discovered static
 * object without mutating the route or storing UI state.
 *
 * Before the discovery moment there is no decision. At discovery, STOP freezes
 * route movement at the authoritative first-entry coordinate, while
 * MARK_AND_CONTINUE records the object and leaves route time untouched.
 */
export function evaluateStaticObjectDiscoveryDoctrine(
  discovery: StaticObjectDiscovery | null,
  doctrine: StaticObjectDiscoveryDoctrine,
  elapsedSeconds: DurationSeconds,
): StaticObjectDoctrineEvaluation {
  assertDoctrine(doctrine);
  assertNonNegativeFinite(elapsedSeconds, "elapsedSeconds");

  if (
    discovery === null ||
    elapsedSeconds + TIME_EPSILON_SECONDS < discovery.elapsedSeconds
  ) {
    return {
      doctrine,
      status: "pending",
      evaluatedAtSeconds: elapsedSeconds,
      movementElapsedSeconds: elapsedSeconds,
      decision: null,
    };
  }

  const continuesRoute = doctrine === "MARK_AND_CONTINUE";
  return {
    doctrine,
    status: continuesRoute ? "marked-and-continuing" : "stopped",
    evaluatedAtSeconds: elapsedSeconds,
    movementElapsedSeconds: continuesRoute
      ? elapsedSeconds
      : discovery.elapsedSeconds,
    decision: {
      doctrine,
      objectId: discovery.object.id,
      objectKind: discovery.object.kind,
      decidedAtSeconds: discovery.elapsedSeconds,
      segmentIndex: discovery.segmentIndex,
      routeDistanceMeters: discovery.routeDistanceMeters,
      caravanPosition: discovery.caravanPosition,
      continuesRoute,
    },
  };
}

function assertDoctrine(value: string): asserts value is StaticObjectDiscoveryDoctrine {
  if (value !== "STOP" && value !== "MARK_AND_CONTINUE") {
    throw new RangeError("doctrine must be STOP or MARK_AND_CONTINUE");
  }
}

function assertNonNegativeFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative finite number`);
  }
}
