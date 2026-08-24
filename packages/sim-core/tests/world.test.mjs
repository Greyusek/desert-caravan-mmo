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

test("WORLD-001 regression: checkpoint-04 cities remain byte-for-byte unchanged", () => {
  assert.deepEqual(generateSeededWorld("checkpoint-04").cities, [
    { id: "city-01", name: "City 01", position: { latitudeDeg: -4.9886436108499765, longitudeDeg: -112.71229491569102 } },
    { id: "city-02", name: "City 02", position: { latitudeDeg: -62.08030313253403, longitudeDeg: -152.93743665330112 } },
    { id: "city-03", name: "City 03", position: { latitudeDeg: 26.8979942984879, longitudeDeg: 21.98156788945198 } },
    { id: "city-04", name: "City 04", position: { latitudeDeg: -7.054517399519682, longitudeDeg: -8.84978343732655 } },
    { id: "city-05", name: "City 05", position: { latitudeDeg: -54.425721410661936, longitudeDeg: 94.19229051098228 } },
    { id: "city-06", name: "City 06", position: { latitudeDeg: 4.418185357935727, longitudeDeg: 27.374193035066128 } },
    { id: "city-07", name: "City 07", position: { latitudeDeg: -36.17162230890244, longitudeDeg: -174.4525520503521 } },
    { id: "city-08", name: "City 08", position: { latitudeDeg: 28.823321391828358, longitudeDeg: -175.74089507572353 } },
    { id: "city-09", name: "City 09", position: { latitudeDeg: -61.59539188724011, longitudeDeg: -47.74490254931152 } },
    { id: "city-10", name: "City 10", position: { latitudeDeg: -54.359261519275606, longitudeDeg: -147.86182422190905 } },
  ]);
});

test("CITY-001: every city has finite food and water stocks", () => {
  const world = generateSeededWorld("city-stocks");

  assert.equal(world.cityStocks.length, world.cities.length);
  assert.deepEqual(
    world.cityStocks.map(({ cityId }) => cityId),
    world.cities.map(({ id }) => id),
  );
  for (const stocks of world.cityStocks) {
    assert.ok(Number.isSafeInteger(stocks.foodUnits));
    assert.ok(Number.isSafeInteger(stocks.waterUnits));
    assert.ok(stocks.foodUnits >= 10_000 && stocks.foodUnits <= 50_000);
    assert.ok(stocks.waterUnits >= 10_000 && stocks.waterUnits <= 50_000);
  }
});

test("CITY-001: the same seed reproduces city stocks and another seed changes them", () => {
  const first = generateSeededWorld("repeatable-city-stocks").cityStocks;
  assert.deepEqual(
    first,
    generateSeededWorld("repeatable-city-stocks").cityStocks,
  );
  assert.notDeepEqual(
    first,
    generateSeededWorld("other-city-stocks").cityStocks,
  );
});

test("CITY-001: changing city count does not perturb existing city stocks", () => {
  const small = generateSeededWorld("stable-city-stocks", {
    cityCount: 3,
  }).cityStocks;
  const large = generateSeededWorld("stable-city-stocks", {
    cityCount: 20,
  }).cityStocks;

  assert.deepEqual(small, large.slice(0, 3));
});

test("WORLD-002: the default world contains one object of every kind in fixed order", () => {
  const objects = generateSeededWorld("mvp-world").staticObjects;
  assert.equal(objects.length, 4);
  assert.deepEqual(objects.map(({ id, kind }) => ({ id, kind })), [
    { id: "oasis-01", kind: "oasis" },
    { id: "mine-01", kind: "mine" },
    { id: "ruins-01", kind: "ruins" },
    { id: "cave-01", kind: "cave" },
  ]);
  assert.equal(new Set(objects.map(({ id }) => id)).size, objects.length);
});

test("WORLD-002: static object coordinates stay in safe ranges", () => {
  const objects = generateSeededWorld("coordinate-check", {
    staticObjectCounts: { oasis: 3, mine: 2, ruins: 4, cave: 2 },
  }).staticObjects;
  for (const object of objects) {
    assert.ok(object.position.latitudeDeg >= -70 && object.position.latitudeDeg < 70);
    assert.ok(object.position.longitudeDeg >= -180 && object.position.longitudeDeg < 180);
  }
});

test("WORLD-002: the same seed and options reproduce the complete object list", () => {
  const options = { staticObjectCounts: { oasis: 2, cave: 0 } };
  assert.deepEqual(
    generateSeededWorld("repeatable-objects", options).staticObjects,
    generateSeededWorld("repeatable-objects", options).staticObjects,
  );
});

test("WORLD-002: different seeds change static object positions", () => {
  assert.notDeepEqual(
    generateSeededWorld("objects-a").staticObjects.map(({ position }) => position),
    generateSeededWorld("objects-b").staticObjects.map(({ position }) => position),
  );
});

test("WORLD-002: partial counts configure only specified kinds and allow zero", () => {
  const objects = generateSeededWorld("counts", {
    staticObjectCounts: { oasis: 0, mine: 3 },
  }).staticObjects;
  assert.deepEqual(objects.map(({ id }) => id), [
    "mine-01", "mine-02", "mine-03", "ruins-01", "cave-01",
  ]);
});

test("WORLD-002: invalid static object counts are rejected", () => {
  for (const value of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(
      () => generateSeededWorld("invalid-count", { staticObjectCounts: { oasis: value } }),
      /staticObjectCounts\.oasis must be a non-negative safe integer/,
    );
  }
});

test("WORLD-002: changing city count does not move static objects", () => {
  assert.deepEqual(
    generateSeededWorld("independent-cities", { cityCount: 1 }).staticObjects,
    generateSeededWorld("independent-cities", { cityCount: 20 }).staticObjects,
  );
});

test("WORLD-002: changing oasis count does not move other object kinds", () => {
  const withoutOases = generateSeededWorld("independent-kinds", {
    staticObjectCounts: { oasis: 0 },
  }).staticObjects;
  const manyOases = generateSeededWorld("independent-kinds", {
    staticObjectCounts: { oasis: 10 },
  }).staticObjects;
  assert.deepEqual(
    withoutOases.filter(({ kind }) => kind !== "oasis"),
    manyOases.filter(({ kind }) => kind !== "oasis"),
  );
});

test("WORLD-002 regression: checkpoint-04 static objects have golden values", () => {
  assert.deepEqual(generateSeededWorld("checkpoint-04").staticObjects, [
    { id: "oasis-01", kind: "oasis", position: { latitudeDeg: 12.948625972494483, longitudeDeg: -142.220398792997 } },
    { id: "mine-01", kind: "mine", position: { latitudeDeg: 66.41580770723522, longitudeDeg: -103.00649561919272 } },
    { id: "ruins-01", kind: "ruins", position: { latitudeDeg: 26.757069225423038, longitudeDeg: 153.90484163537621 } },
    { id: "cave-01", kind: "cave", position: { latitudeDeg: 45.453553572297096, longitudeDeg: 124.01533710770309 } },
  ]);
});
