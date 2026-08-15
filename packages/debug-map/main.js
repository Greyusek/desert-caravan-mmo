// @ts-check

import {
  DEBUG_MAP_HEIGHT,
  DEBUG_MAP_WIDTH,
  createCaravanStatusSnapshot,
  createDebugMapSnapshot,
  createExpeditionEventLogSnapshot,
  createFourSegmentRouteSnapshot,
} from "./map-model.js";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const STATIC_KIND_LABELS = {
  oasis: "Оазис",
  mine: "Рудник",
  ruins: "Руины",
  cave: "Пещера",
};

const seedForm = requireElement("seed-form", HTMLFormElement);
const seedInput = requireElement("seed-input", HTMLInputElement);
const timeSlider = requireElement("time-slider", HTMLInputElement);
const timeOutput = requireElement("time-output", HTMLOutputElement);
const worldMap = requireElement("world-map", SVGSVGElement);
const errorMessage = requireElement("error-message", HTMLParagraphElement);
const mapTitle = requireElement("map-title", HTMLHeadingElement);
const cityCount = requireElement("city-count", HTMLElement);
const objectCount = requireElement("object-count", HTMLElement);
const monsterCount = requireElement("monster-count", HTMLElement);
const detailTitle = requireElement("detail-title", HTMLParagraphElement);
const detailList = requireElement("detail-list", HTMLDListElement);
const routeForm = requireElement("route-form", HTMLFormElement);
const routeStartCity = requireElement("route-start-city", HTMLSelectElement);
const routeSpeed = requireElement("route-speed", HTMLInputElement);
const routeSummary = requireElement("route-summary", HTMLOutputElement);
const routeBearingInputs = [1, 2, 3, 4].map((index) =>
  requireElement(`route-bearing-${index}`, HTMLInputElement),
);
const routeDistanceInputs = [1, 2, 3, 4].map((index) =>
  requireElement(`route-distance-${index}`, HTMLInputElement),
);
const caravanPanel = requireElement("caravan-panel", HTMLElement);
const caravanStateLabel = requireElement("caravan-state-label", HTMLParagraphElement);
const caravanRouteStatus = requireElement("caravan-route-status", HTMLElement);
const caravanDistance = requireElement("caravan-distance", HTMLParagraphElement);
const routeProgress = requireElement("route-progress", HTMLProgressElement);
const routeProgressLabel = requireElement("route-progress-label", HTMLParagraphElement);
const foodCard = requireElement("food-card", HTMLElement);
const foodRemaining = requireElement("food-remaining", HTMLElement);
const foodProgress = requireElement("food-progress", HTMLProgressElement);
const foodMeta = requireElement("food-meta", HTMLParagraphElement);
const waterCard = requireElement("water-card", HTMLElement);
const waterRemaining = requireElement("water-remaining", HTMLElement);
const waterProgress = requireElement("water-progress", HTMLProgressElement);
const waterMeta = requireElement("water-meta", HTMLParagraphElement);
const forecastTitle = requireElement("forecast-title", HTMLElement);
const forecastDetail = requireElement("forecast-detail", HTMLParagraphElement);
const supplyForm = requireElement("supply-form", HTMLFormElement);
const initialFood = requireElement("initial-food", HTMLInputElement);
const initialWater = requireElement("initial-water", HTMLInputElement);
const movingFoodRate = requireElement("moving-food-rate", HTMLInputElement);
const movingWaterRate = requireElement("moving-water-rate", HTMLInputElement);
const idleFoodRate = requireElement("idle-food-rate", HTMLInputElement);
const idleWaterRate = requireElement("idle-water-rate", HTMLInputElement);
const eventLogCount = requireElement("event-log-count", HTMLOutputElement);
const eventLogNext = requireElement("event-log-next", HTMLParagraphElement);
const eventLogList = requireElement("event-log-list", HTMLOListElement);

let elapsedSeconds = 0;
let supplySettings = readSupplySettings();

seedForm.addEventListener("submit", (event) => {
  event.preventDefault();
  elapsedSeconds = 0;
  timeSlider.value = "0";
  render();
});

timeSlider.addEventListener("input", () => {
  elapsedSeconds = Number(timeSlider.value);
  render();
});

