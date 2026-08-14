/**
 * SIM-001 — базовые типы и единицы мира.
 *
 * Внутри simulation core:
 * - расстояния всегда в метрах;
 * - углы/координаты публичного API — в градусах;
 * - абсолютные координаты являются серверными данными и не обязаны показываться игроку.
 */

export interface WorldCoordinate {
  readonly latitudeDeg: number;
  readonly longitudeDeg: number;
}

export type DistanceMeters = number;
export type BearingDegrees = number;

/**
 * Радиус нужен только для первой математической проверки.
 * Это НЕ зафиксированный размер production-планеты.
 */
export const DEFAULT_TEST_PLANET_RADIUS_METERS = 6_371_008.8;

export function normalizeBearing(bearingDeg: number): BearingDegrees {
  assertFiniteNumber(bearingDeg, "bearingDeg");
  return ((bearingDeg % 360) + 360) % 360;
}

export function normalizeLongitude(longitudeDeg: number): number {
  assertFiniteNumber(longitudeDeg, "longitudeDeg");
  return ((longitudeDeg + 180) % 360 + 360) % 360 - 180;
}

export function createWorldCoordinate(
  latitudeDeg: number,
  longitudeDeg: number,
): WorldCoordinate {
  assertFiniteNumber(latitudeDeg, "latitudeDeg");
  assertFiniteNumber(longitudeDeg, "longitudeDeg");

  if (latitudeDeg < -90 || latitudeDeg > 90) {
    throw new RangeError("latitudeDeg must be between -90 and 90 degrees");
  }

  return {
    latitudeDeg,
    longitudeDeg: normalizeLongitude(longitudeDeg),
  };
}

export function kilometers(value: number): DistanceMeters {
  assertFiniteNumber(value, "kilometers");
  if (value < 0) {
    throw new RangeError("Distance cannot be negative");
  }
  return value * 1_000;
}

export function meters(value: number): DistanceMeters {
  assertFiniteNumber(value, "meters");
  if (value < 0) {
    throw new RangeError("Distance cannot be negative");
  }
  return value;
}

function assertFiniteNumber(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new TypeError(`${name} must be a finite number`);
  }
}
