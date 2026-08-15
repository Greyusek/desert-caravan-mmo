// @ts-check

import {
  DEBUG_MAP_HEIGHT,
  DEBUG_MAP_WIDTH,
  applyExpeditionOutcomeToRoute,
  createCaravanStatusSnapshot,
  createDebugMapSnapshot,
  createDiscoveryDoctrineSnapshot,
  createExpeditionEventLogSnapshot,
  createExpeditionOutcomeSnapshot,
  createFourSegmentRouteSnapshot,
  createRumorSearchSnapshot,
  projectCoordinate,
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
const outcomePanel = requireElement("outcome-panel", HTMLElement);
const outcomeTitle = requireElement("outcome-title", HTMLHeadingElement);
const outcomeDetail = requireElement("outcome-detail", HTMLParagraphElement);
const outcomeState = requireElement("outcome-state", HTMLParagraphElement);
const outcomeTime = requireElement("outcome-time", HTMLElement);
const outcomeCause = requireElement("outcome-cause", HTMLElement);
const outcomePosition = requireElement("outcome-position", HTMLElement);
const outcomeAction = requireElement("outcome-action", HTMLButtonElement);
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
const rumorPanel = requireElement("rumor-panel", HTMLElement);
const rumorState = requireElement("rumor-state", HTMLParagraphElement);
const rumorText = requireElement("rumor-text", HTMLElement);
const rumorOrigin = requireElement("rumor-origin", HTMLElement);
const rumorSector = requireElement("rumor-sector", HTMLElement);
const rumorRange = requireElement("rumor-range", HTMLElement);
const rumorResult = requireElement("rumor-result", HTMLParagraphElement);
const doctrineResult = requireElement("doctrine-result", HTMLParagraphElement);
const doctrineStop = requireElement("doctrine-stop", HTMLInputElement);
const doctrineMarkAndContinue = requireElement(
  "doctrine-mark-and-continue",
  HTMLInputElement,
);
const rumorDevRoute = requireElement("rumor-dev-route", HTMLButtonElement);
const rumorMap = requireElement("rumor-map", SVGSVGElement);

let elapsedSeconds = 0;
let supplySettings = readSupplySettings();
/** @type {ReturnType<typeof createRumorSearchSnapshot> | null} */
let activeRumorSearch = null;
/** @type {ReturnType<typeof createExpeditionOutcomeSnapshot> | null} */
let activeOutcome = null;

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

doctrineStop.addEventListener("change", render);
doctrineMarkAndContinue.addEventListener("change", render);

outcomeAction.addEventListener("click", () => {
  if (!activeOutcome) return;
  elapsedSeconds =
    activeOutcome.status === "in-progress"
      ? activeOutcome.planned.atSeconds
      : 0;
  timeSlider.value = String(elapsedSeconds);
  render();
});

rumorDevRoute.addEventListener("click", () => {
  if (!activeRumorSearch) return;

  const { exactBearingDeg, exactDistanceKilometers } =
    activeRumorSearch.serverTruth;
  routeBearingInputs.forEach((input, index) => {
    input.value = index === 0 ? exactBearingDeg.toFixed(6) : "0";
  });
  routeDistanceInputs.forEach((input, index) => {
    input.value = index === 0 ? exactDistanceKilometers.toFixed(6) : "0";
  });
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

    const plannedRoute = createFourSegmentRouteSnapshot(
      startCity.position,
      readRouteCommands(),
      routeSpeed.valueAsNumber,
      elapsedSeconds,
    );
    const plannedRumorSearch = createRumorSearchSnapshot(
      snapshot.seed,
      startCity,
      plannedRoute,
    );
    const proposedDoctrine = createDiscoveryDoctrineSnapshot(
      plannedRoute,
      plannedRumorSearch,
      readDiscoveryDoctrine(),
    );
    const outcome = createExpeditionOutcomeSnapshot(
      plannedRoute,
      supplySettings.initial,
      supplySettings.profile,
      proposedDoctrine,
    );
    const route = applyExpeditionOutcomeToRoute(plannedRoute, outcome);
    const rumorSearch = createRumorSearchSnapshot(
      snapshot.seed,
      startCity,
      route,
    );
    const doctrine = createDiscoveryDoctrineSnapshot(
      route,
      rumorSearch,
      readDiscoveryDoctrine(),
    );
    const caravanStatus = createCaravanStatusSnapshot(
      route,
      supplySettings.initial,
      supplySettings.profile,
      doctrine,
      outcome,
    );
    activeRumorSearch = rumorSearch;
    activeOutcome = outcome;
    const eventLog = createExpeditionEventLogSnapshot(
      route,
      supplySettings.initial,
      supplySettings.profile,
      rumorSearch,
      doctrine,
      outcome,
    );
    const firstMonster = snapshot.monsters[0];
    const maximumElapsedSeconds =
      outcome.status !== "in-progress"
        ? outcome.planned.atSeconds
        : Math.max(
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
    objectCount.textContent = String(snapshot.staticObjects.length + 1);
    monsterCount.textContent = String(snapshot.monsters.length);
    timeOutput.textContent = formatElapsed(elapsedSeconds);
    routeSummary.textContent = formatRouteSummary(route);
    renderRumorSearch(rumorSearch, doctrine);
    renderCaravanStatus(caravanStatus);
    renderExpeditionOutcome(outcome);
    renderEventLog(eventLog, route);

    timeSlider.max = String(Math.max(1, Math.ceil(maximumElapsedSeconds)));
    timeSlider.value = String(elapsedSeconds);

    drawSnapshot(snapshot, route, rumorSearch, doctrine, outcome);
  } catch (error) {
    activeRumorSearch = null;
    activeOutcome = null;
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
    : log.executionStatus === "stopped" || log.executionStatus === "paused"
      ? "Маршрут поставлен на паузу доктриной"
      : log.executionStatus === "failed"
        ? "Экспедиция завершена гибелью каравана"
        : log.executionStatus === "completed"
          ? "Экспедиция успешно завершена"
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
  if (event.kind === "target-discovered") {
    return `Обнаружен ${staticKindLabel(event.objectKind).toLocaleLowerCase("ru-RU")}`;
  }
  if (event.kind === "doctrine-decision") {
    return event.doctrine === "STOP"
      ? "Доктрина: остановиться у цели"
      : "Доктрина: отметить и продолжить";
  }
  if (event.kind === "search-missed") {
    return "Поиск завершён без находки";
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
    return `${formatDepletionCause(event.cause)} · гибель на ${formatNumber(event.distanceKilometers ?? 0, 1)} км пути`;
  }
  if (event.kind === "target-discovered") {
    return `Сегмент ${(event.segmentIndex ?? 0) + 1} · ${formatNumber(event.distanceKilometers ?? 0, 1)} км пути`;
  }
  if (event.kind === "doctrine-decision") {
    return event.doctrine === "STOP"
      ? "Движение поставлено на паузу в точке обнаружения"
      : "Цель добавлена в знания экспедиции; курс не изменён";
  }
  if (event.kind === "search-missed") {
    return `Караван не вошёл в радиус 150 м от цели слуха`;
  }
  return `${formatNumber(event.distanceKilometers ?? 0, 1)} км · ETA ${formatDuration(route.totalDurationSeconds)}`;
}

/**
 * @param {ReturnType<typeof createRumorSearchSnapshot>} search
 * @param {ReturnType<typeof createDiscoveryDoctrineSnapshot>} doctrine
 */
function renderRumorSearch(search, doctrine) {
  rumorPanel.dataset.state = search.status;
  rumorState.textContent =
    search.status === "found"
      ? doctrine.status === "stopped"
        ? "Караван остановлен"
        : "Цель отмечена"
      : search.status === "missed"
        ? "Не найдено"
        : "Идёт поиск";
  rumorOrigin.textContent = `${search.originCity.name} · ${search.originCity.id}`;
  rumorSector.textContent = `СЗ · ${formatNumber(search.rumor.bearingSector.minimumBearingDeg, 1)}°–${formatNumber(search.rumor.bearingSector.maximumBearingDeg, 1)}°`;
  rumorRange.textContent = `${formatNumber(search.rumor.distanceRange.minimumMeters / 1_000, 0)}–${formatNumber(search.rumor.distanceRange.maximumMeters / 1_000, 0)} км`;
  rumorText.textContent = `«К северо-западу от ${search.originCity.name} видели старый рудник — примерно в ${formatNumber(search.rumor.distanceRange.minimumMeters / 1_000, 0)}–${formatNumber(search.rumor.distanceRange.maximumMeters / 1_000, 0)} км»`;

  if (search.status === "found" && search.discovery) {
    rumorResult.textContent = `Рудник обнаружен на ${formatElapsed(search.discovery.atSeconds)} · сегмент ${search.discovery.segmentIndex + 1} · ${formatNumber(search.discovery.routeDistanceKilometers, 1)} км пути.`;
    doctrineResult.textContent =
      doctrine.status === "stopped"
        ? `STOP выполнена: маршрут поставлен на паузу в точке обнаружения.`
        : `MARK_AND_CONTINUE выполнена: цель отмечена, караван продолжает маршрут.`;
  } else if (search.status === "missed") {
    rumorResult.textContent = `Маршрут завершён: караван не вошёл в радиус ${formatNumber(search.discoveryRadiusMeters, 0)} м от скрытой цели.`;
    doctrineResult.textContent = "Цель не обнаружена — доктрина не сработала.";
  } else {
    rumorResult.textContent = `Проведите маршрут через отмеченный сектор. Обнаружение сработает в радиусе ${formatNumber(search.discoveryRadiusMeters, 0)} м.`;
    doctrineResult.textContent =
      doctrine.doctrine === "STOP"
        ? "При обнаружении караван автоматически остановится у цели."
        : "При обнаружении караван отметит цель и продолжит движение.";
  }

  drawRumorMap(search);
}

/**
 * @param {ReturnType<typeof createRumorSearchSnapshot>} search
 */
function drawRumorMap(search) {
  const map = search.localMap;
  rumorMap.replaceChildren();

  for (const offset of [40, 80, 120, 160, 200, 240, 280, 320, 360]) {
    rumorMap.append(
      svgElement("line", {
        class: "rumor-map-grid",
        x1: offset,
        x2: offset,
        y1: 0,
        y2: map.height,
      }),
    );
  }
  for (const offset of [40, 80, 120, 160, 200]) {
    rumorMap.append(
      svgElement("line", {
        class: "rumor-map-grid",
        x1: 0,
        x2: map.width,
        y1: offset,
        y2: offset,
      }),
    );
  }

  rumorMap.append(
    svgElement("circle", {
      class: "rumor-ring",
      cx: map.originPoint.x,
      cy: map.originPoint.y,
      r: map.minimumRangePixels,
    }),
    svgElement("circle", {
      class: "rumor-ring",
      cx: map.originPoint.x,
      cy: map.originPoint.y,
      r: map.maximumRangePixels,
    }),
    svgElement("polygon", {
      class: "rumor-clue-area",
      points: map.clueAreaPoints.map((point) => `${point.x},${point.y}`).join(" "),
    }),
    svgElement("polyline", {
      class: "rumor-local-route",
      points: map.routePoints.map((point) => `${point.x},${point.y}`).join(" "),
    }),
  );

  const minimumLabel = svgElement("text", {
    class: "rumor-range-label",
    x: map.originPoint.x + map.minimumRangePixels + 3,
    y: map.originPoint.y - 3,
  });
  minimumLabel.textContent = `${formatNumber(search.rumor.distanceRange.minimumMeters / 1_000, 0)} км`;
  const maximumLabel = svgElement("text", {
    class: "rumor-range-label",
    x: map.originPoint.x + map.maximumRangePixels + 3,
    y: map.originPoint.y - 3,
  });
  maximumLabel.textContent = `${formatNumber(search.rumor.distanceRange.maximumMeters / 1_000, 0)} км`;

  const clue = svgElement("circle", {
    class: "rumor-clue-marker",
    cx: map.cluePoint.x,
    cy: map.cluePoint.y,
    r: 10,
  });
  const clueLabel = svgElement("text", {
    class: "rumor-map-label",
    x: map.cluePoint.x,
    y: map.cluePoint.y + 3,
    "text-anchor": "middle",
  });
  clueLabel.textContent = "?";

  const target = svgElement("polygon", {
    class: "rumor-target-marker",
    points: `${map.targetPoint.x},${map.targetPoint.y - 7} ${map.targetPoint.x + 7},${map.targetPoint.y} ${map.targetPoint.x},${map.targetPoint.y + 7} ${map.targetPoint.x - 7},${map.targetPoint.y}`,
  });
  target.append(svgTitle("Точная цель — только DEV"));

  const origin = svgElement("circle", {
    class: "rumor-origin-marker",
    cx: map.originPoint.x,
    cy: map.originPoint.y,
    r: 6,
  });
  const originLabel = svgElement("text", {
    class: "rumor-map-label",
    x: map.originPoint.x + 9,
    y: map.originPoint.y + 3,
  });
  originLabel.textContent = search.originCity.name;

  const caravan = svgElement("circle", {
    class: "rumor-caravan-marker",
    cx: map.caravanPoint.x,
    cy: map.caravanPoint.y,
    r: 7,
  });
  caravan.append(svgTitle("Караван"));

  rumorMap.append(
    minimumLabel,
    maximumLabel,
    clue,
    clueLabel,
    target,
    origin,
    originLabel,
    caravan,
  );
}

/**
 * @param {ReturnType<typeof createCaravanStatusSnapshot>} status
 */
function renderCaravanStatus(status) {
  const outcomeFailed = status.outcome?.status === "failed";
  const outcomeCompleted = status.outcome?.status === "completed";
  const doctrineStopped = status.outcome?.status === "paused";
  const doctrineContinues =
    status.doctrine?.status === "marked-and-continuing";
  const panelState = outcomeFailed
    ? "depleted"
    : outcomeCompleted
      ? "completed"
    : doctrineStopped
      ? "stopped"
    : status.forecast.canFinish
      ? "safe"
      : "risk";
  caravanPanel.dataset.state = panelState;
  caravanStateLabel.textContent =
    outcomeFailed
      ? "Экспедиция потеряна"
      : outcomeCompleted
        ? "Экспедиция завершена"
      : doctrineStopped
        ? "Остановлен у цели"
        : doctrineContinues
          ? "Цель отмечена · в пути"
      : panelState === "risk"
        ? "Риск истощения"
        : "Готов к пути";

  caravanRouteStatus.textContent =
    outcomeFailed
      ? `Погиб · сегмент ${(status.route.segmentIndex ?? 0) + 1}/4`
      : outcomeCompleted
        ? "Прибыл · маршрут завершён"
      : doctrineStopped
      ? `Стоянка · сегмент ${(status.route.segmentIndex ?? 0) + 1}/4`
      : status.route.status === "arrived"
      ? "Прибыл · маршрут завершён"
      : `В пути · сегмент ${(status.route.segmentIndex ?? 0) + 1}/4`;
  caravanDistance.textContent = `${formatNumber(status.route.traveledDistanceKilometers, 1)} / ${formatNumber(status.route.traveledDistanceKilometers + status.route.remainingDistanceKilometers, 1)} км`;
  routeProgress.value = status.route.progress;
  routeProgress.textContent = `${Math.round(status.route.progress * 100)}%`;
  routeProgressLabel.textContent = outcomeFailed
    ? `${Math.round(status.route.progress * 100)}% · ГИБЕЛЬ ${formatElapsed(status.outcome?.endedAtSeconds ?? 0)}`
    : outcomeCompleted
      ? `100% · ФИНИШ ${formatElapsed(status.outcome?.endedAtSeconds ?? 0)}`
      : doctrineStopped
        ? `${Math.round(status.route.progress * 100)}% · STOP ${formatElapsed(status.doctrine?.decision?.decidedAtSeconds ?? 0)}`
        : `${Math.round(status.route.progress * 100)}% · ETA ${formatDuration(status.route.totalDurationSeconds)}`;

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

  if (outcomeFailed) {
    forecastTitle.textContent = "Караван погиб";
    forecastDetail.textContent = `${formatDepletionCause(status.outcome?.failureCause ?? null)} исчерпаны на ${formatElapsed(status.outcome?.endedAtSeconds ?? 0)}.`;
  } else if (outcomeCompleted) {
    forecastTitle.textContent = "Экспедиция завершена";
    forecastDetail.textContent = `Финиш: еда ${formatNumber(status.supplies.foodRemaining, 1)} · вода ${formatNumber(status.supplies.waterRemaining, 1)}`;
  } else if (doctrineStopped) {
    forecastTitle.textContent = "Маршрут поставлен на паузу";
    forecastDetail.textContent = "Караван ждёт у найденной цели; это не финальный исход.";
  } else if (status.forecast.canFinish) {
    forecastTitle.textContent = "Запасов хватит до финиша";
    forecastDetail.textContent = `На финише: еда ${formatNumber(status.forecast.foodAtArrival, 1)} · вода ${formatNumber(status.forecast.waterAtArrival, 1)}`;
  } else {
    forecastTitle.textContent = "Запасов не хватит";
    forecastDetail.textContent = `${formatDepletionCause(status.forecast.depletionCause)} закончатся на ${formatElapsed(status.forecast.firstDepletionAtSeconds ?? 0)}`;
  }
}

/**
 * @param {ReturnType<typeof createExpeditionOutcomeSnapshot>} outcome
 */
function renderExpeditionOutcome(outcome) {
  outcomePanel.dataset.state = outcome.status;
  outcomeTime.textContent = formatElapsed(outcome.planned.atSeconds);
  outcomePosition.textContent =
    outcome.planned.segmentIndex === null
      ? `Финиш · ${formatNumber(outcome.planned.routeDistanceKilometers, 1)} км`
      : `Сегмент ${outcome.planned.segmentIndex + 1} · ${formatNumber(outcome.planned.routeDistanceKilometers, 1)} км`;

  if (outcome.status === "in-progress") {
    outcomeState.textContent = "В пути";
    outcomeTitle.textContent = "Экспедиция продолжается";
    outcomeAction.textContent = "DEV: к исходу";
    if (outcome.planned.status === "failed") {
      outcomeDetail.textContent =
        "Если план не изменить, критические запасы закончатся раньше финиша.";
      outcomeCause.textContent = formatDepletionCause(
        outcome.planned.failureCause,
      );
    } else if (outcome.planned.status === "paused") {
      outcomeDetail.textContent =
        "Следующая граница исполнения — автоматическая остановка у найденной цели.";
      outcomeCause.textContent = "Доктрина STOP";
    } else {
      outcomeDetail.textContent =
        "Маршрут и запас провизии позволяют добраться до конечной точки.";
      outcomeCause.textContent = "Прибытие";
    }
    return;
  }

  outcomeAction.textContent = "Повторить экспедицию";
  if (outcome.status === "failed") {
    outcomeState.textContent = "Поражение";
    outcomeTitle.textContent = "Караван погиб в пути";
    outcomeDetail.textContent =
      "Фатальное истощение остановило движение; будущие этапы и прибытие отменены.";
    outcomeCause.textContent = formatDepletionCause(outcome.failureCause);
  } else if (outcome.status === "completed") {
    outcomeState.textContent = "Успех";
    outcomeTitle.textContent = "Экспедиция завершена";
    outcomeDetail.textContent =
      "Караван достиг конечной точки маршрута и сохранил оставшиеся запасы.";
    outcomeCause.textContent = "Прибытие";
  } else {
    outcomeState.textContent = "Пауза";
    outcomeTitle.textContent = "Караван остановлен у цели";
    outcomeDetail.textContent =
      "Доктрина STOP прервала движение, но экспедиция не считается завершённой.";
    outcomeCause.textContent = "Доктрина STOP";
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

/** @returns {import("../sim-core/dist/src/index.js").StaticObjectDiscoveryDoctrine} */
function readDiscoveryDoctrine() {
  return doctrineMarkAndContinue.checked ? "MARK_AND_CONTINUE" : "STOP";
}

/**
 * @param {ReturnType<typeof createDebugMapSnapshot>} snapshot
 * @param {ReturnType<typeof createFourSegmentRouteSnapshot>} route
 * @param {ReturnType<typeof createRumorSearchSnapshot>} rumorSearch
 * @param {ReturnType<typeof createDiscoveryDoctrineSnapshot>} doctrine
 * @param {ReturnType<typeof createExpeditionOutcomeSnapshot>} outcome
 */
function drawSnapshot(snapshot, route, rumorSearch, doctrine, outcome) {
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

  const rumorTarget = rumorSearch.serverTruth.target;
  const rumorTargetPoint = projectCoordinate(rumorTarget.position);
  const rumorTargetMarker = svgElement("circle", {
    class: "rumor-world-target",
    cx: rumorTargetPoint.x,
    cy: rumorTargetPoint.y,
    r: 8,
    "data-detail-title": `Цель слуха · ${rumorTarget.id}`,
    "data-detail-rows": JSON.stringify([
      ["Тип", staticKindLabel(rumorTarget.kind)],
      ["Статус", "Точная server truth · DEV"],
      ["Азимут", `${rumorSearch.serverTruth.exactBearingDeg.toFixed(6)}°`],
      ["Дистанция", `${rumorSearch.serverTruth.exactDistanceKilometers.toFixed(6)} км`],
      ["Широта", rumorTarget.position.latitudeDeg.toFixed(6)],
      ["Долгота", rumorTarget.position.longitudeDeg.toFixed(6)],
    ]),
  });
  rumorTargetMarker.append(svgTitle("Точная цель слуха — только DEV"));
  const rumorTargetLabel = svgElement("text", {
    class: "rumor-world-target-label",
    x: rumorTargetPoint.x + 11,
    y: rumorTargetPoint.y - 9,
  });
  rumorTargetLabel.textContent = "RUMOR TARGET";
  worldMap.append(rumorTargetMarker, rumorTargetLabel);

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
    outcome.status === "failed"
      ? `Погиб · сегмент ${(route.position.segmentIndex ?? 0) + 1}`
      : outcome.status === "paused"
      ? `Остановлен · сегмент ${(route.position.segmentIndex ?? 0) + 1}`
      : outcome.status === "completed"
        ? "Экспедиция завершена"
      : route.position.segmentIndex === null
      ? "Прибыл"
      : `Сегмент ${route.position.segmentIndex + 1}`;
  const caravan = svgElement("g", {
    "data-detail-title": "Караван · активный маршрут",
    "data-detail-rows": JSON.stringify([
      ["Статус", caravanSegment],
      ["Исход", outcome.status],
      ["Доктрина", doctrine.doctrine],
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
      class: `caravan-marker caravan-marker--${outcome.status}`,
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

/** @param {keyof typeof STATIC_KIND_LABELS | null} kind */
function staticKindLabel(kind) {
  return kind ? STATIC_KIND_LABELS[kind] : "Скрытый объект";
}

/** @param {ReturnType<typeof createFourSegmentRouteSnapshot>} route */
function formatRouteSummary(route) {
  return `${route.totalDistanceKilometers.toLocaleString("ru-RU", { maximumFractionDigits: 1 })} км · ETA ${formatDuration(route.totalDurationSeconds)} · ${route.speedKilometersPerHour.toFixed(1)} км/ч`;
}