routeForm.addEventListener("submit", (event) => {
  event.preventDefault();
  elapsedSeconds = 0;
  timeSlider.value = "0";
  render();
});

supplyForm.addEventListener("submit", (event) => {
  event.preventDefault();
  supplySettings = readSupplySettings();
  elapsedSeconds = 0;
  timeSlider.value = "0";
  render();
});

worldMap.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) return;
  const marker = event.target.closest("[data-detail-title]");
  if (!marker) return;

  const title = marker.getAttribute("data-detail-title");
  const rows = marker.getAttribute("data-detail-rows");
  if (!title || !rows) return;

  showDetails(title, JSON.parse(rows));
});

render();

/** @returns {void} */
function render() {
  try {
    const snapshot = createDebugMapSnapshot(seedInput.value.trim(), elapsedSeconds);
    syncStartCityOptions(snapshot.cities);
    const startCity = snapshot.cities.find(
      (city) => city.id === routeStartCity.value,
    );
    if (!startCity) throw new Error("Выберите существующий стартовый город");

    const route = createFourSegmentRouteSnapshot(
      startCity.position,
      readRouteCommands(),
      routeSpeed.valueAsNumber,
      elapsedSeconds,
    );
    const caravanStatus = createCaravanStatusSnapshot(
      route,
      supplySettings.initial,
      supplySettings.profile,
    );
    const eventLog = createExpeditionEventLogSnapshot(
      route,
      supplySettings.initial,
      supplySettings.profile,
    );
    const firstMonster = snapshot.monsters[0];
    const maximumElapsedSeconds = Math.max(
      route.totalDurationSeconds,
      firstMonster?.periodSeconds ?? 0,
    );

    if (elapsedSeconds > maximumElapsedSeconds) {
      elapsedSeconds = maximumElapsedSeconds;
      timeSlider.value = String(elapsedSeconds);
      render();
      return;
    }

    errorMessage.hidden = true;
    mapTitle.textContent = `Seed: ${snapshot.seed}`;
    cityCount.textContent = String(snapshot.cities.length);
    objectCount.textContent = String(snapshot.staticObjects.length);
    monsterCount.textContent = String(snapshot.monsters.length);
    timeOutput.textContent = formatElapsed(elapsedSeconds);
    routeSummary.textContent = formatRouteSummary(route);
    renderCaravanStatus(caravanStatus);
    renderEventLog(eventLog, route);

    timeSlider.max = String(Math.max(1, Math.ceil(maximumElapsedSeconds)));
    timeSlider.value = String(elapsedSeconds);

    drawSnapshot(snapshot, route);
  } catch (error) {
    errorMessage.textContent = error instanceof Error ? error.message : String(error);
    errorMessage.hidden = false;
  }
}

/**
 * @param {ReturnType<typeof createExpeditionEventLogSnapshot>} log
 * @param {ReturnType<typeof createFourSegmentRouteSnapshot>} route
 */
function renderEventLog(log, route) {
  eventLogCount.textContent = `${log.occurredCount} / ${log.totalCount}`;
  const nextEvent = log.events.find((event) => event.id === log.nextEventId);
  eventLogNext.textContent = nextEvent
    ? `Следующее: ${eventTitle(nextEvent)} · ${formatElapsed(nextEvent.atSeconds)}`
    : "Маршрут завершён";

  eventLogList.replaceChildren(
    ...log.events.map((event) => {
      const item = document.createElement("li");
      item.className = "event-log-item";
      item.dataset.state = event.active
        ? "active"
        : event.occurred
          ? "occurred"
          : "future";
      item.dataset.kind = event.kind;

      const marker = document.createElement("span");
      marker.className = "event-log-marker";
      marker.setAttribute("aria-hidden", "true");

      const content = document.createElement("div");
      content.className = "event-log-content";
      const time = document.createElement("time");
      time.textContent = formatElapsed(event.atSeconds);
      const title = document.createElement("strong");
      title.textContent = eventTitle(event);
      const detail = document.createElement("span");
      detail.textContent = eventDetail(event, route);
      content.append(time, title, detail);

      if (event.active) {
        const current = document.createElement("span");
        current.className = "event-log-current";
        current.textContent = "сейчас";
        content.append(current);
      }

      item.append(marker, content);
      return item;
    }),
  );
}

