// @ts-check

export const GLOBAL_LAYER_DEFINITIONS = Object.freeze([
  Object.freeze({ id: "cities", label: "Города" }),
  Object.freeze({ id: "objects", label: "Известные объекты" }),
  Object.freeze({ id: "routes", label: "Маршрут" }),
  Object.freeze({ id: "intelligence", label: "Слухи и угрозы" }),
  Object.freeze({ id: "events", label: "События" }),
]);

const MAP_WIDTH = 1_000;
const MAP_HEIGHT = 620;
const MAP_PADDING = 92;
const MIN_MAP_SPAN_METERS = 600;

/**
 * Builds presentation-only geometry from allow-listed relative coordinates.
 * No authoritative route, encounter or resource result is calculated here.
 * @param {import("../sim-core/dist/src/index.js").PlayerSessionView} view
 * @param {ReadonlySet<string>} [visibleLayerIds]
 */
export function createGlobalScreenState(
  view,
  visibleLayerIds = new Set(GLOBAL_LAYER_DEFINITIONS.map((layer) => layer.id)),
) {
  assertPlayerMap(view);
  const projectedPlaces = projectPlaces(view.map.places);
  const placesByRef = new Map(projectedPlaces.map((place) => [place.ref, place]));
  const route = view.map.route
    ? projectRoute(view.map.route, placesByRef)
    : null;
  const currentPlace = view.map.currentPlaceRef
    ? placesByRef.get(view.map.currentPlaceRef) ?? null
    : null;
  const caravanPoint = currentPlace ?? interpolateRoutePoint(route);
  const destinationAction = view.availableActions.find(
    (action) => action.kind === "SELECT_DESTINATION",
  );
  const startAction = view.availableActions.find(
    (action) => action.kind === "START_JOURNEY",
  );
  const destinationOptions =
    destinationAction?.kind === "SELECT_DESTINATION"
      ? destinationAction.destinationRefs.map((ref) => {
          const place = placesByRef.get(ref);
          if (!place) throw new RangeError(`destination is missing from map: ${ref}`);
          return { ref, name: place.name };
        })
      : [];
  const warnings = [];
  if (view.caravan.supplies.foodUnits === 0) warnings.push("Запас еды исчерпан.");
  if (view.caravan.supplies.waterUnits === 0) warnings.push("Запас воды исчерпан.");

  return deepFreeze({
    map: {
      width: MAP_WIDTH,
      height: MAP_HEIGHT,
      places: projectedPlaces,
      route,
      caravanPoint,
      orientation: view.map.orientation,
    },
    layers: GLOBAL_LAYER_DEFINITIONS.map((definition) => ({
      ...definition,
      visible: visibleLayerIds.has(definition.id),
      count: layerCount(definition.id, view),
    })),
    routeCommand: {
      destinationOptions,
      canSelectDestination: destinationOptions.length > 0,
      canStartJourney: startAction?.kind === "START_JOURNEY",
    },
    warnings,
  });
}

/** @param {import("../sim-core/dist/src/index.js").PlayerSessionView["map"]["places"]} places */
function projectPlaces(places) {
  const eastValues = places.map((place) => place.eastMeters);
  const northValues = places.map((place) => place.northMeters);
  const minEast = Math.min(...eastValues);
  const maxEast = Math.max(...eastValues);
  const minNorth = Math.min(...northValues);
  const maxNorth = Math.max(...northValues);
  const centerEast = (minEast + maxEast) / 2;
  const centerNorth = (minNorth + maxNorth) / 2;
  const eastSpan = Math.max(maxEast - minEast, MIN_MAP_SPAN_METERS);
  const northSpan = Math.max(maxNorth - minNorth, MIN_MAP_SPAN_METERS);
  const scale = Math.min(
    (MAP_WIDTH - MAP_PADDING * 2) / eastSpan,
    (MAP_HEIGHT - MAP_PADDING * 2) / northSpan,
  );
  return places.map((place) => ({
    ...place,
    x: roundMapCoordinate(MAP_WIDTH / 2 + (place.eastMeters - centerEast) * scale),
    y: roundMapCoordinate(MAP_HEIGHT / 2 - (place.northMeters - centerNorth) * scale),
  }));
}

/**
 * @param {NonNullable<import("../sim-core/dist/src/index.js").PlayerSessionView["map"]["route"]>} route
 * @param {Map<string, ReturnType<typeof projectPlaces>[number]>} placesByRef
 */
function projectRoute(route, placesByRef) {
  const origin = placesByRef.get(route.originRef);
  const destination = placesByRef.get(route.destinationRef);
  if (!origin || !destination) throw new RangeError("route endpoints are missing from map");
  return {
    ...route,
    origin: { x: origin.x, y: origin.y },
    destination: { x: destination.x, y: destination.y },
  };
}

/** @param {ReturnType<typeof projectRoute> | null} route */
function interpolateRoutePoint(route) {
  if (!route) return null;
  const progress = route.progressFraction;
  return {
    x: roundMapCoordinate(
      route.origin.x + (route.destination.x - route.origin.x) * progress,
    ),
    y: roundMapCoordinate(
      route.origin.y + (route.destination.y - route.origin.y) * progress,
    ),
  };
}

/** @param {string} layerId @param {import("../sim-core/dist/src/index.js").PlayerSessionView} view */
function layerCount(layerId, view) {
  if (layerId === "cities") return view.map.places.length;
  if (layerId === "routes") return view.map.route ? 1 : 0;
  if (layerId === "events") return view.journal.length;
  return 0;
}

/** @param {import("../sim-core/dist/src/index.js").PlayerSessionView} view */
function assertPlayerMap(view) {
  if (!view || typeof view !== "object" || !("map" in view)) {
    throw new TypeError("player view must contain map");
  }
  if (!view.map || !Array.isArray(view.map.places) || view.map.places.length === 0) {
    throw new TypeError("player map must contain known places");
  }
}

/** @param {number} value */
function roundMapCoordinate(value) {
  return Math.round(value * 1_000) / 1_000;
}

/** @template T @param {T} value @returns {T} */
function deepFreeze(value) {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
