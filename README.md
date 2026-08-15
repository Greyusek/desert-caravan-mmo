# Desert Caravan MMO

Hardcore browser MMO prototype about travel, exploration and survival on a closed desert planet.

## Current checkpoint

**Checkpoint 05 — WORLD-002: implemented and covered by automated tests.**

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

Not implemented yet (intentionally): object discovery, monsters, UI/server/database.

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

Expected for Checkpoint 05:

```text
# tests 48
# pass 48
# fail 0
```

GitHub Actions runs installation, one TypeScript compilation, and all tests for every pull request to `main`. See `docs/DEVELOPMENT_WORKFLOW.md` for the pre-MVP process and rollback rules, and `docs/CHECKPOINT_05.md` for WORLD-002 details.

## Project structure

```text
/docs
/packages
  /sim-core
    /src
    /tests
```

`sim-core` remains deliberately independent from UI, database and networking code.

The next functional checkpoint is `WORLD-003`: discover objects when a caravan's real route enters the detection radius.
