// @ts-check

import {
  DEBUG_MAP_HEIGHT,
  DEBUG_MAP_WIDTH,
  createDebugMapSnapshot,
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

function render() {
  try {
    const snapshot = createDebugMapSnapshot(seedInput.value.trim(), elapsedSeconds);
    const firstMonster = snapshot.monsters[0];

    errorMessage.hidden = true;
    mapTitle.textContent = `Seed: ${snapshot.seed}`;
    cityCount.textContent = String(snapshot.cities.length);
    objectCount.textContent = String(snapshot.staticObjects.length);
    monsterCount.textContent = String(snapshot.monsters.length);
    timeOutput.textContent = formatElapsed(elapsedSeconds);

    if (firstMonster) {
      timeSlider.max = String(Math.ceil(firstMonster.periodSeconds));
      if (elapsedSeconds > firstMonster.periodSeconds) {
        elapsedSeconds = firstMonster.periodSeconds;
        timeSlider.value = String(elapsedSeconds);
      }
    } else {
      timeSlider.max = "0";
      timeSlider.value = "0";
    }

    drawSnapshot(snapshot);
  } catch (error) {
    errorMessage.textContent = error instanceof Error ? error.message : String(error);
    errorMessage.hidden = false;
  }
}

/** @param {ReturnType<typeof createDebugMapSnapshot>} snapshot */
function drawSnapshot(snapshot) {
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
