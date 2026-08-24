// @ts-check

import {
  CONTACT_ZOOM_HEIGHT,
  CONTACT_ZOOM_WIDTH,
  DEBUG_MAP_HEIGHT,
  DEBUG_MAP_WIDTH,
  KNOWLEDGE_MAP_HEIGHT,
  KNOWLEDGE_MAP_WIDTH,
  SIMULATION_CLOCK_SPEED_MULTIPLIERS,
  advanceSimulationClock,
  applyExpeditionOutcomeToRoute,
  createCaravanStatusSnapshot,
  createCityArrivalRoutePreset,
  createCityArrivalSnapshot,
  createContactZoomSnapshot,
  createDebugMapSnapshot,
  createDiscoveryDoctrineSnapshot,
  createDiscoveryResumeSnapshot,
  createDiscoveryStopLifecycleSnapshot,
  createExpeditionEventLogSnapshot,
  createExpeditionOutcomeSnapshot,
  createFourSegmentRouteSnapshot,
  createMonsterContactSnapshot,
  createMonsterInterceptRoutePreset,
  createKnownObjectReturnRoutePreset,
  createRumorSearchSnapshot,
  createSessionKnowledgeMapSnapshot,
  createStationaryStopPatrolPreset,
  projectCoordinate,
} from "./map-model.js";
import {
  createPlayerDiscoveryLedger,
  recordDirectDiscoveryObservation,
  wasObjectKnownBeforeExpedition,
} from "../sim-core/dist/src/index.js";

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
const clockToggle = requireElement("clock-toggle", HTMLButtonElement);
const clockToggleIcon = requireElement("clock-toggle-icon", HTMLSpanElement);
const clockToggleLabel = requireElement("clock-toggle-label", HTMLSpanElement);
const clockSpeed = requireElement("clock-speed", HTMLSelectElement);
const clockStatus = requireElement("clock-status", HTMLOutputElement);
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
const routeDestinationCity = requireElement(
  "route-destination-city",
  HTMLSelectElement,
);
const routeSpeed = requireElement("route-speed", HTMLInputElement);
const cityDevRoute = requireElement("city-dev-route", HTMLButtonElement);
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
const stopIdleHours = requireElement("stop-idle-hours", HTMLInputElement);
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
const knowledgeCount = requireElement("knowledge-count", HTMLOutputElement);
const knowledgeExpedition = requireElement(
  "knowledge-expedition",
  HTMLOutputElement,
);
const knowledgeEmpty = requireElement(
  "knowledge-empty",
  HTMLParagraphElement,
);
const knowledgeList = requireElement("knowledge-list", HTMLOListElement);
const knowledgeMap = requireElement("knowledge-map", SVGSVGElement);
const knowledgeMapOrigin = requireElement(
  "knowledge-map-origin",
  HTMLSelectElement,
);
const knowledgeMapScale = requireElement(
  "knowledge-map-scale",
  HTMLOutputElement,
);
const knowledgeRouteStatus = requireElement(
  "knowledge-route-status",
  HTMLOutputElement,
);
const knowledgeReset = requireElement("knowledge-reset", HTMLButtonElement);
const contactPanel = requireElement("contact-panel", HTMLElement);
const contactState = requireElement("contact-state", HTMLParagraphElement);
const contactTitle = requireElement("contact-title", HTMLHeadingElement);
const contactDetail = requireElement("contact-detail", HTMLParagraphElement);
const contactTime = requireElement("contact-time", HTMLElement);
const contactMonster = requireElement("contact-monster", HTMLElement);
const contactPosition = requireElement("contact-position", HTMLElement);
const contactDistance = requireElement("contact-distance", HTMLElement);
const contactPlayerPower = requireElement("contact-player-power", HTMLElement);
const contactPowerComparison = requireElement(
  "contact-power-comparison",
  HTMLElement,
);
const contactMonsterSpeed = requireElement("contact-monster-speed", HTMLElement);
const contactFleeResult = requireElement("contact-flee-result", HTMLElement);
const contactMonsterSelect = requireElement(
  "contact-monster-select",
  HTMLSelectElement,
);
const contactFleeSpeed = requireElement(
  "contact-flee-speed",
  HTMLInputElement,
);
const contactDoctrineFlee = requireElement(
  "contact-doctrine-flee",
  HTMLInputElement,
);
const contactDoctrineFight = requireElement(
  "contact-doctrine-fight",
  HTMLInputElement,
);
const contactDevRoute = requireElement("contact-dev-route", HTMLButtonElement);
const contactStopDevRoute = requireElement(
  "contact-stop-dev-route",
  HTMLButtonElement,
);
const contactSpatialZoom = requireElement(
  "contact-spatial-zoom",
  HTMLSelectElement,
);
const contactTimeZoom = requireElement("contact-time-zoom", HTMLSelectElement);
const contactZoomMap = requireElement("contact-zoom-map", SVGSVGElement);
const contactZoomCaption = requireElement(
  "contact-zoom-caption",
  HTMLParagraphElement,
);

let elapsedSeconds = 0;
let clockRunning = false;
let clockSpeedMultiplier = readClockSpeedMultiplier();
/** @type {number | null} */
let clockFrameId = null;
/** @type {number | null} */
let clockAnchorTimestampMilliseconds = null;
let clockAnchorElapsedSeconds = 0;
let supplySettings = readSupplySettings();
let expeditionNumber = 1;
let discoveryLedger = createPlayerDiscoveryLedger(seedInput.value.trim());
/** @type {string | null} */
let preparedKnowledgeObjectId = null;
/** @type {string | null} */
let selectedKnowledgeMapOriginCityId = null;
/** @type {string | null} */
let resumedDiscoveryObjectId = null;
let stationaryStopQaEnabled = false;
/** @type {ReturnType<typeof createRumorSearchSnapshot> | null} */
let activeRumorSearch = null;
/** @type {ReturnType<typeof createDiscoveryDoctrineSnapshot> | null} */
let activeDoctrine = null;
/** @type {ReturnType<typeof createExpeditionOutcomeSnapshot> | null} */
let activeOutcome = null;
/** @type {ReturnType<typeof createDebugMapSnapshot> | null} */
let activeSnapshot = null;

seedForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const nextSeed = seedInput.value.trim();
  if (nextSeed.length > 0 && nextSeed !== discoveryLedger.worldSeed) {
    discoveryLedger = createPlayerDiscoveryLedger(nextSeed);
    expeditionNumber = 1;
    preparedKnowledgeObjectId = null;
    selectedKnowledgeMapOriginCityId = null;
  }
  resetSimulationClock();
  render();
});

timeSlider.addEventListener("input", () => {
  pauseSimulationClock();
  elapsedSeconds = Number(timeSlider.value);
  render();
});

clockToggle.addEventListener("click", () => {
  if (clockRunning) {
    synchronizeSimulationClock(performance.now());
    pauseSimulationClock();
    return;
  }

  startSimulationClock();
});

clockSpeed.addEventListener("change", () => {
  const nextMultiplier = readClockSpeedMultiplier();
  if (clockRunning) {
    const timestampMilliseconds = performance.now();
    const reachedBoundary = synchronizeSimulationClock(timestampMilliseconds);
    clockSpeedMultiplier = nextMultiplier;
    if (reachedBoundary) {
      pauseSimulationClock();
      return;
    }
    clockAnchorElapsedSeconds = elapsedSeconds;
    clockAnchorTimestampMilliseconds = timestampMilliseconds;
  } else {
    clockSpeedMultiplier = nextMultiplier;
  }
  updateClockControls();
});

routeForm.addEventListener("submit", (event) => {
  event.preventDefault();
  preparedKnowledgeObjectId = null;
  resetSimulationClock();
  render();
});

supplyForm.addEventListener("submit", (event) => {
  event.preventDefault();
  supplySettings = readSupplySettings();
  resetSimulationClock();
  render();
});

doctrineStop.addEventListener("change", clearDiscoveryResumeAndRender);
doctrineMarkAndContinue.addEventListener(
  "change",
  clearDiscoveryResumeAndRender,
);
stopIdleHours.addEventListener("change", clearDiscoveryResumeAndRender);
contactMonsterSelect.addEventListener("change", () => {
  resetSimulationClock();
  render();
});
contactDoctrineFlee.addEventListener("change", pauseClockAndRender);
contactDoctrineFight.addEventListener("change", pauseClockAndRender);
contactFleeSpeed.addEventListener("change", pauseClockAndRender);
contactSpatialZoom.addEventListener("change", render);
contactTimeZoom.addEventListener("change", render);
knowledgeMapOrigin.addEventListener("change", () => {
  selectedKnowledgeMapOriginCityId = knowledgeMapOrigin.value || null;
  render();
});
knowledgeReset.addEventListener("click", () => {
  const seed = seedInput.value.trim();
  if (seed.length === 0) return;
  discoveryLedger = createPlayerDiscoveryLedger(seed);
  expeditionNumber = 1;
  preparedKnowledgeObjectId = null;
  selectedKnowledgeMapOriginCityId = null;
  resetSimulationClock();
  render();
});

knowledgeList.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest("button[data-knowledge-object-id]");
  if (!(button instanceof HTMLButtonElement)) return;
  const objectId = button.dataset.knowledgeObjectId;
  if (!objectId) return;

  const preset = createKnownObjectReturnRoutePreset(
    discoveryLedger,
    objectId,
  );
  stationaryStopQaEnabled = false;
  expeditionNumber += 1;
  preparedKnowledgeObjectId = preset.objectId;
  selectedKnowledgeMapOriginCityId = preset.originCityId;
  routeStartCity.value = preset.originCityId;
  routeBearingInputs.forEach((input, index) => {
    input.value = preset.commands[index]?.bearingDeg.toFixed(6) ?? "0";
  });
  routeDistanceInputs.forEach((input, index) => {
    input.value =
      preset.commands[index]?.distanceKilometers.toFixed(6) ?? "0";
  });
  resetSimulationClock();
  render();
});

outcomeAction.addEventListener("click", () => {
  if (!activeOutcome) return;
  pauseSimulationClock();
  if (
    activeOutcome.status === "paused" &&
    activeOutcome.interruptionCause === "doctrine-stop" &&
    activeDoctrine?.decision
  ) {
    resumedDiscoveryObjectId = activeDoctrine.decision.objectId;
    render();
    return;
  }
  if (activeOutcome.status === "in-progress") {
    elapsedSeconds =
      activeOutcome.phase === "idle-at-stop" &&
      activeOutcome.resumeAtSeconds !== null &&
      !(
        activeOutcome.planned.status === "failed" &&
        activeOutcome.planned.atSeconds <=
          activeOutcome.resumeAtSeconds + 1e-9
      )
        ? activeOutcome.resumeAtSeconds
        : activeOutcome.planned.atSeconds;
  } else {
    expeditionNumber += 1;
    resetSimulationClock();
  }
  timeSlider.value = String(elapsedSeconds);
  render();
});

