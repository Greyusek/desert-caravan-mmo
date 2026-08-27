import type { PersistentCreatureState } from "./creature-persistence.js";
import type { DurationSeconds } from "./route.js";

export const LEGENDARY_SURVIVAL_SECONDS = 30 * 24 * 60 * 60;
export const LEGENDARY_VICTORY_COUNT = 3;
export const LEGENDARY_CONTROLLED_OBJECT_COUNT = 1;

interface CreatureLegendEventBase {
  readonly id: string;
  readonly worldTimeSeconds: DurationSeconds;
}

export type CreatureLegendEvent =
  | (CreatureLegendEventBase & {
      readonly type: "victory";
      readonly defeatedEntityId: string;
    })
  | (CreatureLegendEventBase & {
      readonly type: "object-controlled";
      readonly objectId: string;
    })
  | (CreatureLegendEventBase & {
      readonly type: "object-released";
      readonly objectId: string;
    })
  | (CreatureLegendEventBase & {
      readonly type: "death";
    });

export interface CreatureLegendHistory {
  readonly creatureId: string;
  readonly bornAtWorldTimeSeconds: DurationSeconds;
  readonly events: readonly CreatureLegendEvent[];
  readonly victoryCount: number;
  readonly controlledObjectIds: readonly string[];
  readonly isAlive: boolean;
  readonly isLegendary: boolean;
  readonly becameLegendaryAtWorldTimeSeconds: DurationSeconds | null;
  readonly endedAtWorldTimeSeconds: DurationSeconds | null;
}

export function createCreatureLegendHistory(
  state: PersistentCreatureState,
): CreatureLegendHistory {
  assertNonEmptyString(state.id, "state.id");
  assertNonNegativeFinite(state.bornAtWorldTimeSeconds, "bornAtWorldTimeSeconds");
  return {
    creatureId: state.id,
    bornAtWorldTimeSeconds: state.bornAtWorldTimeSeconds,
    events: [],
    victoryCount: 0,
    controlledObjectIds: [],
    isAlive: true,
    isLegendary: false,
    becameLegendaryAtWorldTimeSeconds: null,
    endedAtWorldTimeSeconds: null,
  };
}

/**
 * HISTORY-003 — derives legendary status only from one persistent identity's
 * recorded survival, victories and current object control. Death is final:
 * history remains readable but can never receive another event.
 */
export function recordCreatureLegendEvent(
  history: CreatureLegendHistory,
  event: CreatureLegendEvent,
): CreatureLegendHistory {
  assertHistory(history);
  assertEvent(event);
  if (history.events.some((candidate) => candidate.id === event.id)) {
    return history;
  }
  if (!history.isAlive) {
    throw new RangeError("dead creature history is final");
  }
  const previous = history.events.at(-1);
  if (previous && event.worldTimeSeconds < previous.worldTimeSeconds) {
    throw new RangeError("legend events must not rewind world time");
  }
  if (event.worldTimeSeconds < history.bornAtWorldTimeSeconds) {
    throw new RangeError("legend event must not precede creature birth");
  }

  let victoryCount = history.victoryCount;
  let controlledObjectIds = [...history.controlledObjectIds];
  let isAlive = true;
  let endedAtWorldTimeSeconds: DurationSeconds | null = null;
  if (event.type === "victory") victoryCount += 1;
  if (event.type === "object-controlled") {
    controlledObjectIds = [...new Set([...controlledObjectIds, event.objectId])].sort(compareRaw);
  }
  if (event.type === "object-released") {
    controlledObjectIds = controlledObjectIds.filter((id) => id !== event.objectId);
  }
  if (event.type === "death") {
    isAlive = false;
    endedAtWorldTimeSeconds = event.worldTimeSeconds;
  }
  const qualifies =
    event.worldTimeSeconds - history.bornAtWorldTimeSeconds >=
      LEGENDARY_SURVIVAL_SECONDS &&
    victoryCount >= LEGENDARY_VICTORY_COUNT &&
    controlledObjectIds.length >= LEGENDARY_CONTROLLED_OBJECT_COUNT;
  const isLegendary = history.isLegendary || qualifies;

  return {
    ...history,
    events: [...history.events, { ...event }],
    victoryCount,
    controlledObjectIds,
    isAlive,
    isLegendary,
    becameLegendaryAtWorldTimeSeconds:
      history.becameLegendaryAtWorldTimeSeconds ??
      (qualifies ? event.worldTimeSeconds : null),
    endedAtWorldTimeSeconds,
  };
}

function assertHistory(history: CreatureLegendHistory): void {
  assertNonEmptyString(history.creatureId, "history.creatureId");
  assertNonNegativeFinite(history.bornAtWorldTimeSeconds, "history.bornAtWorldTimeSeconds");
}

function assertEvent(event: CreatureLegendEvent): void {
  assertNonEmptyString(event.id, "event.id");
  assertNonNegativeFinite(event.worldTimeSeconds, "event.worldTimeSeconds");
  if (event.type === "victory") {
    assertNonEmptyString(event.defeatedEntityId, "event.defeatedEntityId");
  } else if (event.type === "object-controlled" || event.type === "object-released") {
    assertNonEmptyString(event.objectId, "event.objectId");
  } else if (event.type !== "death") {
    throw new RangeError("legend event type is invalid");
  }
}

function compareRaw(first: string, second: string): number {
  return first < second ? -1 : first > second ? 1 : 0;
}

function assertNonEmptyString(value: string, name: string): void {
  if (typeof value !== "string" || value.length === 0) {
    throw new RangeError(`${name} must not be empty`);
  }
}

function assertNonNegativeFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative finite number`);
  }
}
