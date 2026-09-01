// @ts-check

import { createPlayerShellState } from "./shell-model.js";

const navigation = requireElement("primary-navigation", HTMLElement);
const screenKicker = requireElement("screen-kicker", HTMLParagraphElement);
const screenTitle = requireElement("screen-title", HTMLHeadingElement);
const screenDescription = requireElement("screen-description", HTMLParagraphElement);
const screenState = requireElement("screen-state", HTMLSpanElement);
const locationValue = requireElement("location-value", HTMLSpanElement);
const caravanValue = requireElement("caravan-value", HTMLSpanElement);
const cargoValue = requireElement("cargo-value", HTMLSpanElement);
const sessionRevision = requireElement("session-revision", HTMLSpanElement);
const loadingState = requireElement("loading-state", HTMLElement);
const workspace = requireElement("workspace", HTMLElement);
const errorState = requireElement("error-state", HTMLElement);
const errorDetail = requireElement("error-detail", HTMLElement);

const PLAYER_SESSION_TIMEOUT_MS = 8_000;

/** @type {import("../sim-core/dist/src/index.js").PlayerSessionView | null} */
let playerView = null;
let activeScreenId = "global";

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