rumorDevRoute.addEventListener("click", () => {
  if (!activeRumorSearch) return;

  stationaryStopQaEnabled = false;
  preparedKnowledgeObjectId = null;
  const { exactBearingDeg, exactDistanceKilometers } =
    activeRumorSearch.serverTruth;
  routeBearingInputs.forEach((input, index) => {
    input.value = index === 0 ? exactBearingDeg.toFixed(6) : "0";
  });
  routeDistanceInputs.forEach((input, index) => {
    input.value = index === 0 ? exactDistanceKilometers.toFixed(6) : "0";
  });
  resetSimulationClock();
  render();
});

contactDevRoute.addEventListener("click", () => {
  const monster = activeSnapshot?.monsters.find(
    (candidate) => candidate.id === contactMonsterSelect.value,
  );
  if (!activeSnapshot || !monster) return;

  const candidates = activeSnapshot.cities.map((city) => ({
    city,
    preset: createMonsterInterceptRoutePreset(city.position, monster),
  }));
  candidates.sort(
    (left, right) =>
      left.preset.commands[0].distanceKilometers -
        right.preset.commands[0].distanceKilometers ||
      left.city.id.localeCompare(right.city.id),
  );
  const selected = candidates[0];
  if (!selected) return;

  stationaryStopQaEnabled = false;
  preparedKnowledgeObjectId = null;
  routeStartCity.value = selected.city.id;
  routeSpeed.value = selected.preset.speedKilometersPerHour.toFixed(6);
  routeBearingInputs.forEach((input, index) => {
    input.value = selected.preset.commands[index]?.bearingDeg.toFixed(6) ?? "0";
  });
  routeDistanceInputs.forEach((input, index) => {
    input.value =
      selected.preset.commands[index]?.distanceKilometers.toFixed(6) ?? "0";
  });
  resetSimulationClock();
  render();
});

contactStopDevRoute.addEventListener("click", () => {
  if (!activeRumorSearch) return;

  preparedKnowledgeObjectId = null;
  const { exactBearingDeg, exactDistanceKilometers } =
    activeRumorSearch.serverTruth;
  routeBearingInputs.forEach((input, index) => {
    input.value = index === 0 ? exactBearingDeg.toFixed(6) : "0";
  });
  routeDistanceInputs.forEach((input, index) => {
    input.value = index === 0 ? exactDistanceKilometers.toFixed(6) : "0";
  });
  doctrineStop.checked = true;
  stopIdleHours.value = "6";
  stationaryStopQaEnabled = true;
  resetSimulationClock();
  render();
});

cityDevRoute.addEventListener("click", () => {
  const startCity = activeSnapshot?.cities.find(
    (city) => city.id === routeStartCity.value,
  );
  const destinationCity = activeSnapshot?.cities.find(
    (city) => city.id === routeDestinationCity.value,
  );
  if (!startCity || !destinationCity) return;

  stationaryStopQaEnabled = false;
  preparedKnowledgeObjectId = null;
  const preset = createCityArrivalRoutePreset(
    startCity.position,
    destinationCity,
  );
  routeBearingInputs.forEach((input, index) => {
    input.value = preset.commands[index]?.bearingDeg.toFixed(6) ?? "0";
  });
  routeDistanceInputs.forEach((input, index) => {
    input.value =
      preset.commands[index]?.distanceKilometers.toFixed(6) ?? "0";
  });
  doctrineMarkAndContinue.checked = true;
  const weakMonster = activeSnapshot?.monsters.find(
    (monster) => monster.power < 100,
  );
  if (weakMonster) contactMonsterSelect.value = weakMonster.id;
  resetSimulationClock();
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
    const snapshot = createDebugMapSnapshot(
      seedInput.value.trim(),
      elapsedSeconds,
      2,
    );
    if (discoveryLedger.worldSeed !== snapshot.seed) {
      discoveryLedger = createPlayerDiscoveryLedger(snapshot.seed);
      expeditionNumber = 1;
      preparedKnowledgeObjectId = null;
      selectedKnowledgeMapOriginCityId = null;
    }
    const knownObjectIds = discoveryLedger.entries
      .filter(
        (entry) =>
          wasObjectKnownBeforeExpedition(
            discoveryLedger,
            entry.objectId,
            expeditionNumber,
          ),
      )
      .map((entry) => entry.objectId);
    syncCityOptions(snapshot.cities);
    syncContactMonsterOptions(snapshot.monsters);
    const startCity = snapshot.cities.find(
      (city) => city.id === routeStartCity.value,
    );
    if (!startCity) throw new Error("Выберите существующий стартовый город");
    const destinationCity = snapshot.cities.find(
      (city) => city.id === routeDestinationCity.value,
    );
    if (!destinationCity) {
      throw new Error("Выберите существующий город назначения");
    }

    const timelineRoute = createFourSegmentRouteSnapshot(
      startCity.position,
      readRouteCommands(),
      routeSpeed.valueAsNumber,
      elapsedSeconds,
    );
    const timelineRumorSearch = createRumorSearchSnapshot(
      snapshot.seed,
      startCity,
      timelineRoute,
      knownObjectIds,
    );
    const timelineDoctrine = createDiscoveryDoctrineSnapshot(
      timelineRoute,
      timelineRumorSearch,
      readDiscoveryDoctrine(),
    );
    const timelineResume = createDiscoveryResumeSnapshot(
      timelineDoctrine,
      resumedDiscoveryObjectId,
    );
    const cityTimelineDestination = createCityArrivalSnapshot(
      timelineRoute,
      destinationCity,
    );
    let lifecycleResume = timelineResume;
    if (
      lifecycleResume === null &&
      resumedDiscoveryObjectId !== null &&
      timelineRumorSearch.serverTruth.plannedDiscoveryAtSeconds !== null
    ) {
      const stopRoute = createFourSegmentRouteSnapshot(
        startCity.position,
        readRouteCommands(),
        routeSpeed.valueAsNumber,
        timelineRumorSearch.serverTruth.plannedDiscoveryAtSeconds,
      );
      const stopSearch = createRumorSearchSnapshot(
        snapshot.seed,
        startCity,
        stopRoute,
        knownObjectIds,
      );
      const stoppedDoctrine = createDiscoveryDoctrineSnapshot(
        stopRoute,
        stopSearch,
        readDiscoveryDoctrine(),
      );
      lifecycleResume = createDiscoveryResumeSnapshot(
        stoppedDoctrine,
        resumedDiscoveryObjectId,
      );
    }
    const scheduledIdleDurationSeconds = readStopIdleDurationSeconds();
    const stopLifecycle = createDiscoveryStopLifecycleSnapshot(
      timelineRoute,
      supplySettings.initial,
      supplySettings.profile,
      lifecycleResume,
      scheduledIdleDurationSeconds,
      elapsedSeconds,
      cityTimelineDestination,
    );
    const plannedRoute = stopLifecycle
      ? createFourSegmentRouteSnapshot(
          startCity.position,
          readRouteCommands(),
          routeSpeed.valueAsNumber,
          stopLifecycle.movementElapsedSeconds,
        )
      : timelineRoute;
    const plannedRumorSearch = createRumorSearchSnapshot(
      snapshot.seed,
      startCity,
      plannedRoute,
      knownObjectIds,
    );
    const proposedDoctrine = createDiscoveryDoctrineSnapshot(
      plannedRoute,
      plannedRumorSearch,
      readDiscoveryDoctrine(),
    );
    const proposedResume = createDiscoveryResumeSnapshot(
      proposedDoctrine,
      resumedDiscoveryObjectId,
    );
    let selectedMonster = snapshot.monsters.find(
      (monster) => monster.id === contactMonsterSelect.value,
    );
    const plannedStop =
      timelineRumorSearch.serverTruth.plannedDiscovery ?? null;
    if (
      stationaryStopQaEnabled &&
      selectedMonster &&
      plannedStop &&
      scheduledIdleDurationSeconds > 0
    ) {
      const contactAtSeconds =
        plannedStop.elapsedSeconds + scheduledIdleDurationSeconds / 2;
      const qaMonster = createStationaryStopPatrolPreset(
        plannedStop.caravanPosition,
        contactAtSeconds,
        selectedMonster,
        elapsedSeconds,
      );
      const selectedMonsterIndex = snapshot.monsters.findIndex(
        (monster) => monster.id === selectedMonster?.id,
      );
      if (selectedMonsterIndex >= 0) {
        snapshot.monsters[selectedMonsterIndex] = qaMonster;
      }
      selectedMonster = qaMonster;
    }
    const monsterContact = selectedMonster
      ? createMonsterContactSnapshot(
          plannedRoute,
          selectedMonster,
          stopLifecycle,
        )
      : null;
    const cityDestination = createCityArrivalSnapshot(
      plannedRoute,
      destinationCity,
    );
    const outcome = createExpeditionOutcomeSnapshot(
      plannedRoute,
      supplySettings.initial,
      supplySettings.profile,
      proposedResume ?? proposedDoctrine,
      monsterContact,
      readStrongMonsterDoctrine(),
      contactFleeSpeed.valueAsNumber / 3.6,
      cityDestination,
      stopLifecycle,
    );
    const effectiveStopLifecycle = outcome.stopLifecycle ?? stopLifecycle;
    const route = applyExpeditionOutcomeToRoute(plannedRoute, outcome);
    const rumorSearch = createRumorSearchSnapshot(
      snapshot.seed,
      startCity,
      route,
      knownObjectIds,
    );
    const doctrine = createDiscoveryDoctrineSnapshot(
      route,
      rumorSearch,
      readDiscoveryDoctrine(),
    );
    const resume = createDiscoveryResumeSnapshot(
      doctrine,
      resumedDiscoveryObjectId,
    );
    const effectiveDoctrine = resume ?? doctrine;
    if (rumorSearch.status === "found" && rumorSearch.discovery) {
      const recorded = recordDirectDiscoveryObservation(discoveryLedger, {
        expeditionNumber,
        objectId: rumorSearch.serverTruth.target.id,
        objectKind: rumorSearch.rumor.targetKind,
        originCityId: rumorSearch.originCity.id,
        rumorId: rumorSearch.rumor.id,
        observedAtSeconds: rumorSearch.discovery.atSeconds,
        segmentIndex: rumorSearch.discovery.segmentIndex,
        routeDistanceMeters:
          rumorSearch.discovery.routeDistanceKilometers * 1_000,
        originBearingDeg: rumorSearch.serverTruth.exactBearingDeg,
        originDistanceMeters:
          rumorSearch.serverTruth.exactDistanceKilometers * 1_000,
      });
      discoveryLedger = recorded.ledger;
    }
    const caravanStatus = createCaravanStatusSnapshot(
      route,
      supplySettings.initial,
      supplySettings.profile,
      effectiveDoctrine,
      outcome,
    );
    activeRumorSearch = rumorSearch;
    activeDoctrine = doctrine;
    activeOutcome = outcome;
    activeSnapshot = snapshot;
    const eventLog = createExpeditionEventLogSnapshot(
      route,
      supplySettings.initial,
      supplySettings.profile,
      rumorSearch,
      doctrine,
      outcome,
      resume ?? lifecycleResume,
      effectiveStopLifecycle,
    );
    const maximumElapsedSeconds = outcome.planned.atSeconds;

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
    renderRumorSearch(rumorSearch, effectiveDoctrine, outcome);
    renderDiscoveryLedger(discoveryLedger, snapshot);
    renderCaravanStatus(caravanStatus);
    renderExpeditionOutcome(outcome);
    renderMonsterContact(monsterContact, outcome);
    renderContactZoom(
      route,
      selectedMonster ?? null,
      monsterContact,
      effectiveStopLifecycle,
    );
    renderEventLog(eventLog, route);

    timeSlider.max = String(Math.max(1, Math.ceil(maximumElapsedSeconds)));
    timeSlider.value = String(elapsedSeconds);
    updateClockControls();

    drawSnapshot(
      snapshot,
      route,
      rumorSearch,
      effectiveDoctrine,
      outcome,
      monsterContact,
    );
  } catch (error) {
    activeRumorSearch = null;
    activeDoctrine = null;
    activeOutcome = null;
    activeSnapshot = null;
    contactZoomMap.replaceChildren();
    contactZoomCaption.textContent = "Локальное окно недоступно.";
    pauseSimulationClock();
    errorMessage.textContent = error instanceof Error ? error.message : String(error);
    errorMessage.hidden = false;
  }
}

