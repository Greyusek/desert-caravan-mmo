import type { ExpeditionMonsterContact } from "./expedition-contact.js";
import type { FleeAttemptInput } from "./flee.js";
import {
  DEFAULT_PLAYER_POWER,
  resolveMonsterPowerContact,
  type PowerContactResolution,
  type StrongMonsterContactDoctrine,
} from "./power-contact.js";
import {
  createTacticalBattlefield,
  type TacticalBattlefield,
} from "./tactical-battlefield.js";
import {
  createTacticalBattleState,
  executeTacticalCommand,
  type TacticalBattleState,
  type TacticalCommand,
} from "./tactical-combat.js";
import {
  deployTacticalCargo,
  resolveTacticalCargoOutcome,
  type TacticalCargoDeployment,
  type TacticalCargoOutcome,
} from "./tactical-cargo.js";
import {
  deployTacticalUnits,
  tacticalUnitClassStats,
  type TacticalUnit,
  type TacticalUnitDeployment,
} from "./tactical-unit.js";
import {
  applyTacticalBattleToWorld,
  type TacticalWorldState,
  type WorldCaravanMemberState,
} from "./tactical-world-return.js";

export type PveMonsterContactResolutionMode = "TACTICAL" | "LEGACY_POWER";

export const DEFAULT_PVE_MONSTER_CONTACT_RESOLUTION_MODE = "TACTICAL";

export interface TacticalPveMonsterContactInput {
  readonly mode?: "TACTICAL";
  readonly contact: ExpeditionMonsterContact;
  readonly battleId: string;
  readonly battlefieldSeed: string;
  readonly worldState: TacticalWorldState;
  readonly commands: readonly TacticalCommand[];
}

export interface LegacyPowerPveMonsterContactInput {
  readonly mode: "LEGACY_POWER";
  readonly contact: ExpeditionMonsterContact;
  readonly doctrine?: StrongMonsterContactDoctrine;
  readonly playerPower?: number;
  readonly fleeAttempt?: FleeAttemptInput | null;
}

export type PveMonsterContactResolutionInput =
  | TacticalPveMonsterContactInput
  | LegacyPowerPveMonsterContactInput;

export interface TacticalPveMonsterContactResolution {
  readonly mode: "TACTICAL";
  readonly contact: ExpeditionMonsterContact;
  readonly status: "monster-defeated" | "expedition-defeated";
  readonly routeDisposition: "continue" | "fail";
  readonly terminal: boolean;
  readonly battlefield: TacticalBattlefield;
  readonly initialBattle: TacticalBattleState;
  readonly battle: TacticalBattleState;
  readonly cargoDeployment: TacticalCargoDeployment;
  readonly cargoOutcome: TacticalCargoOutcome;
  readonly worldState: TacticalWorldState;
  readonly legacyPowerResolution: null;
}

export interface LegacyPowerPveMonsterContactResolution {
  readonly mode: "LEGACY_POWER";
  readonly contact: ExpeditionMonsterContact;
  readonly status: PowerContactResolution["status"];
  readonly routeDisposition: PowerContactResolution["routeDisposition"];
  readonly terminal: boolean;
  readonly battlefield: null;
  readonly initialBattle: null;
  readonly battle: null;
  readonly cargoDeployment: null;
  readonly cargoOutcome: null;
  readonly worldState: null;
  readonly legacyPowerResolution: PowerContactResolution;
}

export type PveMonsterContactResolution =
  | TacticalPveMonsterContactResolution
  | LegacyPowerPveMonsterContactResolution;

/** Stable command identity for one caravan member in a PvE tactical contact. */
export function pveCaravanUnitId(memberId: string): string {
  assertNonEmptyString(memberId, "memberId");
  return `pve-caravan:${memberId}`;
}

/** Stable command identity for the persistent hostile in a PvE tactical contact. */
export function pveCreatureUnitId(creatureId: string): string {
  assertNonEmptyString(creatureId, "creatureId");
  return `pve-hostile:${creatureId}`;
}

/**
 * TACTICAL-007 — routes an existing authoritative expedition contact through
 * the tactical core by default. GAME-005/006 Power resolution remains
 * available only behind the explicit LEGACY_POWER compatibility mode.
 */
