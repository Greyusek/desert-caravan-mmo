// @ts-check

import {
  DEBUG_MAP_HEIGHT,
  DEBUG_MAP_WIDTH,
  createDebugMapSnapshot,
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

let elapsedSeconds = 0;

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

    timeSlider.max = String(Math.max(1, Math.ceil(maximumElapsedSeconds)));
    timeSlider.value = String(elapsedSeconds);

    drawSnapshot(snapshot, route);
  } catch (error) {
    errorMessage.textContent = error instanceof Error ? error.message : String(error);
    errorMessage.hidden = false;
  }
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

/** @param {ReturnType<typeof createFourSegmentRouteSnapshot>} route */
function formatRouteSummary(route) {
  return `${route.totalDistanceKilometers.toLocaleString("ru-RU", { maximumFractionDigits: 1 })} км · ETA ${formatDuration(route.totalDurationSeconds)} · ${route.speedKilometersPerHour.toFixed(1)} км/ч`;
}