/** @returns {void} */
function startSimulationClock() {
  if (!activeOutcome || activeOutcome.status !== "in-progress") {
    updateClockControls();
    return;
  }

  clockRunning = true;
  clockAnchorElapsedSeconds = elapsedSeconds;
  clockAnchorTimestampMilliseconds = performance.now();
  clockFrameId = requestAnimationFrame(runSimulationClockFrame);
  updateClockControls();
}

/** @param {number} timestampMilliseconds @returns {void} */
function runSimulationClockFrame(timestampMilliseconds) {
  clockFrameId = null;
  if (!clockRunning) return;

  const reachedBoundary = synchronizeSimulationClock(timestampMilliseconds);
  if (
    reachedBoundary ||
    !activeOutcome ||
    activeOutcome.status !== "in-progress"
  ) {
    pauseSimulationClock();
    return;
  }

  clockFrameId = requestAnimationFrame(runSimulationClockFrame);
}

/**
 * Re-evaluates elapsed simulation time from one stable play anchor, making the
 * result independent from animation-frame partitioning.
 * @param {number} timestampMilliseconds
 * @returns {boolean}
 */
function synchronizeSimulationClock(timestampMilliseconds) {
  if (
    !clockRunning ||
    !activeOutcome ||
    clockAnchorTimestampMilliseconds === null
  ) {
    return false;
  }

  const realElapsedSeconds = Math.max(
    0,
    (timestampMilliseconds - clockAnchorTimestampMilliseconds) / 1_000,
  );
  const advanced = advanceSimulationClock(
    clockAnchorElapsedSeconds,
    realElapsedSeconds,
    clockSpeedMultiplier,
    activeOutcome.planned.atSeconds,
  );
  elapsedSeconds = advanced.elapsedSeconds;
  timeSlider.value = String(elapsedSeconds);
  render();
  return (
    advanced.reachedBoundary ||
    !activeOutcome ||
    activeOutcome.status !== "in-progress"
  );
}

/** @returns {void} */
function pauseSimulationClock() {
  clockRunning = false;
  clockAnchorTimestampMilliseconds = null;
  clockAnchorElapsedSeconds = elapsedSeconds;
  if (clockFrameId !== null) {
    cancelAnimationFrame(clockFrameId);
    clockFrameId = null;
  }
  updateClockControls();
}

/** @returns {void} */
function resetSimulationClock() {
  pauseSimulationClock();
  elapsedSeconds = 0;
  resumedDiscoveryObjectId = null;
  timeSlider.value = "0";
}

/** @returns {void} */
function pauseClockAndRender() {
  pauseSimulationClock();
  render();
}

/** @returns {void} */
function clearDiscoveryResumeAndRender() {
  resumedDiscoveryObjectId = null;
  pauseClockAndRender();
}

/** @returns {number} */
function readClockSpeedMultiplier() {
  const speedMultiplier = Number(clockSpeed.value);
  if (!SIMULATION_CLOCK_SPEED_MULTIPLIERS.includes(speedMultiplier)) {
    throw new RangeError("Выберите скорость x1, x10, x100 или x1000");
  }
  return speedMultiplier;
}

/** @returns {void} */
function updateClockControls() {
  const canRun = activeOutcome?.status === "in-progress";
  clockToggle.disabled = !canRun;
  clockToggle.setAttribute("aria-pressed", String(clockRunning));
  clockToggleIcon.textContent = clockRunning ? "❚❚" : "▶";
  clockToggleLabel.textContent = clockRunning ? "Пауза" : "Запустить";

  const state = clockRunning
    ? "running"
    : activeOutcome && activeOutcome.status !== "in-progress"
      ? "boundary"
      : "paused";
  clockStatus.dataset.state = state;
  clockStatus.textContent = `${
    state === "running"
      ? "Идёт"
      : state === "boundary"
        ? "Граница достигнута"
        : "Остановлено"
  } · x${clockSpeedMultiplier}`;
}

/**
 * @param {ReturnType<typeof createFourSegmentRouteSnapshot>} route
 * @param {ReturnType<typeof createDebugMapSnapshot>["monsters"][number] | null} monster
 * @param {ReturnType<typeof createMonsterContactSnapshot> | null} contact
 * @param {ReturnType<typeof createDiscoveryStopLifecycleSnapshot> | null} stopLifecycle
 */
function renderContactZoom(route, monster, contact, stopLifecycle) {
  contactZoomMap.replaceChildren();
  if (!monster) {
    contactZoomCaption.textContent = "Выберите патруль для локального окна.";
    return;
  }

  const snapshot = createContactZoomSnapshot(
    route,
    monster,
    contact,
    Number(contactSpatialZoom.value),
    Number(contactTimeZoom.value),
    stopLifecycle,
  );
  const centerX = CONTACT_ZOOM_WIDTH / 2;
  const centerY = CONTACT_ZOOM_HEIGHT / 2;
  const maximumRingPixels = snapshot.spatialRadiusMeters / snapshot.metersPerPixel;

  contactZoomMap.append(
    svgElement("line", {
      class: "contact-zoom-crosshair",
      x1: 0,
      x2: CONTACT_ZOOM_WIDTH,
      y1: centerY,
      y2: centerY,
    }),
    svgElement("line", {
      class: "contact-zoom-crosshair",
      x1: centerX,
      x2: centerX,
      y1: 0,
      y2: CONTACT_ZOOM_HEIGHT,
    }),
  );

  for (const ratio of [0.5, 1]) {
    contactZoomMap.append(
      svgElement("circle", {
        class: "contact-zoom-grid",
        cx: centerX,
        cy: centerY,
        r: maximumRingPixels * ratio,
      }),
    );
    const label = svgElement("text", {
      class: "contact-zoom-label",
      x: centerX + 6,
      y: centerY - maximumRingPixels * ratio + 12,
    });
    label.textContent = `${formatNumber(
      (snapshot.spatialRadiusMeters * ratio) / 1_000,
      1,
    )} км`;
    contactZoomMap.append(label);
  }

  const caravanPath = svgElement("polyline", {
    class: "contact-zoom-caravan-path",
    points: snapshot.caravanPath
      .map(({ point }) => `${point.x},${point.y}`)
      .join(" "),
  });
  caravanPath.append(svgTitle("Траектория каравана во временном окне"));
  const monsterPath = svgElement("polyline", {
    class: "contact-zoom-monster-path",
    points: snapshot.monsterPath
      .map(({ point }) => `${point.x},${point.y}`)
      .join(" "),
  });
  monsterPath.append(svgTitle("Траектория циклического патруля во временном окне"));
  const interactionRadius = svgElement("circle", {
    class: "contact-zoom-interaction-radius",
    cx: snapshot.focusMonster.point.x,
    cy: snapshot.focusMonster.point.y,
    r: snapshot.interactionRadiusPixels,
  });
  interactionRadius.append(
    svgTitle(`Interaction radius ${snapshot.interactionRadiusMeters} м`),
  );
  contactZoomMap.append(caravanPath, monsterPath, interactionRadius);

  const caravanMarker = svgElement("circle", {
    class: "contact-zoom-caravan-marker",
    cx: snapshot.focusCaravan.point.x,
    cy: snapshot.focusCaravan.point.y,
    r: 6,
  });
  caravanMarker.append(svgTitle(`Караван · ${formatElapsed(snapshot.focusAtSeconds)}`));
  const monsterMarker = svgElement("polygon", {
    class: "contact-zoom-monster-marker",
    points: `${snapshot.focusMonster.point.x},${snapshot.focusMonster.point.y - 7} ${snapshot.focusMonster.point.x + 7},${snapshot.focusMonster.point.y + 6} ${snapshot.focusMonster.point.x - 7},${snapshot.focusMonster.point.y + 6}`,
  });
  monsterMarker.append(
    svgTitle(`${monster.id} · PWR ${monster.power} · ${formatElapsed(snapshot.focusAtSeconds)}`),
  );
  contactZoomMap.append(caravanMarker, monsterMarker);

  const northLabel = svgElement("text", {
    class: "contact-zoom-label",
    x: 12,
    y: 19,
  });
  northLabel.textContent = "↑ N";
  const focusLabel = svgElement("text", {
    class: "contact-zoom-label",
    x: 12,
    y: CONTACT_ZOOM_HEIGHT - 12,
  });
  focusLabel.textContent =
    snapshot.focusKind === "contact" ? "FOCUS: CONTACT" : "FOCUS: PATROL";
  contactZoomMap.append(northLabel, focusLabel);

  const spatialLabel = formatNumber(snapshot.spatialRadiusMeters / 1_000, 0);
  const timeLabel =
    snapshot.timeRadiusSeconds >= 3_600
      ? `${formatNumber(snapshot.timeRadiusSeconds / 3_600, 0)} ч`
      : `${formatNumber(snapshot.timeRadiusSeconds / 60, 0)} мин`;
  contactZoomCaption.textContent = `${
    snapshot.focusKind === "contact" ? "Плановый контакт" : "Текущий патруль"
  } · ${formatElapsed(snapshot.focusAtSeconds)} · пространство ±${spatialLabel} км · время ±${timeLabel} (${formatElapsed(snapshot.windowStartSeconds)} — ${formatElapsed(snapshot.windowEndSeconds)}).`;
  contactZoomMap.setAttribute(
    "aria-label",
    `Локальная карта ${snapshot.focusKind === "contact" ? "планового контакта" : "текущего патруля"} в ${formatElapsed(snapshot.focusAtSeconds)}`,
  );
}

