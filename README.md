# Desert Caravan MMO

Hardcore browser MMO prototype about travel, exploration and survival on a closed desert planet.

## Current checkpoint

**Checkpoint 03 — SIM-006: implemented, awaiting local verification.**

Already implemented and verified on the user's Windows machine:

- SIM-001 — world coordinate types and unit conventions;
- SIM-002 — destination point from `start + bearing + distance`;
- SIM-003 — great-circle distance;
- SIM-004 — multi-segment route and ETA;
- SIM-005 — caravan position at arbitrary simulation time `T`.

Implemented in Checkpoint 03:

- SIM-006 — food/water stocks;
- separate moving/idle consumption rates;
- exact first-depletion time;
- `food`, `water` or simultaneous depletion cause;
- quick survival check for a given duration;
- demo linking supply depletion with caravan position on the route.

Not implemented yet (intentionally): seeded world, cities, hidden objects, discovery, monsters, UI/server/database.

## Requirements

- Node.js 22+
- npm

## Local verification on Windows PowerShell

Because Windows PowerShell may block `npm.ps1`, use `npm.cmd`:

```powershell
cd D:\dev\newWorld
npm.cmd install
npm.cmd test
npm.cmd run demo
```

Expected for Checkpoint 03:

```text
# tests 32
# pass 32
# fail 0
```

See `docs/CHECKPOINT_03.md` for the expected demo output.

## Project structure

```text
/docs
/packages
  /sim-core
    /src
    /tests
```

`sim-core` remains deliberately independent from UI, database and networking code.

The next checkpoint after local verification is `WORLD-001`: deterministic seeded world generation with the first cities.
