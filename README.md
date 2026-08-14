# Desert Caravan MMO

Hardcore browser MMO prototype about travel, exploration and survival on a closed desert planet.

## Current checkpoint

**Checkpoint 04 — WORLD-001: implemented and covered by automated tests.**

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
- WORLD-001 — deterministic seeded generation of ten initial cities.

Not implemented yet (intentionally): hidden objects, discovery, monsters, UI/server/database.

## Requirements

- Node.js 22+
- npm

## Local verification on Windows PowerShell

Because Windows PowerShell may block `npm.ps1`, use `npm.cmd`:

```powershell
cd D:\dev\newWorld
npm.cmd ci
npm.cmd test
npm.cmd run demo
```

Expected for Checkpoint 04:

```text
# tests 38
# pass 38
# fail 0
```

GitHub Actions runs installation, TypeScript compilation, and tests for every pull request to `main`. See `docs/CHECKPOINT_04.md` for WORLD-001 details.

## Project structure

```text
/docs
/packages
  /sim-core
    /src
    /tests
```

`sim-core` remains deliberately independent from UI, database and networking code.

The next functional checkpoint is `WORLD-002`: deterministic hidden static world objects.
