import {
  isCellInDeploymentZone,
  type TacticalBattlefield,
  type TacticalCell,
  type TacticalSide,
} from "./tactical-battlefield.js";
import type { TacticalUnit } from "./tactical-unit.js";
import {
  usedCargoCapacity,
  type TradeCargoHold,
  type TradeCargoStack,
} from "./trade-route.js";

export interface TacticalBaggageUnit {
  readonly id: string;
  readonly side: "caravan";
  readonly position: TacticalCell;
  readonly durability: number;
  readonly maxDurability: number;
  readonly cargoStack: TradeCargoStack;
}

export interface TacticalCargoDeployment {
  readonly sourceCapacityCargoUnits: number;
  readonly sourceUsedCargoUnits: number;
  readonly baggageUnits: readonly TacticalBaggageUnit[];
}

export interface TacticalCargoConservationEntry {
  readonly goodId: TradeCargoStack["goodId"];
  readonly sourceUnits: number;
  readonly survivedUnits: number;
  readonly capturedUnits: number;
  readonly destroyedUnits: number;
  readonly conserved: boolean;
}

export interface TacticalCargoOutcome {
  readonly winner: TacticalSide;
  readonly caravanCargo: TradeCargoHold;
  readonly capturedCargo: TradeCargoHold;
  readonly destroyedStacks: readonly TradeCargoStack[];
  readonly conservation: readonly TacticalCargoConservationEntry[];
}

export const DEFAULT_TACTICAL_BAGGAGE_DURABILITY = 6;

/** TACTICAL-004 — converts each existing cargo stack into one physical unit. */
export function deployTacticalCargo(
  battlefield: TacticalBattlefield,
  cargo: TradeCargoHold,
  combatants: readonly TacticalUnit[] = [],
): TacticalCargoDeployment {
  const sourceUsedCargoUnits = usedCargoCapacity(cargo);
  const occupied = new Set(
    combatants
      .filter((unit) => unit.health > 0)
      .map((unit) => `${unit.position.x},${unit.position.y}`),
  );
  const availableCells = battlefield.deploymentZones.caravan.cells.filter(
    (cell) => !occupied.has(`${cell.x},${cell.y}`),
  );
  if (cargo.stacks.length > availableCells.length) {
    throw new RangeError("caravan deployment zone has no room for every cargo stack");
  }
  const baggageUnits = cargo.stacks.map((stack, index) => {
    const position = availableCells[index];
    if (position === undefined) throw new Error("baggage position must exist");
    if (!isCellInDeploymentZone(battlefield, "caravan", position)) {
      throw new Error("baggage must deploy inside the caravan zone");
    }
    return {
      id: `baggage-${String(index + 1).padStart(2, "0")}-${stack.goodId}`,
      side: "caravan" as const,
      position: { ...position },
      durability: DEFAULT_TACTICAL_BAGGAGE_DURABILITY,
      maxDurability: DEFAULT_TACTICAL_BAGGAGE_DURABILITY,
      cargoStack: { ...stack },
    };
  });
  return {
    sourceCapacityCargoUnits: cargo.capacityCargoUnits,
    sourceUsedCargoUnits,
    baggageUnits,
  };
}

export function damageTacticalBaggage(
  deployment: TacticalCargoDeployment,
  baggageUnitId: string,
  damage: number,
): TacticalCargoDeployment {
  if (!Number.isSafeInteger(damage) || damage <= 0) {
    throw new RangeError("baggage damage must be a positive safe integer");
  }
  const target = deployment.baggageUnits.find((unit) => unit.id === baggageUnitId);
  if (!target) throw new RangeError(`tactical baggage not found: ${baggageUnitId}`);
  if (target.durability === 0) throw new RangeError("tactical baggage is already destroyed");
  return {
    ...deployment,
    baggageUnits: deployment.baggageUnits.map((unit) =>
      unit.id === baggageUnitId
        ? { ...unit, durability: Math.max(0, unit.durability - damage) }
        : unit,
    ),
  };
}

export function resolveTacticalCargoOutcome(
  deployment: TacticalCargoDeployment,
  winner: TacticalSide,
): TacticalCargoOutcome {
  if (winner !== "caravan" && winner !== "hostile") {
    throw new RangeError("winner must be caravan or hostile");
  }
  const destroyedStacks = deployment.baggageUnits
    .filter((unit) => unit.durability === 0)
    .map((unit) => ({ ...unit.cargoStack }));
  const intactStacks = deployment.baggageUnits
    .filter((unit) => unit.durability > 0)
    .map((unit) => ({ ...unit.cargoStack }));
  const caravanStacks = winner === "caravan" ? intactStacks : [];
  const capturedStacks = winner === "hostile" ? intactStacks : [];
  const conservation = deployment.baggageUnits.map((unit) => {
    const sourceUnits = unit.cargoStack.units;
    const destroyedUnits = unit.durability === 0 ? sourceUnits : 0;
    const survivedUnits = unit.durability > 0 && winner === "caravan" ? sourceUnits : 0;
    const capturedUnits = unit.durability > 0 && winner === "hostile" ? sourceUnits : 0;
    return {
      goodId: unit.cargoStack.goodId,
      sourceUnits,
      survivedUnits,
      capturedUnits,
      destroyedUnits,
      conserved: sourceUnits === survivedUnits + capturedUnits + destroyedUnits,
    };
  });
  if (conservation.some((entry) => !entry.conserved)) {
    throw new Error("tactical cargo conservation failed");
  }
  return {
    winner,
    caravanCargo: {
      capacityCargoUnits: deployment.sourceCapacityCargoUnits,
      stacks: caravanStacks,
    },
    capturedCargo: {
      capacityCargoUnits: deployment.sourceCapacityCargoUnits,
      stacks: capturedStacks,
    },
    destroyedStacks,
    conservation,
  };
}
