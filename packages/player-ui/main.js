// @ts-check

import { createPlayerShellState } from "./shell-model.js";
import {
  GLOBAL_LAYER_DEFINITIONS,
  createGlobalScreenState,
} from "./global-model.js";

const navigation = requireElement("primary-navigation", HTMLElement);
const screenKicker = requireElement("screen-kicker", HTMLParagraphElement);
const screenTitle = requireElement("screen-title", HTMLHeadingElement);
const screenDescription = requireElement("screen-description", HTMLParagraphElement);
const screenState = requireElement("screen-state", HTMLSpanElement);
const locationValue = requireElement("location-value", HTMLElement);
const caravanValue = requireElement("caravan-value", HTMLElement);
const cargoValue = requireElement("cargo-value", HTMLSpanElement);
const sessionRevision = requireElement("session-revision", HTMLElement);
const loadingState = requireElement("loading-state", HTMLElement);
const workspace = requireElement("workspace", HTMLElement);
const errorState = requireElement("error-state", HTMLElement);
const errorDetail = requireElement("error-detail", HTMLElement);
const globalView = requireElement("global-view", HTMLElement);
const placeholderView = requireElement("placeholder-view", HTMLElement);
const layerControlList = requireElement("layer-control-list", HTMLElement);
const knownMap = requireElement("known-map", SVGSVGElement);
const mapCaption = requireElement("map-caption", HTMLParagraphElement);
const routeDestination = requireElement("route-destination", HTMLSelectElement);
const routeAction = requireElement("route-action", HTMLButtonElement);
const routeActionStatus = requireElement("route-action-status", HTMLParagraphElement);
const foodValue = requireElement("food-value", HTMLElement);
const waterValue = requireElement("water-value", HTMLElement);
const memberValue = requireElement("member-value", HTMLElement);
const speedValue = requireElement("speed-value", HTMLElement);
const distanceValue = requireElement("distance-value", HTMLElement);
const etaValue = requireElement("eta-value", HTMLElement);
const warningList = requireElement("warning-list", HTMLElement);
const journalPanel = requireElement("journal-panel", HTMLDetailsElement);
const journalCount = requireElement("journal-count", HTMLOutputElement);
const journalList = requireElement("journal-list", HTMLOListElement);
const mapLayerRoutes = requireElement("map-layer-routes", SVGElement);
const mapLayerCities = requireElement("map-layer-cities", SVGElement);
const mapLayerObjects = requireElement("map-layer-objects", SVGElement);
const mapLayerIntelligence = requireElement("map-layer-intelligence", SVGElement);
const mapLayerEvents = requireElement("map-layer-events", SVGElement);
const mapLayerCaravan = requireElement("map-layer-caravan", SVGElement);

const PLAYER_SESSION_TIMEOUT_MS = 8_000;

/** @type {import("../sim-core/dist/src/index.js").PlayerSessionView | null} */
let playerView = null;
let activeScreenId = "global";
const visibleLayerIds = new Set(
  GLOBAL_LAYER_DEFINITIONS.map((layer) => layer.id),
);

loadPlayerView();

async function loadPlayerView() {
  const abortController = new AbortController();
  const requestTimeout = window.setTimeout(
    () => abortController.abort(),
    PLAYER_SESSION_TIMEOUT_MS,
  );
  try {
    const response = await fetch("/api/player-session", {
      headers: { Accept: "application/json" },
      signal: abortController.signal,
    });
    if (!response.ok) throw new Error(`player session request failed: ${response.status}`);
    playerView = await response.json();
    render();
    loadingState.hidden = true;
    workspace.hidden = false;
    window.dispatchEvent(new Event("player-ui:ready"));
  } catch (error) {
    console.error(error);
    loadingState.hidden = true;
    errorDetail.textContent = playerUiErrorMessage(error);
    errorState.hidden = false;
    window.dispatchEvent(
      new CustomEvent("player-ui:error", {
        detail: { message: errorDetail.textContent },
      }),
    );
  } finally {
    window.clearTimeout(requestTimeout);
  }
}

/** @param {unknown} error */
function playerUiErrorMessage(error) {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "Локальный API не ответил за 8 секунд. Проверьте терминал Player UI и повторите.";
  }
  return "Локальный API вернул ошибку. Подробности записаны в консоль браузера.";
}

