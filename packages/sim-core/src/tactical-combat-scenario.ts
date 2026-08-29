import { createPersistentCreatureState } from "./creature-persistence.js";
import {
  findFirstExpeditionMonsterContact,
  type ExpeditionMonsterContact,
} from "./expedition-contact.js";
import { destinationPoint } from "./geometry.js";
import type { WanderingMonster } from "./monster.js";
import {
  pveCaravanUnitId,
  pveCreatureUnitId,
  resolvePveMonsterContact,
  type TacticalPveMonsterContactResolution,
} from "./pve-contact-resolution.js";
import { createRoutePlan, type RoutePlan } from "./route.js";
import { createTacticalBattlefield } from "./tactical-battlefield.js";
import type { TacticalCommand } from "./tactical-combat.js";
import { deployTacticalUnits } from "./tactical-unit.js";
import {
  arriveTradeJourney,
  beginTradeJourney,
  createTradeCaravanState,
  tradeJourneyPositionAtWorldTime,
  type TradeJourneyPosition,
} from "./trade-route.js";
import {
  createTacticalWorldState,
  type TacticalWorldState,
} from "./tactical-world-return.js";
import { createWorldCoordinate } from "./types.js";
import type { City } from "./world.js";

const COMBAT_ROUTE_SPEED_METERS_PER_SECOND = 10;
const COMBAT_ROUTE_HALF_DISTANCE_METERS = 1_000;
const COMBAT_CONTINUATION_SECONDS = 30;

export interface TacticalCombatScenarioContinuation {
  readonly resumedAtWorldTimeSeconds: number;
  readonly evaluatedAtWorldTimeSeconds: number;
  readonly arrivedAtWorldTimeSeconds: number;
  readonly contactPosition: TradeJourneyPosition;
  readonly evaluatedPosition: TradeJourneyPosition;
  readonly arrivalPosition: TradeJourneyPosition;
  readonly progressedDistanceMeters: number;
  readonly worldState: TacticalWorldState;
}

export interface TacticalCombatScenario {
  readonly seed: string;
  readonly originCity: City;
  readonly destinationCity: City;
  readonly expeditionRoute: RoutePlan;
  readonly monster: WanderingMonster;
  readonly contact: ExpeditionMonsterContact;
  readonly commands: readonly TacticalCommand[];
  readonly resolution: TacticalPveMonsterContactResolution;
  readonly continuation: TacticalCombatScenarioContinuation;
}

/**
 * COMBAT-001 — one fixed-action seeded server-truth replay from a physical
 * global journey and real PvE contact through tactical consequences and back
 * into the same journey. Tactical time is instantaneous in this prototype;
 * after the result is applied exactly once, global route time resumes at the
 * contact boundary and the surviving caravan reaches its destination.
 */
