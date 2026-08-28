export type TacticalSide = "caravan" | "hostile";

export interface TacticalCell {
  readonly x: number;
  readonly y: number;
}

export interface TacticalDeploymentZone {
  readonly side: TacticalSide;
  readonly minX: number;
  readonly maxX: number;
  readonly cells: readonly TacticalCell[];
}

export interface TacticalBattlefield {
  readonly id: string;
  readonly seed: string;
  readonly width: number;
  readonly height: number;
  readonly deploymentDepth: number;
  readonly deploymentZones: Readonly<Record<TacticalSide, TacticalDeploymentZone>>;
}

export interface TacticalBattlefieldConfig {
  readonly width?: number;
  readonly height?: number;
  readonly deploymentDepth?: number;
}

export const DEFAULT_TACTICAL_BATTLEFIELD_WIDTH = 12;
export const DEFAULT_TACTICAL_BATTLEFIELD_HEIGHT = 8;
export const DEFAULT_TACTICAL_DEPLOYMENT_DEPTH = 2;

/** TACTICAL-001 — creates terrain-free, server-authoritative battle geometry. */
export function createTacticalBattlefield(
  seed: string,
  config: TacticalBattlefieldConfig = {},
): TacticalBattlefield {
  assertNonEmptyString(seed, "seed");
  const width = config.width ?? DEFAULT_TACTICAL_BATTLEFIELD_WIDTH;
  const height = config.height ?? DEFAULT_TACTICAL_BATTLEFIELD_HEIGHT;
  const deploymentDepth =
    config.deploymentDepth ?? DEFAULT_TACTICAL_DEPLOYMENT_DEPTH;
  assertPositiveInteger(width, "width");
  assertPositiveInteger(height, "height");
  assertPositiveInteger(deploymentDepth, "deploymentDepth");
  if (width < deploymentDepth * 2 + 1) {
    throw new RangeError(
      "width must leave at least one neutral column between deployment zones",
    );
  }

  return {
    id: `battlefield-${hashSeed(seed).toString(16).padStart(8, "0")}`,
    seed,
    width,
    height,
    deploymentDepth,
    deploymentZones: {
      caravan: createDeploymentZone("caravan", 0, deploymentDepth - 1, height),
      hostile: createDeploymentZone(
        "hostile",
        width - deploymentDepth,
        width - 1,
        height,
      ),
    },
  };
}

export function createTacticalCell(x: number, y: number): TacticalCell {
  assertNonNegativeInteger(x, "x");
  assertNonNegativeInteger(y, "y");
  return { x, y };
}

export function isCellInsideBattlefield(
  battlefield: TacticalBattlefield,
  cell: TacticalCell,
): boolean {
  assertBattlefieldShape(battlefield);
  assertInteger(cell.x, "cell.x");
  assertInteger(cell.y, "cell.y");
  return (
    cell.x >= 0 &&
    cell.x < battlefield.width &&
    cell.y >= 0 &&
    cell.y < battlefield.height
  );
}

export function isCellInDeploymentZone(
  battlefield: TacticalBattlefield,
  side: TacticalSide,
  cell: TacticalCell,
): boolean {
  if (side !== "caravan" && side !== "hostile") {
    throw new RangeError("side must be caravan or hostile");
  }
  if (!isCellInsideBattlefield(battlefield, cell)) return false;
  const zone = battlefield.deploymentZones[side];
  return cell.x >= zone.minX && cell.x <= zone.maxX;
}

function createDeploymentZone(
  side: TacticalSide,
  minX: number,
  maxX: number,
  height: number,
): TacticalDeploymentZone {
  const cells: TacticalCell[] = [];
  for (let x = minX; x <= maxX; x += 1) {
    for (let y = 0; y < height; y += 1) cells.push({ x, y });
  }
  return { side, minX, maxX, cells };
}

function assertBattlefieldShape(battlefield: TacticalBattlefield): void {
  assertPositiveInteger(battlefield.width, "battlefield.width");
  assertPositiveInteger(battlefield.height, "battlefield.height");
}

function assertPositiveInteger(value: number, name: string): void {
  assertInteger(value, name);
  if (value <= 0) throw new RangeError(`${name} must be positive`);
}

function assertNonNegativeInteger(value: number, name: string): void {
  assertInteger(value, name);
  if (value < 0) throw new RangeError(`${name} must be non-negative`);
}

function assertInteger(value: number, name: string): void {
  if (!Number.isInteger(value)) throw new TypeError(`${name} must be an integer`);
}

function assertNonEmptyString(value: string, name: string): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
}

function hashSeed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