function render() {
  if (!playerView) return;
  const shell = createPlayerShellState(playerView, activeScreenId);
  navigation.replaceChildren(
    ...shell.screens.map((screen, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "navigation-item";
      button.disabled = !screen.available;
      button.dataset.screen = screen.id;
      button.setAttribute("aria-current", screen.id === shell.activeScreenId ? "page" : "false");
      if (screen.reason) button.title = screen.reason;

      const number = document.createElement("span");
      number.className = "navigation-item__number";
      number.textContent = String(index + 1).padStart(2, "0");
      const copy = document.createElement("span");
      copy.className = "navigation-item__copy";
      const label = document.createElement("strong");
      label.textContent = screen.shortLabel;
      const status = document.createElement("small");
      status.textContent = screen.available ? "Доступно" : screen.reason ?? "Недоступно";
      copy.append(label, status);
      button.append(number, copy);
      button.addEventListener("click", () => {
        activeScreenId = screen.id;
        render();
      });
      return button;
    }),
  );

  screenKicker.textContent = shell.activeScreen.kicker;
  screenTitle.textContent = shell.activeScreen.title;
  screenDescription.textContent = shell.activeScreen.description;
  screenState.textContent = phaseLabel(playerView.phase);
  locationValue.textContent = currentPlaceName(playerView);
  caravanValue.textContent = `${playerView.caravan.members.length} участника · ${playerView.caravan.credits} кр.`;
  cargoValue.textContent = `${formatNumber(playerView.caravan.cargo.usedCargoUnits)} / ${formatNumber(playerView.caravan.cargo.capacityCargoUnits)}`;
  sessionRevision.textContent = `Состояние ${playerView.revision + 1}`;

  if (shell.activeScreenId === "global") {
    globalView.hidden = false;
    placeholderView.hidden = true;
    renderGlobalView(playerView);
  } else {
    globalView.hidden = true;
    placeholderView.hidden = false;
  }
}

/** @param {import("../sim-core/dist/src/index.js").PlayerSessionView} view */
function renderGlobalView(view) {
  const state = createGlobalScreenState(view, visibleLayerIds);
  renderLayerControls(state);
  renderKnownMap(state);
  renderRouteCommand(view, state);
  renderCaravanMetrics(view, state);
  renderJournal(view);
}

/** @param {ReturnType<typeof createGlobalScreenState>} state */
function renderLayerControls(state) {
  layerControlList.replaceChildren(
    ...state.layers.map((layer) => {
      const label = document.createElement("label");
      label.className = "layer-toggle";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = layer.visible;
      input.dataset.layer = layer.id;
      input.addEventListener("change", () => {
        if (input.checked) visibleLayerIds.add(layer.id);
        else visibleLayerIds.delete(layer.id);
        if (playerView) renderGlobalView(playerView);
      });
      const name = document.createElement("span");
      name.textContent = layer.label;
      const count = document.createElement("small");
      count.textContent = String(layer.count);
      label.append(input, name, count);
      return label;
    }),
  );
}