/**
 * @param {ReturnType<typeof createMonsterContactSnapshot> | null} snapshot
 * @param {ReturnType<typeof createExpeditionOutcomeSnapshot>} outcome
 */
function renderMonsterContact(snapshot, outcome) {
  const contact = snapshot?.contact ?? null;
  if (!contact) {
    contactPanel.dataset.state = "clear";
    contactState.textContent = "Чистый маршрут";
    contactTitle.textContent = "Контакта на маршруте нет";
    contactDetail.textContent =
      "SIM-008 не нашёл сближения с патрулём внутри радиуса взаимодействия.";
    contactTime.textContent = "—";
    contactMonster.textContent = "—";
    contactPosition.textContent = "—";
    contactDistance.textContent = "—";
    contactPlayerPower.textContent = "100";
    contactPowerComparison.textContent = "—";
    contactMonsterSpeed.textContent = "—";
    contactFleeResult.textContent = "—";
    return;
  }

  const resolution = outcome.monsterContactResolution;
  const idleContact = contact.caravanActivity === "idle";
  contactTime.textContent = formatElapsed(contact.atSeconds);
  contactMonster.textContent = `${contact.monsterId} · PWR ${contact.monsterPower}`;
  contactPosition.textContent =
    contact.segmentIndex === null
      ? `Финиш · ${formatNumber(contact.routeDistanceKilometers, 1)} км${idleContact ? " · STOP" : ""}`
      : `Сегмент ${contact.segmentIndex + 1} · ${formatNumber(contact.routeDistanceKilometers, 1)} км${idleContact ? " · STOP" : ""}`;
  contactDistance.textContent = `${formatNumber(contact.separationMeters, 1)} м / ${formatNumber(contact.interactionRadiusMeters, 0)} м`;
  contactPlayerPower.textContent = String(resolution?.playerPower ?? 100);
  const playerPower = resolution?.playerPower ?? 100;
  const comparison = playerPower > contact.monsterPower
    ? ">"
    : playerPower < contact.monsterPower
      ? "<"
      : "=";
  contactPowerComparison.textContent = `${playerPower} ${comparison} ${contact.monsterPower}`;
  contactMonsterSpeed.textContent = `${formatNumber(contact.monsterSpeedMetersPerSecond * 3.6, 1)} км/ч`;
  contactFleeResult.textContent = !resolution
    ? "Не исполнится"
    : resolution.status === "monster-defeated"
      ? "Не требуется"
      : resolution.status === "flee-succeeded"
        ? "Успех"
        : resolution.status === "flee-failed"
          ? "Провал"
          : resolution.status === "flee-required"
            ? "Ожидает данных"
            : "Не выбран";

  if (!outcome.monsterContact || !resolution) {
    contactPanel.dataset.state = "bypassed";
    contactState.textContent = "Не исполнится";
    contactTitle.textContent = "Перехват есть в плане, но не в исполнении";
    contactDetail.textContent =
      outcome.planned.status === "failed"
        ? "Караван погибнет от истощения раньше рассчитанного контакта."
        : outcome.planned.status === "paused"
          ? outcome.interruptionCause === "route-end"
            ? "Маршрут закончится вне города раньше рассчитанного контакта."
            : "Доктрина STOP остановит караван раньше рассчитанного контакта."
          : "Сближение приходится на границу прибытия и не прерывает маршрут.";
    return;
  }

  const occurred = snapshot?.status === "contact";
  if (resolution.status === "monster-defeated") {
    contactPanel.dataset.state = occurred ? "victory" : "forecast";
    contactState.textContent = occurred ? "Победа" : "Победа рассчитана";
    contactTitle.textContent = occurred
      ? "Слабый патруль уничтожен"
      : "Караван сильнее патруля";
    contactDetail.textContent =
      occurred
        ? idleContact
          ? "Player Power выше: монстр погиб, а караван продолжает запланированную стоянку."
          : "Player Power выше: монстр погиб, а караван продолжил исходный маршрут."
        : idleContact
          ? "Патруль войдёт в радиус неподвижного каравана; победа не прервёт оставшуюся стоянку."
          : "На границе 500 м Power сравнятся автоматически; остановки маршрута не будет.";
    return;
  }

  if (resolution.status === "flee-required") {
    contactPanel.dataset.state = occurred ? "flee" : "danger";
    contactState.textContent = occurred ? "Отход" : "Опасный контакт";
    contactTitle.textContent = occurred
      ? "Караван выбрал FLEE"
      : "Патруль сильнее каравана";
    contactDetail.textContent = occurred
      ? "Маршрут поставлен на паузу: для разрешения FLEE не переданы явные скорости."
      : "На границе контакта FLEE потребует явных скоростей каравана и патруля.";
    return;
  }

  if (resolution.status === "flee-succeeded") {
    const flee = resolution.fleeResolution;
    contactPanel.dataset.state = occurred ? "victory" : "forecast";
    contactState.textContent = occurred ? "Отход успешен" : "Отход рассчитан";
    contactTitle.textContent = occurred
      ? "Караван разорвал дистанцию"
      : "Караван быстрее патруля";
    contactDetail.textContent = flee
      ? `${formatNumber(flee.caravanSpeedMetersPerSecond * 3.6, 1)} км/ч против ${formatNumber(flee.monsterSpeedMetersPerSecond * 3.6, 1)} км/ч: безопасная дистанция ${formatNumber(flee.safeSeparationMeters, 0)} м будет достигнута за ${formatDuration(flee.secondsToSafeSeparation ?? 0)}; ${idleContact ? "остаток стоянки отменяется и исходный маршрут возобновляется" : "исходный маршрут продолжается"}.`
      : "FLEE разрешён успешно; исходный маршрут продолжается.";
    return;
  }

  if (resolution.status === "flee-failed") {
    const flee = resolution.fleeResolution;
    contactPanel.dataset.state = occurred ? "defeat" : "danger";
    contactState.textContent = occurred ? "Поражение" : "Побег невозможен";
    contactTitle.textContent = occurred
      ? "Патруль настиг караван"
      : "Караван не быстрее патруля";
    contactDetail.textContent = flee
      ? `${formatNumber(flee.caravanSpeedMetersPerSecond * 3.6, 1)} км/ч против ${formatNumber(flee.monsterSpeedMetersPerSecond * 3.6, 1)} км/ч: дистанция не растёт, поэтому FLEE завершит экспедицию на границе контакта.`
      : "FLEE завершится поражением на границе контакта.";
    return;
  }

  contactPanel.dataset.state = occurred ? "defeat" : "danger";
  contactState.textContent = occurred ? "Поражение" : "Смертельный риск";
  contactTitle.textContent = occurred
    ? "Караван принял проигрышный бой"
    : "ACCEPT_FIGHT приведёт к гибели";
  contactDetail.textContent = occurred
    ? "Monster Power выше: экспедиция погибла на точной границе контакта."
    : "Выбран ACCEPT_FIGHT; если приказ не изменить, сильный монстр уничтожит караван.";
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
      ? activeOutcome?.interruptionCause === "route-end"
        ? "Маршрут закончился вне выбранного города"
        : activeOutcome?.interruptionCause === "monster-contact"
        ? "Маршрут остановлен контактом с монстром"
        : "Маршрут поставлен на паузу доктриной"
      : log.executionStatus === "failed"
        ? activeOutcome?.failureReason === "monster"
          ? "Экспедиция уничтожена сильным монстром"
          : "Экспедиция завершена гибелью каравана"
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
  if (event.kind === "known-target-observed") {
    return `Подтверждён известный ${staticKindLabel(event.objectKind).toLocaleLowerCase("ru-RU")}`;
  }
  if (event.kind === "doctrine-decision") {
    return event.doctrine === "STOP"
      ? "Доктрина: остановиться у цели"
      : "Доктрина: отметить и продолжить";
  }
  if (event.kind === "route-resumed") {
    return event.resumeReason === "monster-contact"
      ? "FLEE прервал стоянку"
      : "Маршрут возобновлён";
  }
  if (event.kind === "monster-contact") {
    if (event.powerResolutionStatus === "monster-defeated") {
      return `Победа над ${event.monsterId ?? "монстром"}`;
    }
    if (event.powerResolutionStatus === "flee-succeeded") {
      return `Успешный отход от ${event.monsterId ?? "монстра"}`;
    }
    if (event.powerResolutionStatus === "flee-failed") {
      return `Неудачный отход от ${event.monsterId ?? "монстра"}`;
    }
    if (event.powerResolutionStatus === "flee-required") {
      return `FLEE от ${event.monsterId ?? "монстра"}`;
    }
    return `Гибель от ${event.monsterId ?? "монстра"}`;
  }
  if (event.kind === "search-missed") {
    return "Поиск завершён без находки";
  }
  if (event.kind === "route-ended") {
    return "Маршрут закончился вне города";
  }
  return event.cityName
    ? `Караван прибыл в ${event.cityName}`
    : "Маршрут достиг финиша";
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
    return `${formatDepletionCause(event.cause)} · ${event.failureActivity === "idle" ? "гибель на стоянке" : "гибель в пути"} · ${formatNumber(event.distanceKilometers ?? 0, 1)} км маршрута`;
  }
  if (event.kind === "target-discovered") {
    return `Сегмент ${(event.segmentIndex ?? 0) + 1} · ${formatNumber(event.distanceKilometers ?? 0, 1)} км пути`;
  }
  if (event.kind === "known-target-observed") {
    return `Запись ${event.objectId ?? "объекта"} уже была в сессионном журнале · STOP повторно не выполняется`;
  }
  if (event.kind === "doctrine-decision") {
    return event.doctrine === "STOP"
      ? "Движение поставлено на паузу в точке обнаружения"
      : "Цель добавлена в знания экспедиции; курс не изменён";
  }
  if (event.kind === "route-resumed") {
    return event.resumeReason === "monster-contact"
      ? `Патруль вынудил начать отход после ${formatDuration(event.idleDurationSeconds ?? 0)} стоянки · исходный маршрут открыт`
      : `${event.idleDurationSeconds ? `Стоянка ${formatDuration(event.idleDurationSeconds)} завершена · ` : ""}${event.objectId ?? "Цель"} уже отмечена · повторный STOP подавлен`;
  }
  if (event.kind === "monster-contact") {
    const comparison = `PWR ${event.playerPower ?? "—"} / ${event.monsterPower ?? "—"}`;
    const activity = event.caravanActivity === "idle"
      ? "контакт на стоянке · "
      : "";
    if (event.powerResolutionStatus === "monster-defeated") {
      return `${activity}${comparison} · монстр погиб, ${event.caravanActivity === "idle" ? "ожидание продолжается" : "маршрут продолжается"}`;
    }
    if (event.powerResolutionStatus === "flee-succeeded") {
      return `${activity}${comparison} · ${formatNumber((event.fleeSpeedMetersPerSecond ?? 0) * 3.6, 1)} > ${formatNumber((event.monsterSpeedMetersPerSecond ?? 0) * 3.6, 1)} км/ч · безопасная дистанция за ${formatDuration(event.secondsToSafeSeparation ?? 0)}${event.caravanActivity === "idle" ? " · стоянка прервана" : ""}`;
    }
    if (event.powerResolutionStatus === "flee-failed") {
      return `${activity}${comparison} · ${formatNumber((event.fleeSpeedMetersPerSecond ?? 0) * 3.6, 1)} ≤ ${formatNumber((event.monsterSpeedMetersPerSecond ?? 0) * 3.6, 1)} км/ч · экспедиция погибла`;
    }
    if (event.powerResolutionStatus === "flee-required") {
      return `${activity}${comparison} · отход выбран, маршрут на паузе`;
    }
    return `${activity}${comparison} · ACCEPT_FIGHT, экспедиция погибла`;
  }
  if (event.kind === "search-missed") {
    return `Караван не вошёл в радиус 150 м от цели слуха`;
  }
  if (event.kind === "route-ended") {
    return `${formatNumber(event.distanceToCityMeters ?? 0, 0)} м до ${event.cityName ?? "города"} · успех не засчитан`;
  }
  if (event.kind === "arrival" && event.cityName) {
    const movement = event.arrivalKind === "reentry" ? "возвращение" : "прибытие";
    return `${movement} · радиус ${formatNumber(event.cityRadiusMeters ?? 0, 0)} м · ${formatNumber(event.distanceKilometers ?? 0, 1)} км пути`;
  }
  return `${formatNumber(event.distanceKilometers ?? 0, 1)} км · ETA ${formatDuration(route.totalDurationSeconds)}`;
}