/**
 * @param {ReturnType<typeof createExpeditionEventLogSnapshot>["events"][number]} event
 */
function eventTitle(event) {
  if (event.kind === "departure") return "Караван вышел в путь";
  if (event.kind === "segment-completed") {
    return `Завершён сегмент ${(event.segmentIndex ?? 0) + 1}`;
  }
  if (event.kind === "supplies-low") {
    return `${formatDepletionCause(event.cause)}: осталось 25%`;
  }
  if (event.kind === "supplies-depleted") {
    return "Критические запасы исчерпаны";
  }
  return "Маршрут достиг финиша";
}

/**
 * @param {ReturnType<typeof createExpeditionEventLogSnapshot>["events"][number]} event
 * @param {ReturnType<typeof createFourSegmentRouteSnapshot>} route
 */
function eventDetail(event, route) {
  if (event.kind === "departure") {
    return `${formatNumber(route.totalDistanceKilometers, 1)} км · ${formatNumber(route.speedKilometersPerHour, 1)} км/ч`;
  }
  if (event.kind === "segment-completed") {
    return `${formatNumber(event.distanceKilometers ?? 0, 1)} км пройдено`;
  }
  if (event.kind === "supplies-low") {
    return "Порог раннего предупреждения";
  }
  if (event.kind === "supplies-depleted") {
    return `${formatDepletionCause(event.cause)} · последствия появятся в GAME-003`;
  }
  return `${formatNumber(event.distanceKilometers ?? 0, 1)} км · ETA ${formatDuration(route.totalDurationSeconds)}`;
}

/**
 * @param {ReturnType<typeof createCaravanStatusSnapshot>} status
 */
function renderCaravanStatus(status) {
  const panelState = status.supplies.depleted
    ? "depleted"
    : status.forecast.canFinish
      ? "safe"
      : "risk";
  caravanPanel.dataset.state = panelState;
  caravanStateLabel.textContent =
    panelState === "depleted"
      ? "Критический запас"
      : panelState === "risk"
        ? "Риск истощения"
        : "Готов к пути";

  caravanRouteStatus.textContent =
    status.route.status === "arrived"
      ? "Прибыл · маршрут завершён"
      : `В пути · сегмент ${(status.route.segmentIndex ?? 0) + 1}/4`;
  caravanDistance.textContent = `${formatNumber(status.route.traveledDistanceKilometers, 1)} / ${formatNumber(status.route.traveledDistanceKilometers + status.route.remainingDistanceKilometers, 1)} км`;
  routeProgress.value = status.route.progress;
  routeProgress.textContent = `${Math.round(status.route.progress * 100)}%`;
  routeProgressLabel.textContent = `${Math.round(status.route.progress * 100)}% · ETA ${formatDuration(status.route.totalDurationSeconds)}`;

  renderSupply(
    foodCard,
    foodRemaining,
    foodProgress,
    foodMeta,
    status.supplies.foodRemaining,
    status.supplies.initialFoodUnits,
    status.supplies.foodFraction,
    supplySettings.profile.moving.foodUnitsPerHour,
  );
  renderSupply(
    waterCard,
    waterRemaining,
    waterProgress,
    waterMeta,
    status.supplies.waterRemaining,
    status.supplies.initialWaterUnits,
    status.supplies.waterFraction,
    supplySettings.profile.moving.waterUnitsPerHour,
  );

  if (status.supplies.depleted) {
    forecastTitle.textContent = "Критические запасы исчерпаны";
    forecastDetail.textContent = `${formatDepletionCause(status.supplies.depletionCause)} · ${formatElapsed(status.forecast.firstDepletionAtSeconds ?? 0)}`;
  } else if (status.forecast.canFinish) {
    forecastTitle.textContent = "Запасов хватит до финиша";
    forecastDetail.textContent = `На финише: еда ${formatNumber(status.forecast.foodAtArrival, 1)} · вода ${formatNumber(status.forecast.waterAtArrival, 1)}`;
  } else {
    forecastTitle.textContent = "Запасов не хватит";
    forecastDetail.textContent = `${formatDepletionCause(status.forecast.depletionCause)} закончатся на ${formatElapsed(status.forecast.firstDepletionAtSeconds ?? 0)}`;
  }
}