/** @param {ReturnType<typeof createGlobalScreenState>} state */
function renderKnownMap(state) {
  mapLayerRoutes.style.display = layerDisplay(state, "routes");
  mapLayerCities.style.display = layerDisplay(state, "cities");
  mapLayerObjects.style.display = layerDisplay(state, "objects");
  mapLayerIntelligence.style.display = layerDisplay(state, "intelligence");
  mapLayerEvents.style.display = layerDisplay(state, "events");

  mapLayerRoutes.replaceChildren(
    ...(state.map.route
      ? [
          createSvgElement("line", {
            class: "known-map__route-shadow",
            x1: state.map.route.origin.x,
            y1: state.map.route.origin.y,
            x2: state.map.route.destination.x,
            y2: state.map.route.destination.y,
          }),
          createSvgElement("line", {
            class: "known-map__route",
            x1: state.map.route.origin.x,
            y1: state.map.route.origin.y,
            x2: state.map.route.destination.x,
            y2: state.map.route.destination.y,
          }),
        ]
      : []),
  );
  mapLayerCities.replaceChildren(
    ...state.map.places.map((place) => {
      const group = createSvgElement("g", { class: "known-map__place" });
      const marker = createSvgElement("circle", {
        cx: place.x,
        cy: place.y,
        r: 13,
      });
      const label = createSvgElement("text", {
        x: place.x + 25,
        y: place.y + 6,
      });
      label.textContent = place.name;
      group.append(marker, label);
      return group;
    }),
  );
  mapLayerEvents.replaceChildren(
    ...(state.map.caravanPoint && state.layers.find((layer) => layer.id === "events")?.visible
      ? [
          createSvgElement("circle", {
            class: "known-map__event",
            cx: state.map.caravanPoint.x,
            cy: state.map.caravanPoint.y,
            r: 29,
          }),
        ]
      : []),
  );
  mapLayerCaravan.replaceChildren(
    ...(state.map.caravanPoint
      ? [
          createSvgElement("circle", {
            class: "known-map__caravan-halo",
            cx: state.map.caravanPoint.x,
            cy: state.map.caravanPoint.y,
            r: 18,
          }),
          createSvgElement("path", {
            class: "known-map__caravan",
            d: `M ${state.map.caravanPoint.x} ${state.map.caravanPoint.y - 11} L ${state.map.caravanPoint.x + 10} ${state.map.caravanPoint.y + 9} L ${state.map.caravanPoint.x - 10} ${state.map.caravanPoint.y + 9} Z`,
          }),
        ]
      : []),
  );

  mapCaption.textContent = state.map.route
    ? `${routeStatusLabel(state.map.route.status)} · ${formatDistance(state.map.route.distanceMeters)} · ${formatDuration(state.map.route.etaSeconds)}`
    : "Маршрут не выбран · показаны только подтверждённые места";
  knownMap.setAttribute(
    "aria-label",
    `Известных мест: ${state.map.places.length}; ${state.map.route ? "маршрут показан" : "маршрут не выбран"}`,
  );
}

/**
 * @param {import("../sim-core/dist/src/index.js").PlayerSessionView} view
 * @param {ReturnType<typeof createGlobalScreenState>} state
 */
function renderRouteCommand(view, state) {
  routeDestination.replaceChildren();
  routeAction.onclick = null;
  routeActionStatus.textContent = "";

  if (state.routeCommand.canSelectDestination) {
    routeDestination.disabled = false;
    routeDestination.replaceChildren(
      ...state.routeCommand.destinationOptions.map((destination) => {
        const option = document.createElement("option");
        option.value = destination.ref;
        option.textContent = destination.name;
        return option;
      }),
    );
    routeAction.disabled = false;
    routeAction.textContent = "Проложить маршрут";
    routeAction.onclick = () =>
      dispatchPlayerAction({
        kind: "SELECT_DESTINATION",
        destinationRef: routeDestination.value,
      });
    return;
  }

  const destination = view.map.route
    ? view.map.places.find((place) => place.ref === view.map.route?.destinationRef)
    : null;
  const option = document.createElement("option");
  option.textContent = destination?.name ?? "Назначение недоступно";
  routeDestination.append(option);
  routeDestination.disabled = true;
  routeAction.disabled = !state.routeCommand.canStartJourney;
  routeAction.textContent = state.routeCommand.canStartJourney
    ? "Отправить караван"
    : "Караван в пути";
  if (state.routeCommand.canStartJourney) {
    routeAction.onclick = () => dispatchPlayerAction({ kind: "START_JOURNEY" });
  }
}

/**
 * @param {import("../sim-core/dist/src/index.js").PlayerSessionView} view
 * @param {ReturnType<typeof createGlobalScreenState>} state
 */
function renderCaravanMetrics(view, state) {
  foodValue.textContent = `${formatNumber(view.caravan.supplies.foodUnits)} ед.`;
  waterValue.textContent = `${formatNumber(view.caravan.supplies.waterUnits)} ед.`;
  memberValue.textContent = String(view.caravan.members.length);
  speedValue.textContent = view.map.route
    ? `${formatNumber(view.map.route.speedMetersPerSecond)} м/с`
    : "—";
  distanceValue.textContent = view.map.route
    ? formatDistance(view.map.route.distanceMeters)
    : "—";
  etaValue.textContent = view.map.route
    ? formatDuration(view.map.route.etaSeconds)
    : "—";
  warningList.replaceChildren();
  const message = document.createElement("p");
  message.textContent = state.warnings.length
    ? state.warnings.join(" ")
    : "Критических предупреждений нет.";
  message.className = state.warnings.length ? "is-critical" : "is-clear";
  warningList.append(message);
}

