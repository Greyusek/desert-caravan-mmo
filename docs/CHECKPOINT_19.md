# Checkpoint 19 — GAME-007: authoritative city arrival

Version: `0.0.19`

## Goal

Make a real generated city the authoritative expedition destination and complete the first verifiable loop from a city, through an expedition route, back into a city. A generic route endpoint must no longer masquerade as successful arrival.

## Implemented

- public `DEFAULT_CITY_ARRIVAL_RADIUS_METERS`, `CityArrival` and `findFirstCityArrival` API in `sim-core`;
- exact continuous spherical radius-entry calculation without route sampling;
- technical MVP city-arrival radius of 500 m, kept semantically separate from the current 500 m monster-contact boundary;
- a selected destination can be any city from the deterministic generated world;
- when the route starts inside its destination, T+0 is ignored: the caravan must leave the radius and cross it again before a `reentry` exists;
- city arrival replaces generic route completion as the terminal success boundary;
- a route that ends outside the selected city becomes a non-terminal `route-end` pause and emits no arrival event;
- fatal depletion still wins an exact-time tie with city entry, while an earlier discovery STOP or monster defeat still suppresses later arrival;
- destination identity, entry kind, radius, exact time, route distance and server position flow into the outcome and expedition log;
- start and destination selectors, destination highlighting and `DEV: маршрут в город` are available on the debug map;
- the QA preset builds either a direct city transfer or a genuine outbound-and-return route when start and destination are the same city;
- supplies forecast and progress now stop at the city boundary rather than at an unused remainder of the drawn route.

## Running locally

```bash
npm run debug-map
```

Open `http://127.0.0.1:4173`.

1. Keep the same city for start and destination, press **DEV: маршрут в город**, then press **DEV: к исходу**. The caravan must leave the city and complete only when it re-enters the 500 m radius.
2. Choose a different destination city and press **DEV: маршрут в город**. The same authoritative entry rule must complete a direct transfer.
3. Replace the QA route with an outbound line that never comes back. Its endpoint must produce a pause named **Конец маршрута вне города**, without an arrival event.
4. Reduce food or water so depletion occurs before the planned entry. Failure must freeze the expedition and remove future arrival from the executable journal.

## Automated verification

Seven focused `sim-core` tests cover external entry, origin re-entry, movement that never leaves the city, a missed city, tangent contact, antimeridian continuity and validation. Five expedition-boundary regressions cover early completion, post-arrival depletion exclusion, the exact depletion tie, route-end pause and invalid completion time. Six debug-map regressions cover both QA preset modes, named city completion, route miss, exact depletion precedence and an earlier STOP. Together with the unchanged suite, repository verification contains 191 tests: 186 simulation/UI tests plus 5 tooling regressions.

## Scope boundary

GAME-007 does not add city economy, unloading, rewards, expedition persistence, route replanning, emergency return doctrine or preparation of the next caravan. The 500 m value is a configurable technical boundary, not a claim about production city size. Successful arrival produces a terminal expedition state and journal fact only.

## Next checkpoint

`UI-005` — add deterministic play/pause simulation-clock controls at x1, x10, x100 and x1000 so the complete city-to-city expedition can be observed without manually dragging the timeline.
