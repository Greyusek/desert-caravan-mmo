import assert from "node:assert/strict";
import test from "node:test";

import { createPlayerSessionController } from "../../sim-core/dist/src/index.js";
import { createCityScreenState } from "../city-model.js";

const view = createPlayerSessionController("player-city-model-test").getView();

test("PLAYER-CITY-001 UI: market rows join only projected server actions", () => {
  const city = createCityScreenState(view);

  assert.equal(city.market.length, 7);
  assert.equal(city.market.find((good) => good.goodId === "food")?.label, "Еда");
  assert.equal(city.market.find((good) => good.goodId === "ore")?.ownedUnits, 5);
  assert.equal(city.market.find((good) => good.goodId === "food")?.buyAction?.units, 1);
  assert.equal(city.market.find((good) => good.goodId === "food")?.sellAction, null);
  assert.equal(city.market.find((good) => good.goodId === "ore")?.sellAction?.units, 1);
});

test("PLAYER-CITY-001 UI: physical bundle keeps its projected local valuation action", () => {
  const city = createCityScreenState(view);
  const bundle = city.library.bundles[0];

  assert.ok(bundle);
  assert.equal(bundle.provenance, "direct-observation");
  assert.equal(bundle.confidence, "confirmed");
  assert.equal(bundle.localValueCredits, bundle.action?.totalCredits);
  assert.equal(bundle.action?.kind, "SELL_INFORMATION");
});

test("PLAYER-CITY-001 UI: unavailable city cannot be reconstructed in the browser", () => {
  const travelling = createPlayerSessionController("player-city-model-test")
    .dispatch({
      kind: "SELECT_DESTINATION",
      destinationRef: "place:north-camp",
    })
    .dispatch({ kind: "START_JOURNEY" })
    .getView();

  assert.throws(() => createCityScreenState(travelling), /requires a current city/);
  assert.equal(Object.isFrozen(createCityScreenState(view)), true);
});