export function createTacticalCombatScenario(
  seed: string,
): TacticalCombatScenario {
  assertNonEmptyString(seed, "seed");
  const crossing = createWorldCoordinate(0, 0);
  const originCity: City = {
    id: "combat-origin",
    name: "South Camp",
    position: destinationPoint(
      crossing,
      180,
      COMBAT_ROUTE_HALF_DISTANCE_METERS,
    ),
  };
  const destinationCity: City = {
    id: "combat-destination",
    name: "North Camp",
    position: destinationPoint(
      crossing,
      0,
      COMBAT_ROUTE_HALF_DISTANCE_METERS,
    ),
  };
  const expeditionRoute = createRoutePlan(
    originCity.position,
    [
      {
        bearingDeg: 0,
        distanceMeters: COMBAT_ROUTE_HALF_DISTANCE_METERS * 2,
      },
    ],
    COMBAT_ROUTE_SPEED_METERS_PER_SECOND,
  );
  const patrolStart = destinationPoint(
    crossing,
    270,
    COMBAT_ROUTE_HALF_DISTANCE_METERS,
  );
  const monster: WanderingMonster = {
    id: "combat-monster",
    kind: "wandering-monster",
    power: 90,
    visionRadiusMeters: 300,
    interactionRadiusMeters: 100,
    patrolRoute: createRoutePlan(
      patrolStart,
      [
        { bearingDeg: 90, distanceMeters: 2_000 },
        { bearingDeg: 270, distanceMeters: 2_000 },
      ],
      COMBAT_ROUTE_SPEED_METERS_PER_SECOND,
    ),
  };
  const contact = findFirstExpeditionMonsterContact(
    expeditionRoute,
    monster,
  );
  if (!contact) {
    throw new Error("COMBAT-001 scenario requires a real global PvE contact");
  }

  const creature = createPersistentCreatureState(monster, "sand-beast");
  const sourceField = createTacticalBattlefield(`combat-001-source:${seed}`);
  const sourceUnits = deployTacticalUnits(sourceField, [
    {
      id: "combat-source-guard",
      side: "caravan",
      unitClass: "guard",
      source: { kind: "caravan-member", id: "combat-member-guard" },
    },
    {
      id: "combat-source-skirmisher",
      side: "caravan",
      unitClass: "skirmisher",
      source: { kind: "caravan-member", id: "combat-member-skirmisher" },
    },
    {
      id: "combat-source-monster",
      side: "hostile",
      unitClass: "monster",
      source: { kind: "persistent-creature", id: creature.id },
    },
  ]);
  const caravanWithCargo = {
    ...createTradeCaravanState(
      "combat-caravan",
      originCity.id,
      250,
      20,
    ),
    cargo: {
      capacityCargoUnits: 20,
      stacks: [
        { goodId: "ore" as const, units: 5, costBasisCredits: 110 },
        { goodId: "medicine" as const, units: 2, costBasisCredits: 80 },
      ],
    },
  };
  const travellingCaravan = beginTradeJourney(
    caravanWithCargo,
    originCity,
    destinationCity,
    expeditionRoute,
    0,
  );
  const worldState = createTacticalWorldState(
    travellingCaravan,
    sourceUnits,
    creature,
  );
  const guardId = pveCaravanUnitId("combat-member-guard");
  const skirmisherId = pveCaravanUnitId("combat-member-skirmisher");
  const monsterId = pveCreatureUnitId(creature.id);
  const commands: readonly TacticalCommand[] = [
    { kind: "MOVE", unitId: guardId, to: { x: 2, y: 0 } },
    { kind: "MOVE", unitId: monsterId, to: { x: 8, y: 0 } },
    { kind: "MOVE", unitId: skirmisherId, to: { x: 3, y: 1 } },
    { kind: "MOVE", unitId: monsterId, to: { x: 6, y: 0 } },
    { kind: "MOVE", unitId: skirmisherId, to: { x: 6, y: 1 } },
    { kind: "ATTACK", unitId: monsterId, targetUnitId: skirmisherId },
    { kind: "ATTACK", unitId: skirmisherId, targetUnitId: monsterId },
    { kind: "ATTACK", unitId: monsterId, targetUnitId: skirmisherId },
    { kind: "ATTACK", unitId: skirmisherId, targetUnitId: monsterId },
    { kind: "ATTACK", unitId: monsterId, targetUnitId: skirmisherId },
    { kind: "MOVE", unitId: guardId, to: { x: 4, y: 0 } },
    { kind: "WAIT", unitId: monsterId },
    { kind: "MOVE", unitId: guardId, to: { x: 5, y: 0 } },
    { kind: "ATTACK", unitId: monsterId, targetUnitId: guardId },
    { kind: "ATTACK", unitId: guardId, targetUnitId: monsterId },
    { kind: "ATTACK", unitId: monsterId, targetUnitId: guardId },
    { kind: "ATTACK", unitId: guardId, targetUnitId: monsterId },
  ];
  const resolution = resolvePveMonsterContact({
    contact,
    battleId: `combat-001-battle:${seed}`,
    battlefieldSeed: `combat-001-battlefield:${seed}`,
    worldState,
    commands,
  });
  if (resolution.mode !== "TACTICAL") {
    throw new Error("COMBAT-001 scenario must use tactical resolution");
  }

  const resumedAtWorldTimeSeconds = contact.expeditionElapsedSeconds;
  const evaluatedAtWorldTimeSeconds =
    resumedAtWorldTimeSeconds + COMBAT_CONTINUATION_SECONDS;
  const journey = resolution.worldState.caravan.activeJourney;
  if (!journey) {
    throw new Error("winning COMBAT-001 caravan must retain its active journey");
  }
  if (evaluatedAtWorldTimeSeconds >= journey.arrivesAtWorldTimeSeconds) {
    throw new Error("COMBAT-001 continuation sample must precede arrival");
  }
  const contactPosition = tradeJourneyPositionAtWorldTime(
    resolution.worldState.caravan,
    resumedAtWorldTimeSeconds,
  );
  const evaluatedPosition = tradeJourneyPositionAtWorldTime(
    resolution.worldState.caravan,
    evaluatedAtWorldTimeSeconds,
  );
  const arrivalPosition = tradeJourneyPositionAtWorldTime(
    resolution.worldState.caravan,
    journey.arrivesAtWorldTimeSeconds,
  );
  const arrivedCaravan = arriveTradeJourney(
    resolution.worldState.caravan,
    journey.arrivesAtWorldTimeSeconds,
  );
  const continuedWorldState: TacticalWorldState = {
    ...resolution.worldState,
    caravan: arrivedCaravan,
  };

  return {
    seed,
    originCity,
    destinationCity,
    expeditionRoute,
    monster,
    contact,
    commands,
    resolution,
    continuation: {
      resumedAtWorldTimeSeconds,
      evaluatedAtWorldTimeSeconds,
      arrivedAtWorldTimeSeconds: journey.arrivesAtWorldTimeSeconds,
      contactPosition,
      evaluatedPosition,
      arrivalPosition,
      progressedDistanceMeters:
        evaluatedPosition.traveledDistanceMeters -
        contactPosition.traveledDistanceMeters,
      worldState: continuedWorldState,
    },
  };
}

function assertNonEmptyString(value: string, name: string): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
}