/**
 * @param {HTMLElement} card
 * @param {HTMLElement} remainingOutput
 * @param {HTMLProgressElement} progress
 * @param {HTMLParagraphElement} meta
 * @param {number} remaining
 * @param {number} initial
 * @param {number} fraction
 * @param {number} rate
 */
function renderSupply(
  card,
  remainingOutput,
  progress,
  meta,
  remaining,
  initial,
  fraction,
  rate,
) {
  card.dataset.state = remaining === 0 ? "depleted" : fraction <= 0.25 ? "risk" : "safe";
  remainingOutput.textContent = formatNumber(remaining, 1);
  progress.value = fraction;
  progress.textContent = `${Math.round(fraction * 100)}%`;
  meta.textContent = `из ${formatNumber(initial, 1)} · расход ${formatNumber(rate, 2)}/ч`;
}

function readSupplySettings() {
  return {
    initial: {
      foodUnits: initialFood.valueAsNumber,
      waterUnits: initialWater.valueAsNumber,
    },
    profile: {
      moving: {
        foodUnitsPerHour: movingFoodRate.valueAsNumber,
        waterUnitsPerHour: movingWaterRate.valueAsNumber,
      },
      idle: {
        foodUnitsPerHour: idleFoodRate.valueAsNumber,
        waterUnitsPerHour: idleWaterRate.valueAsNumber,
      },
    },
  };
}

/**
 * @param {ReturnType<typeof createDebugMapSnapshot>} snapshot
 * @param {ReturnType<typeof createFourSegmentRouteSnapshot>} route
 */
