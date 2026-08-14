export type CaravanActivity = "moving" | "idle";
export type SupplyDepletionCause = "food" | "water" | "both" | null;

export interface SupplyStock {
  readonly foodUnits: number;
  readonly waterUnits: number;
}

export interface ConsumptionRate {
  readonly foodUnitsPerHour: number;
  readonly waterUnitsPerHour: number;
}

export interface ConsumptionProfile {
  readonly moving: ConsumptionRate;
  readonly idle: ConsumptionRate;
}

export interface SupplyProjection {
  readonly activity: CaravanActivity;
  readonly elapsedSeconds: number;
  readonly foodConsumed: number;
  readonly waterConsumed: number;
  readonly foodRemaining: number;
  readonly waterRemaining: number;
  readonly firstDepletionAtSeconds: number | null;
  readonly depletionCause: SupplyDepletionCause;
  readonly depleted: boolean;
}

/**
 * SIM-006 — прогноз запасов для одного непрерывного режима активности.
 *
 * Время здесь является временем симуляции. Связь "игровое время ↔ реальное время"
 * будет отдельным слоем и не должна влиять на базовую математику расхода.
 *
 * Для MVP истощение любого критического ресурса считается фатальным событием.
 * Позже вместо мгновенной смерти можно будет добавить стадии голода/обезвоживания.
 */
export function projectSupplies(
  initial: SupplyStock,
  profile: ConsumptionProfile,
  activity: CaravanActivity,
  elapsedSeconds: number,
): SupplyProjection {
  assertStock(initial);
  assertProfile(profile);
  assertNonNegativeFinite(elapsedSeconds, "elapsedSeconds");

  const rate = profile[activity];
  const elapsedHours = elapsedSeconds / 3_600;
  const foodConsumed = rate.foodUnitsPerHour * elapsedHours;
  const waterConsumed = rate.waterUnitsPerHour * elapsedHours;
  const first = timeToFirstDepletion(initial, profile, activity);

  return {
    activity,
    elapsedSeconds,
    foodConsumed: Math.min(initial.foodUnits, foodConsumed),
    waterConsumed: Math.min(initial.waterUnits, waterConsumed),
    foodRemaining: Math.max(0, initial.foodUnits - foodConsumed),
    waterRemaining: Math.max(0, initial.waterUnits - waterConsumed),
    firstDepletionAtSeconds: first.atSeconds,
    depletionCause: first.cause,
    depleted: first.atSeconds !== null && elapsedSeconds >= first.atSeconds,
  };
}

export interface FirstDepletion {
  readonly atSeconds: number | null;
  readonly cause: SupplyDepletionCause;
}

/**
 * Возвращает точное время, когда первым закончится food/water при неизменном режиме.
 * null означает, что при данных расходах оба запаса неограниченно долго остаются > 0.
 */
export function timeToFirstDepletion(
  initial: SupplyStock,
  profile: ConsumptionProfile,
  activity: CaravanActivity,
): FirstDepletion {
  assertStock(initial);
  assertProfile(profile);

  const rate = profile[activity];
  const foodHours = depletionHours(initial.foodUnits, rate.foodUnitsPerHour);
  const waterHours = depletionHours(initial.waterUnits, rate.waterUnitsPerHour);

  if (foodHours === Infinity && waterHours === Infinity) {
    return { atSeconds: null, cause: null };
  }

  const epsilonHours = 1e-12;
  if (Math.abs(foodHours - waterHours) <= epsilonHours) {
    return {
      atSeconds: foodHours * 3_600,
      cause: "both",
    };
  }

  if (foodHours < waterHours) {
    return {
      atSeconds: foodHours * 3_600,
      cause: "food",
    };
  }

  return {
    atSeconds: waterHours * 3_600,
    cause: "water",
  };
}

export function canSurviveDuration(
  initial: SupplyStock,
  profile: ConsumptionProfile,
  activity: CaravanActivity,
  durationSeconds: number,
): boolean {
  return !projectSupplies(initial, profile, activity, durationSeconds).depleted;
}

function depletionHours(stock: number, ratePerHour: number): number {
  if (stock === 0) {
    return 0;
  }
  if (ratePerHour === 0) {
    return Infinity;
  }
  return stock / ratePerHour;
}

function assertStock(stock: SupplyStock): void {
  assertNonNegativeFinite(stock.foodUnits, "foodUnits");
  assertNonNegativeFinite(stock.waterUnits, "waterUnits");
}

function assertProfile(profile: ConsumptionProfile): void {
  assertRate(profile.moving, "moving");
  assertRate(profile.idle, "idle");
}

function assertRate(rate: ConsumptionRate, prefix: string): void {
  assertNonNegativeFinite(rate.foodUnitsPerHour, `${prefix}.foodUnitsPerHour`);
  assertNonNegativeFinite(rate.waterUnitsPerHour, `${prefix}.waterUnitsPerHour`);
}

function assertNonNegativeFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative finite number`);
  }
}
