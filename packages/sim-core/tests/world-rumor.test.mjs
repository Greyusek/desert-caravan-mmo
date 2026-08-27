import test from "node:test";
import assert from "node:assert/strict";
import {
  createWorldRumor,
  rumorAge,
  rumorQuality,
} from "../dist/src/index.js";

function input(facts, overrides = {}) {
  return {
    worldSeed: "rumor-world",
    originCityId: "city-a",
    subjectId: `subject-${facts.type}`,
    observedAtWorldTimeSeconds: 100,
    createdAtWorldTimeSeconds: 200,
    sourceEvidenceIds: ["source-a"],
    sourceConfidence: "probable",
    facts,
    ...overrides,
  };
}

test("HISTORY-001: supports four coordinate-free rumor types", () => {
  const facts = [
    {
      type: "caravan-passage",
      direction: "east",
      trackAge: "fresh",
    },
    { type: "caravan-loss", condition: "weathered" },
    {
      type: "creature-sighting",
      direction: "northwest",
      strength: "dangerous",
    },
    { type: "fallen-library", readability: "fragmentary" },
  ];
  const rumors = facts.map((item) => createWorldRumor(input(item)));
  assert.deepEqual(
    rumors.map((rumor) => rumor.type),
    [
      "caravan-passage",
      "caravan-loss",
      "creature-sighting",
      "fallen-library",
    ],
  );
  assert.ok(
    rumors.every(
      (rumor) =>
        !JSON.stringify(rumor).includes("latitude") &&
        !JSON.stringify(rumor).includes("longitude"),
    ),
  );
});

test("HISTORY-001: quality rises with confidence and independent sources", () => {
  assert.equal(rumorQuality("probable", 1), "unverified");
  assert.equal(rumorQuality("probable", 2), "rough");
  assert.equal(rumorQuality("probable", 3), "reliable");
  assert.equal(rumorQuality("confirmed", 1), "reliable");
  assert.equal(rumorQuality("confirmed", 2), "corroborated");
});

test("HISTORY-001: rumor age is approximate rather than exact observation time", () => {
  assert.equal(rumorAge(0), "fresh");
  assert.equal(rumorAge(3_600), "recent");
  assert.equal(rumorAge(86_400), "old");
  assert.equal(rumorAge(30 * 86_400), "ancient");
  const rumor = createWorldRumor(
    input({ type: "caravan-loss", condition: "fresh" }),
  );
  assert.equal(rumor.approximateAge, "fresh");
  assert.equal("observedAtWorldTimeSeconds" in rumor, false);
});

test("HISTORY-001: identical inputs reproduce rumor identity and content", () => {
  const rumorInput = input(
    { type: "fallen-library", readability: "clear" },
    {
      sourceConfidence: "confirmed",
      sourceEvidenceIds: ["source-b", "source-a"],
    },
  );
  assert.deepEqual(createWorldRumor(rumorInput), createWorldRumor(rumorInput));
  assert.equal(createWorldRumor(rumorInput).quality, "corroborated");
});

test("HISTORY-001: source order does not change the deterministic rumor", () => {
  const facts = {
    type: "creature-sighting",
    direction: "south",
    strength: "overwhelming",
  };
  const first = createWorldRumor(
    input(facts, { sourceEvidenceIds: ["source-a", "source-b"] }),
  );
  const reversed = createWorldRumor(
    input(facts, { sourceEvidenceIds: ["source-b", "source-a"] }),
  );
  assert.deepEqual(reversed, first);
});

test("HISTORY-001: chronology, sources and quality inputs are validated", () => {
  const facts = { type: "caravan-loss", condition: "fresh" };
  assert.throws(
    () =>
      createWorldRumor(
        input(facts, {
          observedAtWorldTimeSeconds: 201,
          createdAtWorldTimeSeconds: 200,
        }),
      ),
    /must not precede observation/,
  );
  assert.throws(
    () => createWorldRumor(input(facts, { sourceEvidenceIds: [] })),
    /must contain at least one source/,
  );
  assert.throws(
    () => rumorQuality("probable", 0),
    /positive safe integer/,
  );
  assert.throws(() => rumorAge(-1), /non-negative finite number/);
});
