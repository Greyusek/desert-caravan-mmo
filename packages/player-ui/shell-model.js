// @ts-check

export const PLAYER_SCREEN_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: "global",
    shortLabel: "Карта",
    title: "Карта и караван",
    kicker: "Главный обзор",
    description:
      "Известный мир, состояние каравана и маршрут будут собраны здесь.",
  }),
  Object.freeze({
    id: "city",
    shortLabel: "Город",
    title: "Город",
    kicker: "Местные службы",
    description:
      "Рынок, библиотека и городские операции появятся в отдельном экране.",
  }),
  Object.freeze({
    id: "preparation",
    shortLabel: "Караван",
    title: "Подготовка каравана",
    kicker: "Состав и построение",
    description:
      "Участники, припасы, груз и тактическое построение будут доступны здесь.",
  }),
  Object.freeze({
    id: "battle",
    shortLabel: "Бой",
    title: "Сражение",
    kicker: "Тактическая сцена",
    description:
      "Экран откроется только после обнаруженного контакта.",
  }),
  Object.freeze({
    id: "result",
    shortLabel: "Итоги",
    title: "Итоги сражения",
    kicker: "Последствия",
    description:
      "Потери, выжившие и состояние груза появятся после завершения боя.",
  }),
]);

/**
 * Builds top-level navigation strictly from the allow-listed player view.
 * The browser may choose presentation state, but cannot make a screen available.
 * @param {import("../sim-core/dist/src/index.js").PlayerSessionView} view
 * @param {string} [requestedScreenId]
 */
export function createPlayerShellState(view, requestedScreenId = "global") {
  assertPlayerView(view);
  const projectedById = new Map(
    view.screens.map((screen) => [screen.id, screen]),
  );
  const screens = PLAYER_SCREEN_DEFINITIONS.map((definition) => {
    const projected = projectedById.get(definition.id);
    if (!projected) {
      throw new RangeError(`player view is missing screen: ${definition.id}`);
    }
    return {
      ...definition,
      available: projected.available,
      reason: projected.reason ?? null,
    };
  });
  const active = screens.find((screen) => screen.id === requestedScreenId);
  if (!active) {
    throw new RangeError(`unknown player screen: ${requestedScreenId}`);
  }
  if (!active.available) {
    throw new RangeError(`player screen is unavailable: ${requestedScreenId}`);
  }

  return deepFreeze({
    activeScreenId: active.id,
    activeScreen: active,
    screens,
  });
}

/** @param {unknown} view */
function assertPlayerView(view) {
  if (!view || typeof view !== "object" || !("screens" in view)) {
    throw new TypeError("player view must contain screens");
  }
  if (!Array.isArray(view.screens)) {
    throw new TypeError("player view screens must be an array");
  }
}

/** @template T @param {T} value @returns {T} */
function deepFreeze(value) {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