/**
 * @param {ReturnType<typeof createRumorSearchSnapshot>} search
 * @param {ReturnType<typeof createDiscoveryDoctrineSnapshot> | NonNullable<ReturnType<typeof createDiscoveryResumeSnapshot>>} doctrine
 * @param {ReturnType<typeof createExpeditionOutcomeSnapshot>} outcome
 */
function renderRumorSearch(search, doctrine, outcome) {
  const knownTarget = search.targetKnowledge === "known";
  const waiting = outcome.phase === "idle-at-stop";
  const idleFailure =
    outcome.status === "failed" && outcome.failureActivity === "idle";
  const resumed =
    doctrine.status === "resumed-and-continuing" &&
    !waiting &&
    !idleFailure;
  rumorPanel.dataset.state = search.status;
  rumorPanel.dataset.knowledge = search.targetKnowledge;
  if (search.status === "found") {
    rumorState.textContent = knownTarget
      ? "Известная цель подтверждена"
      : idleFailure
        ? "Стоянка прервана"
        : waiting
          ? "Стоянка у цели"
          : resumed
            ? "Маршрут возобновлён"
            : doctrine.status === "stopped"
              ? "Караван остановлен"
              : "Цель отмечена";
  } else if (search.status === "missed") {
    rumorState.textContent = knownTarget ? "Не подтверждено" : "Не найдено";
  } else {
    rumorState.textContent = knownTarget ? "Цель уже известна" : "Идёт поиск";
  }
  rumorOrigin.textContent = `${search.originCity.name} · ${search.originCity.id}`;
  rumorSector.textContent = `СЗ · ${formatNumber(search.rumor.bearingSector.minimumBearingDeg, 1)}°–${formatNumber(search.rumor.bearingSector.maximumBearingDeg, 1)}°`;
  rumorRange.textContent = `${formatNumber(search.rumor.distanceRange.minimumMeters / 1_000, 0)}–${formatNumber(search.rumor.distanceRange.maximumMeters / 1_000, 0)} км`;
  rumorText.textContent = `«К северо-западу от ${search.originCity.name} видели старый рудник — примерно в ${formatNumber(search.rumor.distanceRange.minimumMeters / 1_000, 0)}–${formatNumber(search.rumor.distanceRange.maximumMeters / 1_000, 0)} км»`;

  if (search.status === "found" && search.discovery) {
    rumorResult.textContent = knownTarget
      ? `Известный рудник повторно подтверждён на ${formatElapsed(search.discovery.atSeconds)} · сегмент ${search.discovery.segmentIndex + 1} · ${formatNumber(search.discovery.routeDistanceKilometers, 1)} км пути.`
      : `Рудник обнаружен на ${formatElapsed(search.discovery.atSeconds)} · сегмент ${search.discovery.segmentIndex + 1} · ${formatNumber(search.discovery.routeDistanceKilometers, 1)} км пути.`;
    doctrineResult.textContent = knownTarget
      ? "Сессионный журнал распознал цель: доктрина новых открытий не выполняется, караван продолжает маршрут."
      : idleFailure
        ? `STOP выполнена, но критические запасы исчерпались во время стоянки до возобновления.`
        : waiting
          ? `STOP выполнена: стоянка ${formatDuration(outcome.idleElapsedSeconds)} / ${formatDuration(outcome.idleDurationSeconds)}, маршрутное время заморожено.`
          : resumed
        ? outcome.stopInterruptedByContact
          ? `STOP исполнена, но патруль вынудил досрочно начать FLEE; цель отмечена, исходный маршрут снова открыт.`
          : `STOP исполнена и явно снята: цель уже отмечена, исходный маршрут снова открыт.`
        : doctrine.status === "stopped"
        ? `STOP выполнена: маршрут поставлен на паузу в точке обнаружения.`
        : `MARK_AND_CONTINUE выполнена: цель отмечена, караван продолжает маршрут.`;
  } else if (search.status === "missed") {
    rumorResult.textContent = knownTarget
      ? `Маршрут завершён без повторного подтверждения: караван не вошёл в радиус ${formatNumber(search.discoveryRadiusMeters, 0)} м от известной цели.`
      : `Маршрут завершён: караван не вошёл в радиус ${formatNumber(search.discoveryRadiusMeters, 0)} м от скрытой цели.`;
    doctrineResult.textContent = knownTarget
      ? "Существующая запись сохранена; доктрина новых открытий не выполнялась."
      : "Цель не обнаружена — доктрина не сработала.";
  } else {
    rumorResult.textContent = knownTarget
      ? `Рудник уже есть в сессионном журнале. Повторное сближение подтвердит запись в радиусе ${formatNumber(search.discoveryRadiusMeters, 0)} м.`
      : `Проведите маршрут через отмеченный сектор. Обнаружение сработает в радиусе ${formatNumber(search.discoveryRadiusMeters, 0)} м.`;
    doctrineResult.textContent = knownTarget
      ? "STOP относится только к новым открытиям: известная цель не остановит караван повторно."
      : doctrine.doctrine === "STOP"
        ? "При обнаружении караван автоматически остановится у цели."
        : "При обнаружении караван отметит цель и продолжит движение.";
  }

  drawRumorMap(search);
}

/**
 * @param {import("../sim-core/dist/src/index.js").PlayerDiscoveryLedger} ledger
 * @param {ReturnType<typeof createDebugMapSnapshot>} snapshot
 */
function renderDiscoveryLedger(ledger, snapshot) {
  if (
    selectedKnowledgeMapOriginCityId !== null &&
    !ledger.entries.some(
      (entry) =>
        entry.firstObservation.originCityId ===
        selectedKnowledgeMapOriginCityId,
    )
  ) {
    selectedKnowledgeMapOriginCityId = null;
  }
  const map = createSessionKnowledgeMapSnapshot(
    ledger,
    selectedKnowledgeMapOriginCityId,
  );
  selectedKnowledgeMapOriginCityId = map.originCityId;
  syncKnowledgeMapOriginOptions(map, snapshot.cities);
  drawSessionKnowledgeMap(map, snapshot.cities);

  knowledgeCount.textContent = String(ledger.entries.length);
  knowledgeExpedition.textContent = `Экспедиция #${expeditionNumber}`;
  const preparedEntry = ledger.entries.find(
    (entry) => entry.objectId === preparedKnowledgeObjectId,
  );
  const preparedCity = preparedEntry
    ? snapshot.cities.find(
        (city) => city.id === preparedEntry.firstObservation.originCityId,
      )
    : null;
  knowledgeRouteStatus.textContent = preparedEntry
    ? `Экспедиция #${expeditionNumber} подготовлена: ${preparedCity?.name ?? preparedEntry.firstObservation.originCityId} → ${staticKindLabel(preparedEntry.objectKind)}.`
    : "Повторный маршрут ещё не подготовлен.";
  knowledgeEmpty.hidden = ledger.entries.length > 0;
  knowledgeList.hidden = ledger.entries.length === 0;
  knowledgeList.replaceChildren(
    ...ledger.entries.map((entry) => {
      const item = document.createElement("li");
      item.className = "knowledge-item";
      item.dataset.prepared = String(
        entry.objectId === preparedKnowledgeObjectId,
      );

      const heading = document.createElement("div");
      heading.className = "knowledge-item__heading";
      const title = document.createElement("strong");
      title.textContent = `${staticKindLabel(entry.objectKind)} · ${entry.objectId}`;
      const badge = document.createElement("span");
      badge.textContent = "Подтверждено лично";
      heading.append(title, badge);

      const firstCity = snapshot.cities.find(
        (city) => city.id === entry.firstObservation.originCityId,
      );
      const first = document.createElement("p");
      first.textContent = `Впервые: экспедиция #${entry.firstObservation.expeditionNumber} · ${firstCity?.name ?? entry.firstObservation.originCityId} · ${formatElapsed(entry.firstObservation.observedAtSeconds)} · сегмент ${entry.firstObservation.segmentIndex + 1} · ${formatNumber(entry.firstObservation.routeDistanceMeters / 1_000, 1)} км пути.`;
      const latest = document.createElement("p");
      latest.textContent =
        entry.observationCount === 1
          ? "Наблюдений: 1 · источник: личное наблюдение · уверенность: подтверждено."
          : `Наблюдений: ${entry.observationCount} · последнее в экспедиции #${entry.latestObservation.expeditionNumber} на ${formatElapsed(entry.latestObservation.observedAtSeconds)}.`;

      const navigation = document.createElement("p");
      navigation.className = "knowledge-item__navigation";
      navigation.textContent = `Навигация от ${firstCity?.name ?? entry.firstObservation.originCityId}: азимут ${formatNumber(entry.firstObservation.originBearingDeg, 2)}° · ${formatNumber(entry.firstObservation.originDistanceMeters / 1_000, 3)} км.`;

      const action = document.createElement("div");
      action.className = "knowledge-item__action";
      const returnButton = document.createElement("button");
      returnButton.type = "button";
      returnButton.dataset.knowledgeObjectId = entry.objectId;
      returnButton.textContent =
        entry.objectId === preparedKnowledgeObjectId
          ? "Подготовить ещё один поход"
          : "Подготовить поход к объекту";
      action.append(returnButton);

      item.append(heading, first, latest, navigation, action);
      return item;
    }),
  );
}

