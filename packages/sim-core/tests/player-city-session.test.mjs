import assert from "node:assert/strict";
import test from "node:test";

import { createPlayerSessionController } from "../dist/src/index.js";

const CITY_SEED = "player-city-test";

test("PLAYER-CITY-001: city projects owned goods, physical information and local values", () => {
  const view = createPlayerSessionController(CITY_SEED).getView();

  assert.ok(view.city);
  assert.equal(view.city.market.length, 7);
  assert.equal(
    view.city.market.find((good) => good.goodId === "ore")?.ownedUnits,
    5,
  );
  assert.deepEqual(view.city.library, {
    archiveEntryCount: 0,
    acceptedBundleCount: 0,
    carriedBundles: [
      {
        ref: "bundle:field-notes",
        title: "Caravan trail field notes",
        entryCount: 1,
        evidenceKind: "caravan-track",
        provenance: "direct-observation",
        confidence: "confirmed",
        fidelityPercent: 100,
        localValueCredits: 56,
      },
    ],
  });
});

test("PLAYER-CITY-001: one-unit purchase uses the authoritative market and updates every projection", () => {
  const controller = createPlayerSessionController(CITY_SEED);
  const initial = controller.getView();
  const action = initial.availableActions.find(
    (candidate) =>
      candidate.kind === "BUY_GOOD" && candidate.goodId === "food",
  );
  assert.ok(action);
  const initialGood = initial.city?.market.find(
    (good) => good.goodId === "food",
  );
  assert.ok(initialGood);

  const updated = controller.dispatch(action).getView();
  const updatedGood = updated.city?.market.find(
    (good) => good.goodId === "food",
  );
  assert.ok(updatedGood);
  assert.equal(updated.revision, 1);
  assert.equal(updated.caravan.credits, initial.caravan.credits - action.totalCredits);
  assert.equal(updatedGood.stockUnits, initialGood.stockUnits - 1);
  assert.equal(updatedGood.ownedUnits, 1);
  assert.equal(updated.journal.at(-1)?.kind, "market-purchase");
});

test("PLAYER-CITY-001: one-unit sale uses owned physical cargo", () => {
  const controller = createPlayerSessionController(CITY_SEED);
  const initial = controller.getView();
  const action = initial.availableActions.find(
    (candidate) =>
      candidate.kind === "SELL_GOOD" && candidate.goodId === "ore",
  );
  assert.ok(action);
  const initialOre = initial.city?.market.find(
    (good) => good.goodId === "ore",
  );
  assert.ok(initialOre);

  const updated = controller.dispatch(action).getView();
  const updatedOre = updated.city?.market.find(
    (good) => good.goodId === "ore",
  );
  assert.ok(updatedOre);
  assert.equal(updated.caravan.credits, initial.caravan.credits + action.totalCredits);
  assert.equal(updatedOre.stockUnits, initialOre.stockUnits + 1);
  assert.equal(updatedOre.ownedUnits, initialOre.ownedUnits - 1);
  assert.equal(updated.journal.at(-1)?.kind, "market-sale");
});

test("PLAYER-CITY-001: information sale deposits one physical bundle and pays once", () => {
  const controller = createPlayerSessionController(CITY_SEED);
  const initial = controller.getView();
  const action = initial.availableActions.find(
    (candidate) => candidate.kind === "SELL_INFORMATION",
  );
  assert.ok(action);

  const acceptedController = controller.dispatch(action);
  const accepted = acceptedController.getView();
  assert.equal(accepted.caravan.credits, initial.caravan.credits + action.totalCredits);
  assert.equal(accepted.city?.library.archiveEntryCount, 1);
  assert.equal(accepted.city?.library.acceptedBundleCount, 1);
  assert.deepEqual(accepted.city?.library.carriedBundles, []);
  assert.equal(accepted.journal.at(-1)?.kind, "information-sale");
  assert.equal(
    accepted.availableActions.some(
      (candidate) => candidate.kind === "SELL_INFORMATION",
    ),
    false,
  );
  assert.throws(
    () => acceptedController.dispatch(action),
    /information bundle is not carried/,
  );
});

test("PLAYER-CITY-001: invalid and travelling city operations are rejected", () => {
  const controller = createPlayerSessionController(CITY_SEED);
  assert.throws(
    () =>
      controller.dispatch({ kind: "BUY_GOOD", goodId: "food", units: 0 }),
    /positive safe integer/,
  );
  assert.throws(
    () =>
      controller.dispatch({
        kind: "SELL_INFORMATION",
        bundleRef: "bundle:unknown",
      }),
    /not carried/,
  );
  const travelling = controller
    .dispatch({
      kind: "SELECT_DESTINATION",
      destinationRef: "place:north-camp",
    })
    .dispatch({ kind: "START_JOURNEY" });
  assert.throws(
    () => travelling.dispatch({ kind: "SELL_GOOD", goodId: "ore", units: 1 }),
    /requires a caravan in the city/,
  );
  assert.equal(controller.getView().revision, 0);
});

test("PLAYER-CITY-001: city payload exposes no formula inputs or internal information IDs", () => {
  const payload = JSON.stringify(createPlayerSessionController(CITY_SEED).getView());
  for (const forbidden of [
    CITY_SEED,
    "cityId",
    "bundleId",
    "sourceEvidenceId",
    "scarcityMultiplier",
    "costBasisCredits",
    "targetStockUnits",
    "latitudeDeg",
    "longitudeDeg",
  ]) {
    assert.equal(payload.includes(forbidden), false, forbidden);
  }
});
