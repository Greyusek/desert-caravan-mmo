# Checkpoint 12 — UI-004: deterministic expedition event log

Version: `0.0.12`

## Goal

Turn route and supply numbers into an ordered expedition story that remains reproducible for the same route, stocks and simulation time.

## Implemented

- a compact persistent timeline in the debug-map sidebar;
- departure at `T=0`;
- completion events for the first three route segments, with the fourth represented by arrival;
- a 25% early-warning event for each critical resource;
- one combined warning when food and water cross 25% simultaneously;
- the exact SIM-006 first-depletion event when it occurs before or at route ETA;
- route arrival, ordered after depletion when both happen at the same instant;
- occurred, active and future states driven by the selected simulation time;
- an explicit next-event summary and deterministic stable event identifiers.

The timeline consumes the existing UI-002 route and SIM-006 supply model. It does not mutate `sim-core`, add a database, or introduce a production dependency.

## Running locally

```bash
npm run debug-map
```

Open `http://127.0.0.1:4173`, create a route and move the simulation-time slider. Completed events light up in sequence while later events remain visible as forecasts. Routes longer than the available supplies add warning and depletion entries.

## Automated verification

Eight UI-004 tests cover reproducibility, milestone ordering, occurred/current/future state, combined and separate warnings, exact depletion at arrival, post-arrival clamping and SIM-006 input validation. Repository verification contains 110 tests: 105 simulation/UI tests plus 5 tooling regressions.

## Scope boundary

UI-004 records route and supply milestones only. A depletion entry does not yet kill the caravan or stop its mathematical route. The timeline does not add discoveries, encounters, doctrine decisions, persistence, fog of war or player-visible absolute coordinates.

## Next checkpoint

`GAME-001` — add the first deterministic rumor-driven search scenario so the player has an uncertain destination to investigate instead of only a developer-authored route.
