# Desert Caravan MMO

Hardcore browser MMO prototype about travel, exploration and survival on a closed desert planet.

## Current checkpoint

**Checkpoint 40 — GAME-023: implemented and covered by automated tests.**

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
- GAME-013 — confirmed ledger entries render on a player-facing north-up session knowledge map derived only from first-observation bearings and distances; independent city anchors are never joined through hidden coordinates.
- GAME-014 — each expedition adds only its actually travelled bearing/distance prefix to the matching local session chart; future route legs stay hidden and prior progress cannot be erased by rewinding the DEV clock.
- GAME-015 — a physically scaled 300 m visibility radius around those travelled tracks cuts the first session fog-of-war corridor; map scale changes pixels, never the underlying survey distance.
- GAME-016 — an authoritatively reached city becomes a confirmed relative landmark on the matching origin-city chart; planned routes and unsuccessful journeys reveal nothing, and the player record contains no absolute coordinates.
- GAME-017 — when food or water reaches 50% during uninterrupted movement, `RETURN_TO_ORIGIN` preserves the travelled prefix and replaces every future leg with a direct great-circle return; `CONTINUE` records the same decision boundary without changing the route.
- GAME-018 — the same original-stock 50% boundary remains active during discovery `STOP`: idle consumption advances in world time, `RETURN_TO_ORIGIN` cancels the remaining wait and departs from the exact stop coordinate, while `CONTINUE` preserves the scheduled wait.
- GAME-019 — the first moving-patrol danger warning is authoritative at 1000 m, strictly outside the existing 500 m contact boundary; the warning records its exact lead to contact but does not replan the route yet.
- GAME-020 — that warning now executes `AVOID | CONTINUE`: CONTINUE preserves the route exactly, while AVOID inserts one deterministic waypoint after the executed prefix, rejoins the interrupted segment and is accepted only after the complete timed route proves contact-free outside 500 m.
- GAME-021 — the same warning and doctrine now compose with a scheduled discovery `STOP`: world time advances while route time stays pinned, CONTINUE preserves the full wait, and AVOID cancels only its remainder before departing from the exact stop coordinate on a real-time-validated detour.
- GAME-022 — moving and scheduled-STOP warning solvers now select one first authoritative 1000 m boundary across several patrols; equal-time candidates use stable raw monster-ID ordering independent of input order. Multi-patrol AVOID clearance remains a separate step.
- GAME-023 — moving `AVOID | CONTINUE` now executes from that selected warning: CONTINUE preserves the route and stable first contact, while AVOID accepts a deterministic detour only after the complete timed route is continuously clear of every patrol.
- CITY-001 — every seeded city has deterministic finite food and water stocks exposed in DEV details, without trading or consumption yet.
- CITY-002 — deterministic aggregate NPC populations consume those stocks from authoritative world time at explicit provisional per-person rates; exact depletion is visible in DEV details.
- CITY-003 — the first food or water shortage reduces aggregate population by a deterministic 1% per game day; declining population also slows later consumption of any remaining stock.
- UI-005 — deterministic play/pause simulation clock with x1, x10, x100 and x1000 development speeds, exact pause state and automatic stopping at the first authoritative expedition boundary.
- UI-006 — deterministic north-up contact inset with ±1/±5/±25 km spatial zoom and ±5 min/±30 min/±3 h time windows for caravan and cyclic-patrol traces.

Not implemented yet (intentionally): automatic resupply, multi-patrol avoidance during a scheduled discovery STOP, pursuit route replanning, cross-session/server-persisted player knowledge, rewards and expedition persistence, the production physical player map and full terrain fog of war, server/database, tactical combat, and autonomous neural NPC / City / Species agents.

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

Expected for Checkpoint 40:

```text
# tests 356
# pass 356
# fail 0
```

This total contains 351 simulation/UI tests and 5 tooling regression tests.

GitHub Actions installs exact dependencies, compiles `sim-core`, type-checks the browser UI, and runs all tests for every pull request to `main`. See `docs/DEVELOPMENT_WORKFLOW.md` for the pre-MVP process and rollback rules, and `docs/CHECKPOINT_40.md` for GAME-023 details.

## Developer debug map

Launch the first browser view with:

```bash
npm run debug-map
```

Then open `http://127.0.0.1:4173`. The world map is intentionally a developer overlay: it shows exact coordinates, hidden static objects, monster radii, patrol routes, the editable four-segment caravan route, supplies, timeline, doctrines, outcomes and Power/FLEE resolution. The separate player-facing map starts as unexplored darkness. Select `STOP`, press `DEV: маршрут к цели`, and advance time: only the actually travelled path cuts a transparent corridor with a physical radius of 300 m. Planned future legs are never drawn, moving the DEV slider backwards does not erase retained visibility, and earlier expedition corridors remain. The center line and confirmed knowledge markers stay visible above the fog. Independent origin cities still use separate charts. After an authoritative city arrival, the reached city appears as a confirmed relative landmark only on the expedition's origin-city chart. `DEV: возврат в пути` prepares GAME-017; two more clicks advance to the moving 50% decision and successful origin-city re-entry. `DEV: возврат из STOP` prepares GAME-018 with a six-hour discovery wait and idle-only consumption; its next two clicks advance to the two-hour 50% boundary and then the same authoritative return. For GAME-023, keep `AVOID` selected and press `DEV: маршрут на перехват`; the first warning is selected across both generated patrols, and every detour candidate is continuously checked against both before it can execute. The next two clicks advance to the exact 1000 m decision and then the end of the all-patrol-clear route. The journal contains `danger-detected` followed by `danger-doctrine-decision` and no patrol contact. Select `CONTINUE` and prepare another intercept to preserve the original route and stable first contact. For the still single-patrol STOP path, keep `STOP` and `AVOID` selected and press `DEV: опасность во время STOP`; the next two clicks advance to the exact idle warning and then the end of the detour. At the warning, world time has advanced but route time remains pinned, the journal records `danger-avoidance` resume provenance, and only the remaining part of the six-hour wait is cancelled. Repeat with `CONTINUE` to preserve the full wait and later 500 m contact. The danger panel explicitly distinguishes moving all-patrol clearance from selected-QA-patrol STOP clearance. The local contact inset still draws both concentric server-truth boundaries. Discoveries, tracks, city landmarks and session fog reset together on a different seed, page reload or the clear button. Existing arrival, idle-contact and Power/FLEE DEV presets remain available. Stop the server with `Ctrl+C`.

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

The next small checkpoint is GAME-024: compose the same multi-patrol doctrine with a scheduled discovery `STOP`, preserving exact time domains, contact priority and all-patrol clearance after departure.
