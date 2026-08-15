# Checkpoint 08 — SIM-008: time-aware moving encounters

Version: `0.0.8`

## Goal

Determine the first instant when two route-backed entities occupy the same encounter radius at the same simulation time. A geometric path crossing at different times must remain a non-encounter.

## Implemented

- public `RouteMotion`, `EncounterSearchWindow`, and `MovingEncounter` APIs;
- `findFirstMovingEncounter` for finite routes and physically closed cyclic routes;
- absolute start times per entity and an explicit finite caller search window;
- the existing 500 m monster interaction radius as the default, with validated custom radii including zero;
- clipping to the real active-time overlap of finite routes;
- continuous spherical separation across the antimeridian and across route-segment or patrol-cycle boundaries;
- deterministic first-entry search with public tolerances of `1e-6` second and `1e-6` metre.

The search is event-driven. It first splits the requested time span at every relevant segment and cycle boundary, then uses a mathematically bounded adaptive search inside each smooth interval. It does not advance entities on a fixed per-second tick, so a short encounter between ticks is not silently skipped.

## Automated verification

Ten SIM-008 tests cover synchronized first entry, the same crossing at different times, an overlap already inside the radius, search-window clipping, a caravan meeting a later patrol cycle, antimeridian continuity, tangent contact, argument-order symmetry, non-overlapping finite activity, and invalid inputs. Repository verification contains 81 tests: 78 simulation/world tests plus 3 tooling regressions.

## Scope boundary

This checkpoint reports geometry and time only. It does not reveal a target at the 300 m vision radius, compare Power, start combat, stop either route, or persist an encounter event. Those rules remain separate gameplay decisions.

## Next checkpoint

`UI-001` — select the smallest browser shell and render a north-up debug map over the existing deterministic `sim-core` state.
