# Checkpoint 14 — GAME-002: discovery doctrine

Version: `0.0.14`

## Goal

Make discovery affect the expedition for the first time: the player chooses a simple rule before departure, and the simulation automatically either stops at the found target or records it and continues the planned route.

## Implemented

- public `StaticObjectDiscoveryDoctrine` with exact choices `STOP` and `MARK_AND_CONTINUE`;
- pure `evaluateStaticObjectDiscoveryDoctrine` in `sim-core`, driven by the authoritative WORLD-003 discovery event and selected simulation time;
- no decision before the exact discovery moment and no decision for a missed search;
- `STOP` caps SIM-005 movement at the first-entry time and coordinate, preserving the untouched route plan for inspection;
- `MARK_AND_CONTINUE` records the same authoritative target without changing route time, movement, ETA or arrival;
- a two-option doctrine control in the rumor panel with live pending, stopped and marked-and-continuing states;
- stopped caravan status and progress frozen at the discovery point;
- deterministic timeline ordering: target discovery first, automatic doctrine decision second;
- future route milestones and arrival removed from the executable timeline after `STOP`, while `MARK_AND_CONTINUE` retains them.

## Running locally

```bash
npm run debug-map
```

Open `http://127.0.0.1:4173`, leave the default `STOP` doctrine selected, press `DEV: маршрут к цели`, and move the simulation-time slider through discovery. The caravan stops exactly at the target and the timeline ends with the doctrine decision. Select `MARK_AND_CONTINUE`; the same discovery is recorded, but the time range and caravan movement remain available through route arrival.

## Automated verification

Six `sim-core` tests cover pending state, exact STOP, later STOP, continued movement, absent discovery and validation. Four debug-map tests cover pre-discovery behavior, real route freezing, executable timeline truncation, continued arrival and missed-search isolation. Repository verification contains 132 tests: 127 simulation/UI tests plus 5 tooling regressions.

## Scope boundary

GAME-002 does not persist marked knowledge, resume a stopped route, consume supplies during a long post-stop stay, award resources, resolve encounters or turn depletion into death. `STOP` is an explicit paused expedition boundary in this checkpoint; the planned route remains visible for developer comparison.

## Next checkpoint

`GAME-003` — turn arrival and critical supply depletion into explicit expedition outcomes, including a completed or failed state that can anchor the first full run/restart loop.
