# Desert Caravan MMO

Hardcore browser MMO prototype about travel, exploration and survival on a closed desert planet.

## Current checkpoint

**Checkpoint 26 — GAME-012: implemented and covered by automated tests.**

Implemented and covered by the automated test suite:

- SIM-001 — world coordinate types and unit conventions;
- SIM-002 — destination point from `start + bearing + distance`;
- SIM-003 — great-circle distance;
- SIM-004 — multi-segment route and ETA;
- SIM-005 — caravan position at arbitrary simulation time `T`.

Also implemented:

- SIM-006 — food/water stocks;
- separate moving/idle consumption rates;
- exact first-depletion time;
- `food`, `water` or simultaneous depletion cause;
- quick survival check for a given duration;
- demo linking supply depletion with caravan position on the route.
- WORLD-001 — deterministic seeded generation of ten initial cities;
- WORLD-002 — deterministic hidden oasis, mine, ruins, and cave objects, isolated by PRNG namespace.
- WORLD-003 / SIM-007 — exact first discovery when a real spherical route enters a hidden object's radius.
- WORLD-004 — deterministic wandering monsters with physically closed cyclic patrol routes.
- SIM-008 — first encounter between finite or cyclic routes in an overlapping absolute-time window.
- UI-001 — dependency-free north-up browser debug map for the complete deterministic world.
- UI-002 — four-segment caravan route editor with a resolved spherical route, ETA and time-aware caravan marker.
- UI-003 — persistent caravan status, route progress, food/water levels and an ETA survival forecast driven by SIM-005 and SIM-006.
- UI-004 — deterministic expedition timeline for departure, route milestones, supply warnings, depletion and arrival.
- GAME-001 — deterministic coarse rumor, hidden local mine, north-up search inset, route-aware discovery/miss states and revealed-only log events.
- GAME-002 — automatic `STOP | MARK_AND_CONTINUE` reaction at the authoritative discovery moment, with real movement pause or continued travel and a recorded doctrine decision.
- GAME-003 — explicit in-progress, paused, completed and failed expedition outcomes resolved at the first authoritative STOP, fatal depletion or arrival boundary.
- GAME-004 — first continuous-time contact between the finite caravan route and cyclic monster patrol, composed into expedition pause, map state and timeline through SIM-008.
- GAME-005 — transparent Player Power 100 contact resolution: weaker monsters are defeated automatically, while stronger or equal monsters follow the explicit `FLEE | ACCEPT_FIGHT` doctrine.
- GAME-006 — deterministic FLEE resolution from explicit movement inputs: a strictly faster caravan opens a safe gap and continues, while an equal or slower caravan is defeated.
- GAME-007 — a selected generated city is the authoritative destination: the expedition completes on exact radius entry, a return to the origin requires exit and re-entry, and a route ending outside the city is not a success.
- GAME-008 — an executed discovery `STOP` can be explicitly resumed at its exact authoritative coordinate; the acknowledged object remains marked and cannot trigger the same stop again.
- GAME-009 — a discovery `STOP` has an explicit idle duration: expedition/world time and SIM-006 idle consumption advance while SIM-005 route time stays pinned, then later ETA and moving contacts continue on the shifted world timeline.
- GAME-010 — cyclic patrols can contact the stationary caravan during the discovery-STOP interval: weak patrols are defeated without ending the wait, strong-patrol defeat remains terminal, and successful FLEE cancels the remaining idle time and resumes the route at the exact contact boundary.
- GAME-011 — confirmed static-object discoveries remain in a seed-bound browser-session ledger across repeated expeditions, preserve direct-observation provenance without exposing absolute coordinates, and suppress a second discovery STOP when the same known target is observed again.
- GAME-012 — a selected ledger entry prepares a new expedition from its first-observation city using only the confirmed relative bearing and distance, without exposing absolute coordinates.
- UI-005 — deterministic play/pause simulation clock with x1, x10, x100 and x1000 development speeds, exact pause state and automatic stopping at the first authoritative expedition boundary.
- UI-006 — deterministic north-up contact inset with ±1/±5/±25 km spatial zoom and ±5 min/±30 min/±3 h time windows for caravan and cyclic-patrol traces.

Not implemented yet (intentionally): several simultaneous patrol contacts, pursuit route replanning, cross-session/server-persisted player knowledge, rewards and expedition persistence, production physical player map and fog of war, server/database, tactical combat, and autonomous neural NPC / City / Species agents.

## Requirements

- Node.js 22+
- npm

## Local verification on Windows 11

After merging a pull request, run the complete acceptance flow with one command:

```bash
cd /d/dev/newWorld
npm run accept:main
```

The command updates `main` with fast-forward only, installs exact dependencies, builds once, runs all tests and the demo, and verifies a clean working tree. On success, send only the generated summary file; keep the full log for failures. Double-click `scripts\accept-main.cmd` for the same workflow.

One-time bootstrap after the pull request that introduces this command:

```bash
git switch main
git pull --ff-only origin main
npm run accept:main
```

Starting with the next pull request, `npm run accept:main` performs the update itself.

Because Windows PowerShell may block `npm.ps1`, use `npm.cmd` there:

```powershell
cd D:\dev\newWorld
npm.cmd run accept:main
```

Expected for Checkpoint 26:

```text
# tests 250
# pass 250
# fail 0
```

This total contains 245 simulation/UI tests and 5 tooling regression tests.

GitHub Actions installs exact dependencies, compiles `sim-core`, type-checks the browser UI, and runs all tests for every pull request to `main`. See `docs/DEVELOPMENT_WORKFLOW.md` for the pre-MVP process and rollback rules, and `docs/CHECKPOINT_26.md` for GAME-012 details.

## Developer debug map

Launch the first browser view with:

```bash
npm run debug-map
```

Then open `http://127.0.0.1:4173`. The map is intentionally a developer overlay: it shows exact coordinates, hidden static objects, monster radii, patrol routes, the editable four-segment caravan route, a persistent supply forecast, a deterministic event timeline, the local rumor-search scenario, discovery and contact doctrines, expedition outcomes and authoritative Power/FLEE resolution. Select `STOP`, choose the stop duration, press `DEV: маршрут к цели`, advance to discovery and schedule the wait-and-resume action. During that interval world time and idle consumption advance while the caravan remains at the discovery coordinate. `DEV: патруль к стоянке` prepares the same flow with a guaranteed patrol contact halfway through a six-hour wait: PWR 90 leaves the wait intact, successful PWR 110 FLEE resumes early, and failed FLEE or ACCEPT_FIGHT kills the caravan at STOP. The knowledge panel records the confirmed mine with its coordinate-free bearing and distance from the first-observation city. Press **Подготовить поход к объекту** to start the next expedition at T+0 and fill the route editor from that personal record; the known target is reobserved without executing STOP again. The ledger lives only in the current tab and resets on a different seed, page reload or its explicit clear button. Select start and destination cities, then use `DEV: маршрут в город`; choosing the start city as destination creates a real exit-and-return scenario. Use Play/Pause and x1, x10, x100 or x1000 to run it without dragging the time slider. `DEV: маршрут на перехват` remains available for moving PWR/FLEE checks; the local inset can switch between ±1/±5/±25 km and ±5 min/±30 min/±3 h without changing simulation state. Stop the server with `Ctrl+C`.

## Project structure

```text
/docs
/packages
  /debug-map
  /sim-core
    /src
    /tests
```

`sim-core` remains deliberately independent from UI, database and networking code.

The next functional checkpoint is `GAME-013`: render confirmed ledger entries on a player-facing north-up session knowledge map derived only from relative fixes, still without server persistence or production physical-map ownership.