/** @param {import("../sim-core/dist/src/index.js").PlayerSessionView} view */
function renderJournal(view) {
  journalCount.textContent = String(view.journal.length);
  journalList.replaceChildren(
    ...[...view.journal].reverse().map((entry) => {
      const item = document.createElement("li");
      const sequence = document.createElement("span");
      sequence.textContent = String(entry.sequence).padStart(2, "0");
      const copy = document.createElement("div");
      const kind = document.createElement("strong");
      kind.textContent = journalKindLabel(entry.kind);
      const message = document.createElement("p");
      message.textContent = entry.message;
      copy.append(kind, message);
      item.append(sequence, copy);
      return item;
    }),
  );
  if (view.journal.length > 1) journalPanel.open = true;
}

/** @param {import("../sim-core/dist/src/index.js").PlayerSessionAction} action */
async function dispatchPlayerAction(action) {
  routeAction.disabled = true;
  routeActionStatus.textContent = "Передаём приказ каравану…";
  try {
    const response = await fetch("/api/player-session/actions", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(action),
    });
    if (!response.ok) throw new Error(`player action failed: ${response.status}`);
    playerView = await response.json();
    const completedKind = action.kind;
    render();
    routeActionStatus.textContent =
      completedKind === "SELECT_DESTINATION"
        ? "Маршрут подтверждён. Караван готов к выходу."
        : "Караван вышел из города.";
  } catch (error) {
    console.error(error);
    if (playerView) renderRouteCommand(playerView, createGlobalScreenState(playerView, visibleLayerIds));
    routeActionStatus.textContent =
      "Приказ не принят. Проверьте локальный сервер и повторите.";
  }
}

/** @param {ReturnType<typeof createGlobalScreenState>} state @param {string} layerId */
function layerDisplay(state, layerId) {
  return state.layers.find((layer) => layer.id === layerId)?.visible
    ? ""
    : "none";
}

/** @param {string} name @param {Record<string, string | number>} attributes */
function createSvgElement(name, attributes) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", name);
  for (const [key, value] of Object.entries(attributes)) {
    element.setAttribute(key, String(value));
  }
  return element;
}

/** @param {import("../sim-core/dist/src/index.js").PlayerSessionView} view */
function currentPlaceName(view) {
  const current = view.map.places.find(
    (place) => place.ref === view.map.currentPlaceRef,
  );
  return current?.name ?? "В пути";
}

/** @param {import("../sim-core/dist/src/index.js").PlayerSessionPhase} phase */
function phaseLabel(phase) {
  if (phase === "city") return "В городе";
  if (phase === "ready") return "Маршрут подготовлен";
  return "В пути";
}

/** @param {"planned" | "moving"} status */
function routeStatusLabel(status) {
  return status === "planned" ? "Маршрут подготовлен" : "Караван в пути";
}

/** @param {number} distanceMeters */
function formatDistance(distanceMeters) {
  if (distanceMeters >= 1_000) {
    return `${formatNumber(distanceMeters / 1_000)} км`;
  }
  return `${formatNumber(distanceMeters)} м`;
}

/** @param {number} seconds */
function formatDuration(seconds) {
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${hours} ч` : `${hours} ч ${remainder} мин`;
}

/** @param {import("../sim-core/dist/src/index.js").PlayerSessionView["journal"][number]["kind"]} kind */
function journalKindLabel(kind) {
  if (kind === "session-ready") return "Караван готов";
  if (kind === "route-planned") return "Маршрут подготовлен";
  return "Отправление";
}

/** @param {number} value */
function formatNumber(value) {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(value);
}

/** @template {Element} T @param {string} id @param {new (...args: any[]) => T} constructor */
function requireElement(id, constructor) {
  const element = document.getElementById(id);
  if (!(element instanceof constructor)) throw new Error(`missing element: ${id}`);
  return element;
}