/**
 * @param {ReturnType<typeof createSessionKnowledgeMapSnapshot>} map
 * @param {ReturnType<typeof createDebugMapSnapshot>["cities"]} cities
 */
function syncKnowledgeMapOriginOptions(map, cities) {
  const cityNames = new Map(cities.map((city) => [city.id, city.name]));
  if (map.originCityIds.length === 0) {
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "Нет открытий";
    knowledgeMapOrigin.replaceChildren(empty);
    knowledgeMapOrigin.disabled = true;
    return;
  }

  knowledgeMapOrigin.replaceChildren(
    ...map.originCityIds.map((cityId) => {
      const option = document.createElement("option");
      option.value = cityId;
      option.textContent = cityNames.get(cityId) ?? cityId;
      return option;
    }),
  );
  knowledgeMapOrigin.disabled = map.originCityIds.length <= 1;
  knowledgeMapOrigin.value = map.originCityId ?? "";
}

/**
 * @param {ReturnType<typeof createSessionKnowledgeMapSnapshot>} map
 * @param {ReturnType<typeof createDebugMapSnapshot>["cities"]} cities
 */
function drawSessionKnowledgeMap(map, cities) {
  knowledgeMap.replaceChildren();
  const city = cities.find((candidate) => candidate.id === map.originCityId);

  if (!map.originCityId) {
    const empty = svgElement("text", {
      class: "knowledge-map-empty-label",
      x: KNOWLEDGE_MAP_WIDTH / 2,
      y: KNOWLEDGE_MAP_HEIGHT / 2,
    });
    empty.textContent = "Подтверждённых открытий пока нет";
    knowledgeMap.append(empty);
    knowledgeMapScale.textContent = "Масштаб появится после открытия";
    return;
  }

  for (const fraction of [0.25, 0.5, 0.75, 1]) {
    knowledgeMap.append(
      svgElement("circle", {
        class: "knowledge-map-grid",
        cx: map.origin.x,
        cy: map.origin.y,
        r: map.radiusPixels * fraction,
      }),
    );
  }
  knowledgeMap.append(
    svgElement("line", {
      class: "knowledge-map-axis",
      x1: map.origin.x - map.radiusPixels,
      x2: map.origin.x + map.radiusPixels,
      y1: map.origin.y,
      y2: map.origin.y,
    }),
    svgElement("line", {
      class: "knowledge-map-axis",
      x1: map.origin.x,
      x2: map.origin.x,
      y1: map.origin.y - map.radiusPixels,
      y2: map.origin.y + map.radiusPixels,
    }),
  );

  for (const entry of map.entries) {
    const rightSide = entry.x >= map.origin.x;
    knowledgeMap.append(
      svgElement("line", {
        class: "knowledge-map-bearing",
        x1: map.origin.x,
        y1: map.origin.y,
        x2: entry.x,
        y2: entry.y,
      }),
    );
    const marker = svgElement("circle", {
      class: `knowledge-map-marker knowledge-map-marker--${entry.objectKind}`,
      cx: entry.x,
      cy: entry.y,
      r: 5.5,
    });
    marker.append(
      svgTitle(
        `${staticKindLabel(entry.objectKind)} · ${formatNumber(entry.bearingDeg, 2)}° · ${formatNumber(entry.distanceMeters / 1_000, 3)} км`,
      ),
    );
    const label = svgElement("text", {
      class: "knowledge-map-label",
      x: entry.x + (rightSide ? 9 : -9),
      y: entry.y - 3,
      "text-anchor": rightSide ? "start" : "end",
    });
    label.textContent = staticKindLabel(entry.objectKind);
    const distance = svgElement("text", {
      class: "knowledge-map-distance",
      x: entry.x + (rightSide ? 9 : -9),
      y: entry.y + 9,
      "text-anchor": rightSide ? "start" : "end",
    });
    distance.textContent = `${formatNumber(entry.bearingDeg, 1)}° · ${formatNumber(entry.distanceMeters / 1_000, 2)} км`;
    knowledgeMap.append(marker, label, distance);
  }

  const origin = svgElement("circle", {
    class: "knowledge-map-origin",
    cx: map.origin.x,
    cy: map.origin.y,
    r: 6.5,
  });
  origin.append(svgTitle(city?.name ?? map.originCityId));
  const originLabel = svgElement("text", {
    class: "knowledge-map-label",
    x: map.origin.x + 10,
    y: map.origin.y - 9,
  });
  originLabel.textContent = city?.name ?? map.originCityId;
  knowledgeMap.append(origin, originLabel);

  knowledgeMapScale.textContent = `Радиус ${formatNumber(map.scaleRadiusMeters / 1_000, 2)} км · точек ${map.entries.length}`;
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
  target.append(
    svgTitle(
      search.targetKnowledge === "known"
        ? "Известная цель из сессионного журнала"
        : "Точная цель — только DEV",
    ),
  );

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
  const paused = status.outcome?.status === "paused";
  const waitingAtStop = status.outcome?.phase === "idle-at-stop";
  const idleFailure =
    outcomeFailed && status.outcome?.failureActivity === "idle";
  const monsterDefeat =
    outcomeFailed && status.outcome?.failureReason === "monster";
  const fleeFailed =
    monsterDefeat &&
    status.outcome?.monsterContactResolution?.status === "flee-failed";
  const monsterContactPause =
    paused && status.outcome?.interruptionCause === "monster-contact";
  const routeEnded =
    paused && status.outcome?.interruptionCause === "route-end";
  const monsterVictoryOccurred =
    status.outcome?.monsterContactResolution?.status === "monster-defeated" &&
    status.outcome.monsterContact !== null &&
    status.route.evaluatedAtSeconds + 1e-9 >=
      status.outcome.monsterContact.expeditionElapsedSeconds;
  const fleeSucceededOccurred =
    status.outcome?.monsterContactResolution?.status === "flee-succeeded" &&
    status.outcome.monsterContact !== null &&
    status.route.evaluatedAtSeconds + 1e-9 >=
      status.outcome.monsterContact.expeditionElapsedSeconds;
  const doctrineResumed =
    status.doctrine?.status === "resumed-and-continuing" &&
    !waitingAtStop &&
    !idleFailure;
  const stopInterruptedByContact = Boolean(
    status.outcome?.stopInterruptedByContact,
  );
  const doctrineContinues =
    status.doctrine?.status === "marked-and-continuing" ||
    status.doctrine?.status === "known-and-continuing";
  const knownTargetContinues =
    status.doctrine?.status === "known-and-continuing";
  const panelState = outcomeFailed
    ? "depleted"
    : outcomeCompleted
      ? "completed"
    : paused
      ? "stopped"
    : waitingAtStop
      ? "stopped"
    : status.forecast.canFinish
      ? "safe"
      : "risk";
  caravanPanel.dataset.state = panelState;
  caravanStateLabel.textContent =
    outcomeFailed
      ? monsterDefeat
        ? "Караван уничтожен"
        : "Экспедиция потеряна"
      : outcomeCompleted
        ? `Прибыл в ${status.outcome?.destinationCity?.name ?? "город"}`
      : paused
        ? routeEnded
          ? "Маршрут вне города"
          : monsterContactPause
          ? "Контакт с монстром"
          : "Остановлен у цели"
        : waitingAtStop
          ? "Стоянка у найденной цели"
        : doctrineResumed
          ? stopInterruptedByContact
            ? "FLEE прервал стоянку · в пути"
            : "Цель отмечена · маршрут возобновлён"
        : doctrineContinues
          ? knownTargetContinues
            ? "Известная цель подтверждена · в пути"
            : "Цель отмечена · в пути"
        : monsterVictoryOccurred
          ? "Патруль побеждён · в пути"
        : fleeSucceededOccurred
          ? "Отход успешен · в пути"
      : panelState === "risk"
        ? "Риск истощения"
        : "Готов к пути";

  caravanRouteStatus.textContent =
    outcomeFailed
      ? `${monsterDefeat ? "Разбит" : "Погиб"} · сегмент ${(status.route.segmentIndex ?? 0) + 1}/4`
      : outcomeCompleted
        ? `Прибыл · ${status.outcome?.destinationCity?.name ?? "город"}`
      : paused
      ? `${routeEnded ? "Конец маршрута" : monsterContactPause ? "Контакт" : "Стоянка"} · сегмент ${(status.route.segmentIndex ?? 0) + 1}/4`
      : waitingAtStop
        ? `Idle-стоянка · сегмент ${(status.route.segmentIndex ?? 0) + 1}/4`
      : status.route.status === "arrived"
      ? "Прибыл · маршрут завершён"
      : `В пути · сегмент ${(status.route.segmentIndex ?? 0) + 1}/4`;
  caravanDistance.textContent = `${formatNumber(status.route.traveledDistanceKilometers, 1)} / ${formatNumber(status.route.traveledDistanceKilometers + status.route.remainingDistanceKilometers, 1)} км`;
  routeProgress.value = status.route.progress;
  routeProgress.textContent = `${Math.round(status.route.progress * 100)}%`;
  routeProgressLabel.textContent = outcomeFailed
    ? `${Math.round(status.route.progress * 100)}% · ГИБЕЛЬ ${formatElapsed(status.outcome?.endedAtSeconds ?? 0)}`
    : outcomeCompleted
      ? `100% · ГОРОД ${formatElapsed(status.outcome?.endedAtSeconds ?? 0)}`
      : paused
        ? `${Math.round(status.route.progress * 100)}% · ${routeEnded ? "ВНЕ ГОРОДА" : monsterContactPause ? "КОНТАКТ" : "STOP"} ${formatElapsed(status.outcome?.endedAtSeconds ?? 0)}`
        : waitingAtStop
          ? `${Math.round(status.route.progress * 100)}% · IDLE ${formatDuration(status.route.idleElapsedSeconds)} / ${formatDuration(status.outcome?.idleDurationSeconds ?? 0)}`
        : `${Math.round(status.route.progress * 100)}% · ETA ${formatDuration(status.route.totalDurationSeconds)}`;

  renderSupply(
    foodCard,
    foodRemaining,
    foodProgress,
    foodMeta,
    status.supplies.foodRemaining,
    status.supplies.initialFoodUnits,
    status.supplies.foodFraction,
    status.supplies.activity === "idle"
      ? supplySettings.profile.idle.foodUnitsPerHour
      : supplySettings.profile.moving.foodUnitsPerHour,
  );
  renderSupply(
    waterCard,
    waterRemaining,
    waterProgress,
    waterMeta,
    status.supplies.waterRemaining,
    status.supplies.initialWaterUnits,
    status.supplies.waterFraction,
    status.supplies.activity === "idle"
      ? supplySettings.profile.idle.waterUnitsPerHour
      : supplySettings.profile.moving.waterUnitsPerHour,
  );

  if (outcomeFailed) {
    forecastTitle.textContent = monsterDefeat
      ? fleeFailed
        ? "Побег не удался"
        : "Караван уничтожен"
      : "Караван погиб";
    forecastDetail.textContent = monsterDefeat
      ? fleeFailed
        ? `Скорость отхода ${formatNumber((status.outcome?.monsterContactResolution?.fleeResolution?.caravanSpeedMetersPerSecond ?? 0) * 3.6, 1)} км/ч не выше скорости патруля ${formatNumber((status.outcome?.monsterContactResolution?.fleeResolution?.monsterSpeedMetersPerSecond ?? 0) * 3.6, 1)} км/ч.`
        : `Player PWR ${status.outcome?.monsterContactResolution?.playerPower ?? "—"} < Monster PWR ${status.outcome?.monsterContactResolution?.monsterPower ?? "—"}; ACCEPT_FIGHT завершил экспедицию.`
      : `${formatDepletionCause(status.outcome?.failureCause ?? null)} исчерпаны ${idleFailure ? "во время стоянки" : "в пути"} на ${formatElapsed(status.outcome?.endedAtSeconds ?? 0)}.`;
  } else if (outcomeCompleted) {
    forecastTitle.textContent = `Прибытие в ${status.outcome?.destinationCity?.name ?? "город"}`;
    forecastDetail.textContent = `В городе: еда ${formatNumber(status.supplies.foodRemaining, 1)} · вода ${formatNumber(status.supplies.waterRemaining, 1)}`;
  } else if (paused) {
    forecastTitle.textContent = routeEnded
      ? "Город не достигнут"
      : monsterContactPause
        ? "Выбран FLEE"
        : "Маршрут поставлен на паузу";
    forecastDetail.textContent = routeEnded
      ? `Линия маршрута закончилась вне радиуса ${formatNumber(status.outcome?.cityArrivalRadiusMeters ?? 0, 0)} м от ${status.outcome?.destinationCity?.name ?? "города"}.`
      : monsterContactPause
        ? "Сильный патруль остановил маршрут: для FLEE не переданы явные скорости."
        : "Караван ждёт у найденной цели; это не финальный исход.";
  } else if (waitingAtStop) {
    const monsterWillDefeat =
      status.outcome?.failureReason === "monster";
    const fatalSupplyBeforeResume =
      !monsterWillDefeat &&
      status.outcome?.planned.status === "failed" &&
      status.outcome.resumeAtSeconds !== null &&
      status.outcome.planned.atSeconds <=
        status.outcome.resumeAtSeconds + 1e-9;
    forecastTitle.textContent = monsterWillDefeat
      ? "Патруль опаснее каравана"
      : fatalSupplyBeforeResume
      ? "Запасов не хватит на стоянку"
      : stopInterruptedByContact
        ? "Патруль прервёт стоянку"
      : "Идёт стоянка у цели";
    forecastDetail.textContent = monsterWillDefeat
      ? `Контакт на ${formatElapsed(status.outcome?.planned.atSeconds ?? 0)} завершит экспедицию выбранной доктриной.`
      : fatalSupplyBeforeResume
      ? `${formatDepletionCause(status.outcome?.planned.failureCause ?? null)} закончатся на ${formatElapsed(status.outcome?.planned.atSeconds ?? 0)} до возобновления.`
      : stopInterruptedByContact
        ? `Успешный FLEE начнётся на ${formatElapsed(status.outcome?.resumeAtSeconds ?? 0)} и отменит остаток ожидания.`
      : `Маршрутное время заморожено; idle-расход действует до ${formatElapsed(status.outcome?.resumeAtSeconds ?? 0)}.`;
  } else if (doctrineResumed) {
    forecastTitle.textContent = stopInterruptedByContact
      ? "Стоянка прервана патрулём"
      : "Маршрут возобновлён";
    forecastDetail.textContent = stopInterruptedByContact
      ? `Успешный FLEE начался на ${formatElapsed(status.outcome?.resumeAtSeconds ?? 0)}; учтено только ${formatDuration(status.outcome?.idleDurationSeconds ?? 0)} фактической стоянки.`
      : "Найденная цель уже отмечена и не создаст повторный STOP; следующие границы рассчитываются по исходному маршруту.";
  } else if (monsterVictoryOccurred) {
    forecastTitle.textContent = "Слабый патруль уничтожен";
    forecastDetail.textContent = `Player PWR ${status.outcome?.monsterContactResolution?.playerPower ?? "—"} > Monster PWR ${status.outcome?.monsterContactResolution?.monsterPower ?? "—"}; караван продолжает маршрут.`;
  } else if (fleeSucceededOccurred) {
    forecastTitle.textContent = "Отход выполнен";
    forecastDetail.textContent = `Караван открыл безопасную дистанцию за ${formatDuration(status.outcome?.monsterContactResolution?.fleeResolution?.secondsToSafeSeparation ?? 0)} и продолжает исходный маршрут.`;
  } else if (status.forecast.canFinish) {
    forecastTitle.textContent = status.outcome?.cityArrival
      ? "Запасов хватит до города"
      : "Запасов хватит до конца маршрута";
    forecastDetail.textContent = `${status.outcome?.cityArrival ? "При входе в город" : "В конце линии"}: еда ${formatNumber(status.forecast.foodAtArrival, 1)} · вода ${formatNumber(status.forecast.waterAtArrival, 1)}`;
  } else {
    forecastTitle.textContent = "Запасов не хватит";
    forecastDetail.textContent = `${formatDepletionCause(status.forecast.depletionCause)} закончатся на ${formatElapsed(status.forecast.firstDepletionAtSeconds ?? 0)}`;
  }
}

