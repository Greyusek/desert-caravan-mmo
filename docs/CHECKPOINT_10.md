# Checkpoint 10 — UI-002: four-segment caravan route editor

Version: `0.0.10`

## Goal

Let a developer build the first editable expedition route in the browser and verify that the visible path is resolved by the same authoritative spherical simulation API already covered by SIM-004 and SIM-005.

## Implemented

- a fixed four-segment form with bearing and distance for every leg;
- a selectable start anchored to the exact coordinate of any seeded city;
- editable caravan speed in km/h while `sim-core` continues to receive meters per second;
- conversion of UI kilometers to the meter-based public `createRoutePlan` API;
- total distance and ETA summary;
- a sampled great-circle route polyline that stays spherical in the equirectangular projection and splits safely at the antimeridian;
- numbered segment endpoints with exact developer inspection data;
- caravan position evaluated through `positionAtTime` on the existing simulation-time slider;
- an inspector entry for status, traveled and remaining distance, speed, time and exact coordinate;
- responsive editor layouts without a frontend framework or production dependency.

The seeded world, cities, hidden objects and monster patrols remain unchanged. `sim-core` still has no UI dependency.

## Running locally

```bash
npm run debug-map
```

Open `http://127.0.0.1:4173`, select a starting city, edit all four commands, press **Обновить маршрут**, and move the simulation-time slider.

## Automated verification

Five UI-002 model tests cover four chained spherical segments, distance and ETA conversion, reproducibility, SIM-005 time evaluation and arrival, antimeridian splitting, and invalid editor values. Repository verification contains 96 tests: 91 simulation/UI tests plus 5 tooling regressions.

## Scope boundary

This checkpoint visualizes an editable route and current caravan point only. It does not add persistent food/water state, discovery events, encounter consequences, pause/resume commands, a player-facing fog-of-war map, an event log, a backend, or a database.

## Next checkpoint

`UI-003` — add a persistent caravan status and supplies panel driven by the existing SIM-005 and SIM-006 APIs.
