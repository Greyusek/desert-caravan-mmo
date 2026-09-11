// @ts-check

export const TRADE_GOOD_LABELS = Object.freeze({
  food: "Еда",
  water: "Вода",
  salt: "Соль",
  textiles: "Ткани",
  ore: "Руда",
  medicine: "Лекарства",
  tools: "Инструменты",
});

/**
 * PLAYER-CITY-001 keeps transaction authority in the session projection. The
 * browser only joins projected rows to the exact actions that the server says
 * are currently legal.
 * @param {import("../sim-core/dist/src/index.js").PlayerSessionView} view
 */
export function createCityScreenState(view) {
  if (!view.city) throw new RangeError("city screen requires a current city");
  const actions = view.availableActions;
  const market = view.city.market.map((quote) => ({
    ...quote,
    label: TRADE_GOOD_LABELS[quote.goodId],
    buyAction:
      actions.find(
        (action) =>
          action.kind === "BUY_GOOD" && action.goodId === quote.goodId,
      ) ?? null,
    sellAction:
      actions.find(
        (action) =>
          action.kind === "SELL_GOOD" && action.goodId === quote.goodId,
      ) ?? null,
  }));
  const bundles = view.city.library.carriedBundles.map((bundle) => ({
    ...bundle,
    action:
      actions.find(
        (action) =>
          action.kind === "SELL_INFORMATION" &&
          action.bundleRef === bundle.ref,
      ) ?? null,
  }));

  return deepFreeze({
    name: view.city.name,
    credits: view.caravan.credits,
    cargo: { ...view.caravan.cargo },
    market,
    library: {
      archiveEntryCount: view.city.library.archiveEntryCount,
      acceptedBundleCount: view.city.library.acceptedBundleCount,
      bundles,
    },
  });
}

/** @template T @param {T} value @returns {T} */
function deepFreeze(value) {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
