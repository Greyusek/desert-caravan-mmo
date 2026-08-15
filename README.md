# Desert Caravan MMO

Hardcore browser MMO prototype about travel, exploration and survival on a closed desert planet.

## Current checkpoint

**Checkpoint 09 — UI-001: implemented and covered by automated tests.**

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

Not implemented yet (intentionally): player discovery state, route editor, player-facing map, server/database, and encounter consequences.

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

Expected for Checkpoint 09:

```text
# tests 91
# pass 91
# fail 0
```

This total contains 86 simulation/UI tests and 5 tooling regression tests.

GitHub Actions installs exact dependencies, compiles `sim-core`, type-checks the browser UI, and runs all tests for every pull request to `main`. See `docs/DEVELOPMENT_WORKFLOW.md` for the pre-MVP process and rollback rules, and `docs/CHECKPOINT_09.md` for UI-001 details.

## Developer debug map

Launch the first browser view with:

```bash
npm run debug-map
```

Then open `http://127.0.0.1:4173`. The map is intentionally a developer overlay: it shows exact coordinates, hidden static objects, monster radii and patrol routes. Stop the server with `Ctrl+C`.

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

The next functional checkpoint is `UI-002`: add a four-segment caravan route editor and display its resolved route on the debug map.
