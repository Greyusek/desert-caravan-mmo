# Checkpoint 11 — UI-003: persistent caravan and supplies panel

Version: `0.0.11`

## Goal

Make expedition risk visible while a route is being planned and inspected: the developer should always see where the caravan is, how much food and water remain, and whether the starting stock survives through route ETA.

## Implemented

- a persistent status panel between the route editor and world map;
- live route status, active segment, traveled/total distance and total progress;
- food and water meters evaluated at the selected simulation time;
- editable starting stocks plus moving and idle consumption profiles;
- an explicit safe, at-risk or depleted state;
- first-depletion time and `food`, `water` or `both` cause;
- a route-ETA forecast with projected food and water at arrival;
- exact-depletion semantics inherited from SIM-006: a resource reaching zero at ETA is not survivable;
- responsive layouts and semantic native progress elements without a frontend framework or production dependency.

The browser snapshot delegates route position to SIM-005 and all supply math and validation to SIM-006. `sim-core` remains independent from UI code.

## Running locally

```bash
npm run debug-map
```

Open `http://127.0.0.1:4173`, create a route, move the simulation-time slider, and watch route progress and both supply meters change. Open **Настроить провизию и расход** to produce safe, risky and exact-depletion scenarios.

## Automated verification

Six UI-003 model tests cover full stocks at `T=0`, moving consumption, safe and unsafe ETA forecasts, exact depletion and its cause, post-arrival clamping, and SIM-006 validation. Repository verification contains 102 tests: 97 simulation/UI tests plus 5 tooling regressions.

## Scope boundary

UI-003 is an observation and forecast layer. It does not stop movement at depletion, apply death or encounter consequences, consume idle supplies after arrival, add pause/resume, persist an expedition, or expose a player-facing map. Those state transitions belong to later GAME checkpoints.

The short monster patrol can look like jitter when the same whole-route slider spans hundreds of caravan hours. Local map/time zoom is recorded as a deferred UX improvement; patrol physics and deterministic coordinates are unchanged here.

## Next checkpoint

`UI-004` — add a compact deterministic expedition event log so route milestones, supply thresholds and arrival are inspectable as an ordered story.