export function resolvePveMonsterContact(
  input: PveMonsterContactResolutionInput,
): PveMonsterContactResolution {
  if (input.mode === "LEGACY_POWER") {
    const legacyPowerResolution = resolveMonsterPowerContact(
      input.contact.monsterPower,
      input.doctrine ?? "FLEE",
      input.playerPower ?? DEFAULT_PLAYER_POWER,
      input.fleeAttempt ?? null,
    );
    return {
      mode: "LEGACY_POWER",
      contact: input.contact,
      status: legacyPowerResolution.status,
      routeDisposition: legacyPowerResolution.routeDisposition,
      terminal: legacyPowerResolution.terminal,
      battlefield: null,
      initialBattle: null,
      battle: null,
      cargoDeployment: null,
      cargoOutcome: null,
      worldState: null,
      legacyPowerResolution,
    };
  }

  assertTacticalInput(input);
  const battlefield = createTacticalBattlefield(input.battlefieldSeed);
  const units = createContactUnits(input.worldState, battlefield);
  const initialBattle = createTacticalBattleState(battlefield, units);
  const battle = input.commands.reduce(
    (state, command) => executeTacticalCommand(state, command),
    initialBattle,
  );
  if (battle.status !== "complete" || battle.winner === null) {
    throw new RangeError("tactical PvE contact commands must complete the battle");
  }
  const cargoDeployment = deployTacticalCargo(
    battlefield,
    input.worldState.caravan.cargo,
    initialBattle.units,
  );
  const cargoOutcome = resolveTacticalCargoOutcome(
    cargoDeployment,
    battle.winner,
  );
  const worldState = applyTacticalBattleToWorld(
    input.worldState,
    input.battleId,
    battle,
    cargoOutcome,
  );
  const caravanWon = battle.winner === "caravan";
  return {
    mode: "TACTICAL",
    contact: input.contact,
    status: caravanWon ? "monster-defeated" : "expedition-defeated",
    routeDisposition: caravanWon ? "continue" : "fail",
    terminal: !caravanWon,
    battlefield,
    initialBattle,
    battle,
    cargoDeployment,
    cargoOutcome,
    worldState,
    legacyPowerResolution: null,
  };
}

function assertTacticalInput(input: TacticalPveMonsterContactInput): void {
  assertNonEmptyString(input.battleId, "battleId");
  assertNonEmptyString(input.battlefieldSeed, "battlefieldSeed");
  const creature = input.worldState.creature;
  if (creature.status !== "alive" || creature.health <= 0) {
    throw new RangeError("tactical PvE contact requires a living persistent creature");
  }
  if (input.contact.monsterId !== creature.creature.monster.id) {
    throw new RangeError("contact monster must match the persistent creature monster id");
  }
  if (input.contact.monsterPower !== creature.creature.monster.power) {
    throw new RangeError("contact monster power must match the persistent creature");
  }
  if (!input.worldState.members.some((member) => member.status === "alive")) {
    throw new RangeError("tactical PvE contact requires a living caravan member");
  }
}

function createContactUnits(
  worldState: TacticalWorldState,
  battlefield: TacticalBattlefield,
): readonly TacticalUnit[] {
  const livingMembers = worldState.members.filter(
    (member) => member.status === "alive",
  );
  const deployments: TacticalUnitDeployment[] = [
    ...livingMembers.map((member) => ({
      id: pveCaravanUnitId(member.id),
      side: "caravan" as const,
      unitClass: member.unitClass,
      source: { kind: "caravan-member" as const, id: member.id },
    })),
    {
      id: pveCreatureUnitId(worldState.creature.creature.id),
      side: "hostile",
      unitClass: "monster",
      source: {
        kind: "persistent-creature",
        id: worldState.creature.creature.id,
      },
    },
  ];
  const deployed = deployTacticalUnits(battlefield, deployments);
  const memberById = new Map(livingMembers.map((member) => [member.id, member]));
  return deployed.map((unit) => {
    if (unit.source.kind === "persistent-creature") {
      assertWorldHealth(
        worldState.creature.health,
        worldState.creature.maxHealth,
        unit.stats.maxHealth,
        `creature ${unit.source.id}`,
      );
      return { ...unit, health: worldState.creature.health };
    }
    const member = memberById.get(unit.source.id);
    if (!member) throw new Error(`living caravan member must exist: ${unit.source.id}`);
    assertMemberClass(member);
    assertWorldHealth(
      member.health,
      member.maxHealth,
      unit.stats.maxHealth,
      `member ${member.id}`,
    );
    return { ...unit, health: member.health };
  });
}

function assertMemberClass(member: WorldCaravanMemberState): void {
  const expected = tacticalUnitClassStats(member.unitClass).maxHealth;
  if (member.maxHealth !== expected) {
    throw new RangeError(`member ${member.id} maxHealth must match its tactical class`);
  }
}

function assertWorldHealth(
  health: number,
  maxHealth: number,
  tacticalMaxHealth: number,
  label: string,
): void {
  if (maxHealth !== tacticalMaxHealth) {
    throw new RangeError(`${label} maxHealth must match its tactical class`);
  }
  if (!Number.isInteger(health) || health <= 0 || health > maxHealth) {
    throw new RangeError(`${label} health must be a positive integer within maxHealth`);
  }
}

function assertNonEmptyString(value: string, name: string): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
}