function drawSnapshot(snapshot, route) {
  worldMap.replaceChildren();
  drawGrid();

  for (const monster of snapshot.monsters) {
    for (const path of monster.patrolPaths) {
      const polyline = svgElement("polyline", {
        class: "patrol-path",
        points: path.map((point) => `${point.x},${point.y}`).join(" "),
      });
      worldMap.append(polyline);
    }
  }

  for (const path of route.routePaths) {
    worldMap.append(
      svgElement("polyline", {
        class: "caravan-route-path",
        points: path.map((point) => `${point.x},${point.y}`).join(" "),
      }),
    );
  }

  for (const segment of route.segments) {
    const group = svgElement("g", {
      "data-detail-title": `Маршрут · сегмент ${segment.index + 1}`,
      "data-detail-rows": JSON.stringify([
        ["Азимут", `${segment.bearingDeg.toFixed(1)}°`],
        ["Дистанция", `${segment.distanceKilometers.toFixed(1)} км`],
        ["ETA", formatDuration(segment.etaEndSeconds)],
        ["Широта", segment.end.latitudeDeg.toFixed(6)],
        ["Долгота", segment.end.longitudeDeg.toFixed(6)],
      ]),
    });
    const marker = svgElement("circle", {
      class: "route-waypoint",
      cx: segment.endPoint.x,
      cy: segment.endPoint.y,
      r: 5,
    });
    const label = svgElement("text", {
      class: "route-waypoint-label",
      x: segment.endPoint.x,
      y: segment.endPoint.y + 3,
      "text-anchor": "middle",
    });
    label.textContent = String(segment.index + 1);
    group.append(marker, label, svgTitle(`Конец сегмента ${segment.index + 1}`));
    worldMap.append(group);
  }

  for (const city of snapshot.cities) {
    const group = svgElement("g", {
      "data-detail-title": `${city.name} · ${city.id}`,
      "data-detail-rows": JSON.stringify([
        ["Тип", "Город"],
        ["Широта", city.position.latitudeDeg.toFixed(6)],
        ["Долгота", city.position.longitudeDeg.toFixed(6)],
      ]),
    });
    const marker = svgElement("circle", {
      class: "city-marker",
      cx: city.point.x,
      cy: city.point.y,
      r: 5,
    });
    const label = svgElement("text", {
      class: "city-label",
      x: city.point.x + 8,
      y: city.point.y - 7,
    });
    label.textContent = city.name;
    group.append(marker, label, svgTitle(`${city.name} (${city.id})`));
    worldMap.append(group);
  }

  for (const object of snapshot.staticObjects) {
    const label = STATIC_KIND_LABELS[object.kind];
    const marker = svgElement("rect", {
      class: `object-marker object-marker--${object.kind}`,
      x: object.point.x - 4,
      y: object.point.y - 4,
      width: 8,
      height: 8,
      rx: object.kind === "oasis" ? 4 : 1,
      transform:
        object.kind === "mine"
          ? `rotate(45 ${object.point.x} ${object.point.y})`
          : "",
      "data-detail-title": `${label} · ${object.id}`,
      "data-detail-rows": JSON.stringify([
        ["Тип", label],
        ["Статус", "Скрытый объект"],
        ["Широта", object.position.latitudeDeg.toFixed(6)],
        ["Долгота", object.position.longitudeDeg.toFixed(6)],
      ]),
    });
    marker.append(svgTitle(`${label} (${object.id})`));
    worldMap.append(marker);
  }

  for (const monster of snapshot.monsters) {
    const marker = svgElement("polygon", {
      class: "monster-marker",
      points: `${monster.point.x},${monster.point.y - 7} ${monster.point.x + 7},${monster.point.y + 6} ${monster.point.x - 7},${monster.point.y + 6}`,
      "data-detail-title": `Блуждающий монстр · ${monster.id}`,
      "data-detail-rows": JSON.stringify([
        ["Power", String(monster.power)],
        ["Цикл", String(monster.cycleIndex)],
        ["Сегмент", String(monster.segmentIndex + 1)],
        ["Обзор", `${monster.visionRadiusMeters} м`],
        ["Контакт", `${monster.interactionRadiusMeters} м`],
        ["Широта", monster.position.latitudeDeg.toFixed(6)],
        ["Долгота", monster.position.longitudeDeg.toFixed(6)],
      ]),
    });
    marker.append(svgTitle(`Монстр ${monster.id}`));
    const label = svgElement("text", {
      class: "monster-label",
      x: monster.point.x + 10,
      y: monster.point.y + 4,
    });
    label.textContent = `PWR ${monster.power}`;
    worldMap.append(marker, label);
  }

  const caravanSegment =
    route.position.segmentIndex === null
      ? "Прибыл"
      : `Сегмент ${route.position.segmentIndex + 1}`;
  const caravan = svgElement("g", {
    "data-detail-title": "Караван · активный маршрут",
    "data-detail-rows": JSON.stringify([
      ["Статус", caravanSegment],
      ["Скорость", `${route.speedKilometersPerHour.toFixed(1)} км/ч`],
      ["Пройдено", `${(route.position.traveledDistanceMeters / 1_000).toFixed(1)} км`],
      ["Осталось", `${(route.position.remainingDistanceMeters / 1_000).toFixed(1)} км`],
      ["Время", formatElapsed(route.position.elapsedSeconds)],
      ["Широта", route.position.coordinate.latitudeDeg.toFixed(6)],
      ["Долгота", route.position.coordinate.longitudeDeg.toFixed(6)],
    ]),
  });
  caravan.append(
    svgElement("circle", {
      class: "caravan-marker",
      cx: route.position.point.x,
      cy: route.position.point.y,
      r: 8,
    }),
    svgTitle("Караван"),
  );
  worldMap.append(caravan);
}

/**
 * @param {ReturnType<typeof createDebugMapSnapshot>["cities"]} cities
 */
function syncStartCityOptions(cities) {
  const currentIds = Array.from(
    routeStartCity.options,
    (option) => option.value,
  );
  const nextIds = cities.map((city) => city.id);
  if (
    currentIds.length === nextIds.length &&
    currentIds.every((id, index) => id === nextIds[index])
  ) {
    return;
  }

  const selectedId = routeStartCity.value;
  routeStartCity.replaceChildren(
    ...cities.map((city) => {
      const option = document.createElement("option");
      option.value = city.id;
      option.textContent = `${city.name} · ${city.id}`;
      return option;
    }),
  );
  routeStartCity.value = nextIds.includes(selectedId) ? selectedId : (nextIds[0] ?? "");
}

