import test from "node:test";
import assert from "node:assert/strict";
import {
  createWorldCoordinate,
  kilometers,
  normalizeBearing,
  normalizeLongitude,
} from "../dist/src/index.js";

test("SIM-001: bearing is normalized to [0, 360)", () => {
  assert.equal(normalizeBearing(360), 0);
  assert.equal(normalizeBearing(721), 1);
  assert.equal(normalizeBearing(-10), 350);
});

test("SIM-001: longitude is normalized to [-180, 180)", () => {
  assert.equal(normalizeLongitude(181), -179);
  assert.equal(normalizeLongitude(-181), 179);
  assert.equal(normalizeLongitude(540), -180);
});

test("SIM-001: coordinate validates latitude and normalizes longitude", () => {
  const coordinate = createWorldCoordinate(55.755864, 397.617698);
  assert.equal(coordinate.latitudeDeg, 55.755864);
  assert.ok(Math.abs(coordinate.longitudeDeg - 37.617698) < 1e-12);

  assert.throws(() => createWorldCoordinate(90.000001, 0), RangeError);
  assert.throws(() => createWorldCoordinate(Number.NaN, 0), TypeError);
});

test("SIM-001: kilometers are converted to meters", () => {
  assert.equal(kilometers(100), 100_000);
  assert.throws(() => kilometers(-1), RangeError);
});