/**
 * @param {ReturnType<typeof createExpeditionOutcomeSnapshot>} outcome
 */
function renderExpeditionOutcome(outcome) {
  const destinationName = outcome.destinationCity?.name ?? "город";
  const routeEnded = outcome.interruptionCause === "route-end";
  outcomePanel.dataset.state = outcome.status;
  outcomeTime.textContent = formatElapsed(outcome.planned.atSeconds);
  outcomePosition.textContent =
    outcome.planned.segmentIndex === null
      ? `Финиш · ${formatNumber(outcome.planned.routeDistanceKilometers, 1)} км`
      : `Сегмент ${outcome.planned.segmentIndex + 1} · ${formatNumber(outcome.planned.routeDistanceKilometers, 1)} км`;

  if (outcome.status === "in-progress") {
    if (outcome.phase === "idle-at-stop") {
      const patrolWillInterrupt = outcome.stopInterruptedByContact;
      const monsterWillDefeat = outcome.failureReason === "monster";
      const fatalSupplyBeforeResume =
        !monsterWillDefeat &&
        outcome.resumeAtSeconds !== null &&
        outcome.planned.status === "failed" &&
        outcome.planned.atSeconds <= outcome.resumeAtSeconds + 1e-9;
      outcomePanel.dataset.state = "paused";
      outcomeState.textContent = "Стоянка";
      outcomeTitle.textContent = monsterWillDefeat
        ? "Патруль атакует на стоянке"
        : fatalSupplyBeforeResume
        ? "Караван не переживёт стоянку"
        : patrolWillInterrupt
          ? "Патруль прервёт стоянку"
        : "Караван ждёт у найденной цели";
      outcomeAction.textContent = monsterWillDefeat
        ? "DEV: к контакту"
        : fatalSupplyBeforeResume
        ? "DEV: к гибели"
        : patrolWillInterrupt
          ? "DEV: к контакту"
        : "DEV: к возобновлению";
      outcomeDetail.textContent = monsterWillDefeat
        ? outcome.monsterContactResolution?.status === "flee-failed"
          ? "Патруль войдёт в радиус неподвижного каравана; выбранной скорости FLEE не хватит для разрыва дистанции."
          : "Патруль войдёт в радиус неподвижного каравана; ACCEPT_FIGHT против превосходящего Power станет терминальной границей."
        : fatalSupplyBeforeResume
        ? `SIM-006 исчерпает ${formatDepletionCause(outcome.planned.failureCause).toLocaleLowerCase("ru-RU")} до окончания ожидания; маршрут останется в точке STOP.`
        : patrolWillInterrupt
          ? `Караван остаётся неподвижен до входа патруля в радиус; успешный FLEE отменит остаток запланированных ${formatDuration(outcome.scheduledIdleDurationSeconds)}.`
        : `Прошло ${formatDuration(outcome.idleElapsedSeconds)} из ${formatDuration(outcome.idleDurationSeconds)}; SIM-005 остаётся в точке STOP, SIM-006 расходует idle-запасы.`;
      outcomeCause.textContent = monsterWillDefeat
        ? `Монстр · ${formatElapsed(outcome.planned.atSeconds)}`
        : fatalSupplyBeforeResume
        ? `Гибель · ${formatElapsed(outcome.planned.atSeconds)}`
        : patrolWillInterrupt
          ? `Контакт и FLEE · ${formatElapsed(outcome.resumeAtSeconds ?? 0)}`
        : `Возобновление · ${formatElapsed(outcome.resumeAtSeconds ?? 0)}`;
      return;
    }
    outcomeState.textContent = "В пути";
    outcomeTitle.textContent = "Экспедиция продолжается";
    outcomeAction.textContent = "DEV: к исходу";
    if (outcome.planned.status === "failed") {
      const monsterDefeat = outcome.failureReason === "monster";
      const fleeFailed =
        outcome.monsterContactResolution?.status === "flee-failed";
      outcomeDetail.textContent = monsterDefeat
        ? fleeFailed
          ? "Скорость отхода не выше скорости патруля; FLEE станет терминальной границей."
          : "Выбран ACCEPT_FIGHT против более сильного монстра; контакт станет терминальной границей."
        : "Если план не изменить, критические запасы закончатся раньше финиша.";
      outcomeCause.textContent = monsterDefeat
        ? fleeFailed
          ? "Сильный монстр · FLEE не удался"
          : "Сильный монстр · ACCEPT_FIGHT"
        : formatDepletionCause(outcome.planned.failureCause);
    } else if (outcome.planned.status === "paused") {
      const monsterContact = outcome.interruptionCause === "monster-contact";
      outcomeDetail.textContent = routeEnded
        ? `Нарисованный маршрут закончится вне радиуса ${formatNumber(outcome.cityArrivalRadiusMeters ?? 0, 0)} м от ${destinationName}; победы не будет.`
        : monsterContact
          ? "Следующая граница исполнения — FLEE от более сильного движущегося патруля."
          : "Следующая граница исполнения — автоматическая остановка у найденной цели.";
      outcomeCause.textContent = routeEnded
        ? `Город не достигнут · ${destinationName}`
        : monsterContact
          ? "Сильный монстр · FLEE"
          : "Доктрина STOP";
    } else {
      outcomeDetail.textContent =
        `Маршрут и запас провизии позволяют войти в радиус города ${destinationName}.`;
      outcomeCause.textContent = `Прибытие · ${destinationName}`;
    }
    return;
  }

  const discoveryStop =
    outcome.status === "paused" &&
    outcome.interruptionCause === "doctrine-stop";
  outcomeAction.textContent = discoveryStop
    ? `Ждать ${formatDuration(readStopIdleDurationSeconds())} и продолжить`
    : "Повторить экспедицию";
  if (outcome.status === "failed") {
    const monsterDefeat = outcome.failureReason === "monster";
    const fleeFailed =
      outcome.monsterContactResolution?.status === "flee-failed";
    outcomeState.textContent = "Поражение";
    const idleFailure = outcome.failureActivity === "idle";
    outcomeTitle.textContent = monsterDefeat
      ? fleeFailed
        ? "Патруль настиг караван"
        : "Караван уничтожен сильным патрулём"
      : idleFailure
        ? "Караван погиб на стоянке"
        : "Караван погиб в пути";
    outcomeDetail.textContent = monsterDefeat
      ? fleeFailed
        ? "FLEE не открыл дистанцию: равная или меньшая скорость завершила экспедицию на границе контакта."
        : "ACCEPT_FIGHT против превосходящего Power завершил экспедицию на границе контакта."
      : idleFailure
        ? "Idle-расход исчерпал критические запасы до возобновления; караван остался в точке STOP."
        : "Фатальное истощение остановило движение; будущие этапы и прибытие отменены.";
    outcomeCause.textContent = monsterDefeat
      ? fleeFailed
        ? `${formatNumber((outcome.monsterContactResolution?.fleeResolution?.caravanSpeedMetersPerSecond ?? 0) * 3.6, 1)} ≤ ${formatNumber((outcome.monsterContactResolution?.fleeResolution?.monsterSpeedMetersPerSecond ?? 0) * 3.6, 1)} км/ч`
        : `PWR ${outcome.monsterContactResolution?.playerPower ?? "—"} < ${outcome.monsterContactResolution?.monsterPower ?? "—"}`
      : formatDepletionCause(outcome.failureCause);
  } else if (outcome.status === "completed") {
    outcomeState.textContent = "Успех";
    outcomeTitle.textContent =
      outcome.cityArrival?.kind === "reentry"
        ? `Караван вернулся в ${destinationName}`
        : `Караван прибыл в ${destinationName}`;
    outcomeDetail.textContent =
      `Авторитетная граница пересечена на дистанции ${formatNumber(outcome.cityArrivalRadiusMeters ?? 0, 0)} м от центра города.`;
    outcomeCause.textContent = `Город · ${destinationName}`;
  } else {
    const monsterContact = outcome.interruptionCause === "monster-contact";
    outcomeState.textContent = "Пауза";
    outcomeTitle.textContent = routeEnded
      ? `Маршрут не достиг ${destinationName}`
      : monsterContact
        ? "Караван встретил патруль"
        : "Караван остановлен у цели";
    outcomeDetail.textContent = routeEnded
      ? "Караван дошёл до конца заданной линии, но не вошёл в город. Экспедиция остаётся незавершённой."
      : monsterContact
        ? "FLEE ожидает явных входных скоростей; это резервное состояние API."
        : "Доктрина STOP прервала движение, но экспедиция не считается завершённой. Явная команда продолжения отметит эту цель и снова откроет исходный маршрут.";
    outcomeCause.textContent = routeEnded
      ? "Конец маршрута вне города"
      : monsterContact
        ? "Сильный монстр · FLEE"
        : "Доктрина STOP";
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

/** @returns {number} */
function readStopIdleDurationSeconds() {
  const hours = stopIdleHours.valueAsNumber;
  if (!Number.isFinite(hours) || hours < 0) {
    throw new RangeError("Длительность стоянки должна быть неотрицательной");
  }
  return hours * 3_600;
}

/** @returns {import("../sim-core/dist/src/index.js").StaticObjectDiscoveryDoctrine} */
function readDiscoveryDoctrine() {
  return doctrineMarkAndContinue.checked ? "MARK_AND_CONTINUE" : "STOP";
}

/** @returns {import("../sim-core/dist/src/index.js").StrongMonsterContactDoctrine} */
function readStrongMonsterDoctrine() {
  return contactDoctrineFight.checked ? "ACCEPT_FIGHT" : "FLEE";
}

/**
 * @param {ReturnType<typeof createDebugMapSnapshot>} snapshot
 * @param {ReturnType<typeof createFourSegmentRouteSnapshot>} route
 * @param {ReturnType<typeof createRumorSearchSnapshot>} rumorSearch
 * @param {ReturnType<typeof createDiscoveryDoctrineSnapshot> | NonNullable<ReturnType<typeof createDiscoveryResumeSnapshot>>} doctrine
 * @param {ReturnType<typeof createExpeditionOutcomeSnapshot>} outcome
 * @param {ReturnType<typeof createMonsterContactSnapshot> | null} monsterContact
 */
function drawSnapshot(
  snapshot,
  route,
  rumorSearch,
  doctrine,
  outcome,
  monsterContact,
) {
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
    const isDestination = outcome.destinationCity?.id === city.id;
    const group = svgElement("g", {
      "data-detail-title": `${city.name} · ${city.id}`,
      "data-detail-rows": JSON.stringify([
        ["Тип", isDestination ? "Город назначения" : "Город"],
        ["Радиус прибытия", isDestination ? `${outcome.cityArrivalRadiusMeters ?? 0} м` : "—"],
        ["Широта", city.position.latitudeDeg.toFixed(6)],
        ["Долгота", city.position.longitudeDeg.toFixed(6)],
      ]),
    });
    const marker = svgElement("circle", {
      class: isDestination
        ? "city-marker city-marker--destination"
        : "city-marker",
      cx: city.point.x,
      cy: city.point.y,
      r: isDestination ? 7 : 5,
    });
    const label = svgElement("text", {
      class: "city-label",
      x: city.point.x + 8,
      y: city.point.y - 7,
    });
    label.textContent = city.name;
    group.append(
      marker,
      label,
      svgTitle(
        `${city.name} (${city.id})${isDestination ? " · назначение" : ""}`,
      ),
    );
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

  if (monsterContact?.contact) {
    const contact = monsterContact.contact;
    const contactResolution =
      outcome.monsterContact?.monsterId === contact.monsterId
        ? outcome.monsterContactResolution
        : null;
    const contactResultLabel =
      contactResolution?.status === "monster-defeated"
        ? "VICTORY"
        : contactResolution?.status === "flee-succeeded"
          ? "FLEE OK"
          : contactResolution?.status === "flee-failed"
            ? "FLEE FAIL"
        : contactResolution?.status === "flee-required"
          ? "FLEE"
          : contactResolution?.status === "expedition-defeated"
            ? "DEFEAT"
            : "CONTACT";
    const marker = svgElement("circle", {
      class: "contact-world-marker",
      cx: contact.caravanPoint.x,
      cy: contact.caravanPoint.y,
      r: 12,
      "data-detail-title": `Контакт · ${contact.monsterId}`,
      "data-detail-rows": JSON.stringify([
        ["Время", formatElapsed(contact.atSeconds)],
        ["Монстр", contact.monsterId],
        ["Player Power", String(contactResolution?.playerPower ?? 100)],
        ["Monster Power", String(contact.monsterPower)],
        ["Разрешение", contactResolution?.status ?? "Не исполнится"],
        ["Доктрина", contactResolution?.doctrine ?? "AUTO"],
        ["Скорость монстра", `${(contact.monsterSpeedMetersPerSecond * 3.6).toFixed(1)} км/ч`],
        [
          "Скорость отхода",
          contactResolution?.fleeResolution
            ? `${(contactResolution.fleeResolution.caravanSpeedMetersPerSecond * 3.6).toFixed(1)} км/ч`
            : "—",
        ],
        [
          "До безопасной дистанции",
          contactResolution?.fleeResolution?.secondsToSafeSeparation === null ||
          contactResolution?.fleeResolution === null ||
          contactResolution?.fleeResolution === undefined
            ? "—"
            : formatDuration(
                contactResolution.fleeResolution.secondsToSafeSeparation,
              ),
        ],
        ["Радиус", `${contact.interactionRadiusMeters} м`],
        ["Разделение", `${contact.separationMeters.toFixed(3)} м`],
        ["Путь", `${contact.routeDistanceKilometers.toFixed(1)} км`],
      ]),
    });
    const label = svgElement("text", {
      class: "contact-world-label",
      x: contact.caravanPoint.x + 15,
      y: contact.caravanPoint.y - 11,
    });
    label.textContent = contactResultLabel;
    marker.append(
      svgTitle(`${contactResultLabel}: контакт с ${contact.monsterId}`),
    );
    worldMap.append(marker, label);
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
    outcome.status === "failed"
      ? `Погиб · сегмент ${(route.position.segmentIndex ?? 0) + 1}`
      : outcome.status === "paused"
      ? outcome.interruptionCause === "route-end"
        ? "Конец маршрута вне города"
        : `Остановлен · сегмент ${(route.position.segmentIndex ?? 0) + 1}`
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
      [
        "Доктрина",
        doctrine.status === "resumed-and-continuing"
          ? "STOP · RESUMED"
          : doctrine.status === "known-and-continuing"
            ? `${doctrine.doctrine} · KNOWN`
          : doctrine.doctrine,
      ],
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
function syncCityOptions(cities) {
  const nextIds = cities.map((city) => city.id);
  syncCitySelect(routeStartCity, cities, nextIds);
  syncCitySelect(routeDestinationCity, cities, nextIds);
}

/**
 * @param {HTMLSelectElement} select
 * @param {ReturnType<typeof createDebugMapSnapshot>["cities"]} cities
 * @param {readonly string[]} nextIds
 */
function syncCitySelect(select, cities, nextIds) {
  const currentIds = Array.from(select.options, (option) => option.value);
  if (
    currentIds.length === nextIds.length &&
    currentIds.every((id, index) => id === nextIds[index])
  ) {
    return;
  }

  const selectedId = select.value;
  select.replaceChildren(
    ...cities.map((city) => {
      const option = document.createElement("option");
      option.value = city.id;
      option.textContent = `${city.name} · ${city.id}`;
      return option;
    }),
  );
  select.value = nextIds.includes(selectedId)
    ? selectedId
    : (nextIds[0] ?? "");
}

/**
 * @param {ReturnType<typeof createDebugMapSnapshot>["monsters"]} monsters
 */
function syncContactMonsterOptions(monsters) {
  const currentIds = Array.from(contactMonsterSelect.options, (option) => option.value);
  const nextIds = monsters.map((monster) => monster.id);
  if (
    currentIds.length === nextIds.length &&
    currentIds.every((id, index) => id === nextIds[index])
  ) {
    return;
  }

  const selectedId = contactMonsterSelect.value;
  contactMonsterSelect.replaceChildren(
    ...monsters.map((monster) => {
      const option = document.createElement("option");
      option.value = monster.id;
      option.textContent = `${monster.id} · PWR ${monster.power}`;
      return option;
    }),
  );
  contactMonsterSelect.value = nextIds.includes(selectedId)
    ? selectedId
    : (nextIds[0] ?? "");
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