function readRouteCommands() {
  return routeBearingInputs.map((input, index) => ({
    bearingDeg: input.valueAsNumber,
    distanceKilometers: routeDistanceInputs[index]?.valueAsNumber ?? Number.NaN,
  }));
}

function drawGrid() {
  for (let longitude = -180; longitude <= 180; longitude += 60) {
    const x = ((longitude + 180) / 360) * DEBUG_MAP_WIDTH;
    worldMap.append(
      svgElement("line", {
        class: longitude === 0 ? "map-meridian" : "map-grid",
        x1: x,
        x2: x,
        y1: 0,
        y2: DEBUG_MAP_HEIGHT,
      }),
    );
    if (longitude > -180 && longitude < 180) {
      const label = svgElement("text", {
        class: "map-axis-label",
        x: x + 5,
        y: DEBUG_MAP_HEIGHT - 7,
      });
      label.textContent = `${longitude}°`;
      worldMap.append(label);
    }
  }

  for (let latitude = -60; latitude <= 60; latitude += 30) {
    const y = ((90 - latitude) / 180) * DEBUG_MAP_HEIGHT;
    worldMap.append(
      svgElement("line", {
        class: latitude === 0 ? "map-equator" : "map-grid",
        x1: 0,
        x2: DEBUG_MAP_WIDTH,
        y1: y,
        y2: y,
      }),
    );
    const label = svgElement("text", {
      class: "map-axis-label",
      x: 7,
      y: y - 5,
    });
    label.textContent = `${latitude}°`;
    worldMap.append(label);
  }
}

/** @param {string} title @param {unknown} rowsValue */
function showDetails(title, rowsValue) {
  if (!Array.isArray(rowsValue)) return;
  detailTitle.textContent = title;
  detailList.replaceChildren();

  for (const row of rowsValue) {
    if (!Array.isArray(row) || row.length !== 2) continue;
    const wrapper = document.createElement("div");
    const term = document.createElement("dt");
    const value = document.createElement("dd");
    term.textContent = String(row[0]);
    value.textContent = String(row[1]);
    wrapper.append(term, value);
    detailList.append(wrapper);
  }
}

/**
 * @template {Element} T
 * @param {string} id
 * @param {{ new (...args: any[]): T }} constructor
 * @returns {T}
 */
function requireElement(id, constructor) {
  const element = document.getElementById(id);
  if (!(element instanceof constructor)) {
    throw new Error(`Missing required element #${id}`);
  }
  return element;
}

/**
 * @param {keyof SVGElementTagNameMap} tagName
 * @param {Record<string, string | number>} [attributes]
 */
function svgElement(tagName, attributes = {}) {
  const element = document.createElementNS(SVG_NAMESPACE, tagName);
  for (const [name, value] of Object.entries(attributes)) {
    if (value !== "") element.setAttribute(name, String(value));
  }
  return element;
}

/** @param {string} text */
function svgTitle(text) {
  const title = svgElement("title");
  title.textContent = text;
  return title;
}

/** @param {number} seconds */
function formatElapsed(seconds) {
  const wholeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(wholeSeconds / 3_600);
  const minutes = Math.floor((wholeSeconds % 3_600) / 60);
  const remainder = wholeSeconds % 60;
  return `T+${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

/** @param {number} seconds */
function formatDuration(seconds) {
  const hours = seconds / 3_600;
  return hours >= 48 ? `${(hours / 24).toFixed(1)} дн` : `${hours.toFixed(1)} ч`;
}

/** @param {number} value @param {number} [maximumFractionDigits] */
function formatNumber(value, maximumFractionDigits = 1) {
  return value.toLocaleString("ru-RU", { maximumFractionDigits });
}

/** @param {"food" | "water" | "both" | null} cause */
function formatDepletionCause(cause) {
  if (cause === "food") return "Еда";
  if (cause === "water") return "Вода";
  if (cause === "both") return "Еда и вода";
  return "Запасы";
}

/** @param {ReturnType<typeof createFourSegmentRouteSnapshot>} route */
function formatRouteSummary(route) {
  return `${route.totalDistanceKilometers.toLocaleString("ru-RU", { maximumFractionDigits: 1 })} км · ETA ${formatDuration(route.totalDurationSeconds)} · ${route.speedKilometersPerHour.toFixed(1)} км/ч`;
}
