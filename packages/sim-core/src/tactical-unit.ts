import {
  isCellInDeploymentZone,
  type TacticalBattlefield,
  type TacticalCell,
  type TacticalSide,
} from "./tactical-battlefield.js";

export type TacticalUnitClass = "guard" | "skirmisher" | "monster";
export type TacticalUnitSourceKind = "caravan-member" | "persistent-creature";

export interface TacticalUnitStats {
  readonly maxHealth: number;
  readonly movementCells: number;
  readonly attackRangeCells: number;
  readonly attackDamage: number;
}

export interface TacticalUnitSource {
  readonly kind: TacticalUnitSourceKind;
  readonly id: string;
}

export interface TacticalUnitDeployment {
  readonly id: string;
  readonly side: TacticalSide;
  readonly unitClass: TacticalUnitClass;
  readonly source: TacticalUnitSource;
}

export interface TacticalUnit {
  readonly id: string;
  readonly side: TacticalSide;
  readonly unitClass: TacticalUnitClass;
  readonly source: TacticalUnitSource;
  readonly position: TacticalCell;
  readonly health: number;
  readonly stats: TacticalUnitStats;
}

const CLASS_STATS: Readonly<Record<TacticalUnitClass, TacticalUnitStats>> = {
  guard: {
    maxHealth: 12,
    movementCells: 2,
    attackRangeCells: 1,
    attackDamage: 4,
  },
  skirmisher: {
    maxHealth: 8,
    movementCells: 3,
    attackRangeCells: 3,
    attackDamage: 2,
  },
  monster: {
    maxHealth: 10,
    movementCells: 2,
    attackRangeCells: 1,
    attackDamage: 3,
  },
};

export function tacticalUnitClassStats(
  unitClass: TacticalUnitClass,
): TacticalUnitStats {
  assertUnitClass(unitClass);
  return { ...CLASS_STATS[unitClass] };
}

/** TACTICAL-002 — places real source identities into stable deployment cells. */
export function deployTacticalUnits(
  battlefield: TacticalBattlefield,
  deployments: readonly TacticalUnitDeployment[],
): readonly TacticalUnit[] {
  const seenUnitIds = new Set<string>();
  const seenSources = new Set<string>();
  const occupied = new Set<string>();
  const nextCellIndex: Record<TacticalSide, number> = {
    caravan: 0,
    hostile: 0,
  };

  return deployments.map((deployment) => {
    assertNonEmptyString(deployment.id, "deployment.id");
    assertSide(deployment.side);
    assertUnitClass(deployment.unitClass);
    assertSource(deployment.source);
    assertClassSide(deployment.unitClass, deployment.side);
    if (seenUnitIds.has(deployment.id)) {
      throw new RangeError(`tactical unit ids must be unique: ${deployment.id}`);
    }
    const sourceKey = `${deployment.source.kind}:${deployment.source.id}`;
    if (seenSources.has(sourceKey)) {
      throw new RangeError(`tactical unit sources must be unique: ${sourceKey}`);
    }

    const zone = battlefield.deploymentZones[deployment.side];
    const index = nextCellIndex[deployment.side];
    const position = zone.cells[index];
    if (position === undefined) {
      throw new RangeError(`${deployment.side} deployment zone is full`);
    }
    if (!isCellInDeploymentZone(battlefield, deployment.side, position)) {
      throw new Error("deployment zone contains an invalid cell");
    }
    const positionKey = `${position.x},${position.y}`;
    if (occupied.has(positionKey)) {
      throw new Error(`deployment cell is occupied: ${positionKey}`);
    }

    seenUnitIds.add(deployment.id);
    seenSources.add(sourceKey);
    occupied.add(positionKey);
    nextCellIndex[deployment.side] += 1;
    const stats = tacticalUnitClassStats(deployment.unitClass);
    return {
      ...deployment,
      position: { ...position },
      health: stats.maxHealth,
      stats,
    };
  });
}

function assertClassSide(
  unitClass: TacticalUnitClass,
  side: TacticalSide,
): void {
  if (unitClass === "monster" && side !== "hostile") {
    throw new RangeError("monster units must deploy on the hostile side");
  }
  if (unitClass !== "monster" && side !== "caravan") {
    throw new RangeError("guard and skirmisher units must deploy on the caravan side");
  }
}

function assertSource(source: TacticalUnitSource): void {
  if (
    source.kind !== "caravan-member" &&
    source.kind !== "persistent-creature"
  ) {
    throw new RangeError(
      "source.kind must be caravan-member or persistent-creature",
    );
  }
  assertNonEmptyString(source.id, "source.id");
}

function assertSide(side: TacticalSide): void {
  if (side !== "caravan" && side !== "hostile") {
    throw new RangeError("side must be caravan or hostile");
  }
}

function assertUnitClass(unitClass: TacticalUnitClass): void {
  if (
    unitClass !== "guard" &&
    unitClass !== "skirmisher" &&
    unitClass !== "monster"
  ) {
    throw new RangeError("unitClass must be guard, skirmisher or monster");
  }
}

function assertNonEmptyString(value: string, name: string): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
}
