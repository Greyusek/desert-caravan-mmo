import test from "node:test";
import assert from "node:assert/strict";
import { generateSeededWorld } from "../dist/src/index.js";

test("WORLD-001: the default world contains ten cities", () => {
  const world = generateSeededWorld("mvp-world");

  assert.equal(world.seed, "mvp-world");
  assert.equal(world.cities.length, 10);
  assert.equal(new Set(world.cities.map((city) => city.id)).size, 10);
});

test("WORLD-001: the same seed reproduces the complete city list", () => {
  assert.deepEqual(
    generateSeededWorld("repeatable-desert"),
    generateSeededWorld("repeatable-desert"),
  );
});

test("WORLD-001: different seeds produce different city positions", () => {
  const first = generateSeededWorld("world-a");
  const second = generateSeededWorld("world-b");

  assert.notDeepEqual(first.cities.map((city) => city.position), second.cities.map((city) => city.position));
});

test("WORLD-001: generated cities have stable identities and valid coordinates", () => {
  const world = generateSeededWorld("coordinate-check");

  for (const [index, city] of world.cities.entries()) {
    assert.equal(city.id, `city-${String(index + 1).padStart(2, "0")}`);
    assert.equal(city.name, `City ${String(index + 1).padStart(2, "0")}`);
    assert.ok(city.position.latitudeDeg >= -70 && city.position.latitudeDeg < 70);
    assert.ok(city.position.longitudeDeg >= -180 && city.position.longitudeDeg < 180);
  }
});

test("WORLD-001: city count is configurable for focused simulations", () => {
  assert.equal(generateSeededWorld("small-world", { cityCount: 3 }).cities.length, 3);
});

test("WORLD-001: invalid seed and city count are rejected", () => {
  assert.throws(() => generateSeededWorld(""), /seed must not be empty/);
  assert.throws(() => generateSeededWorld("world", { cityCount: 0 }), /positive safe integer/);
  assert.throws(() => generateSeededWorld("world", { cityCount: 1.5 }), /positive safe integer/);
});
