# Checkpoint 27 — GAME-013: coordinate-free session knowledge map

Version: `0.0.27`

## Goal

Turn confirmed ledger records into a visible player-facing north-up map without
reading absolute server coordinates or pretending that production physical-map
ownership and persistence already exist.

## Implemented

- a pure `createSessionKnowledgeMapSnapshot` adapter consumes only the
  coordinate-free `PlayerDiscoveryLedger` from GAME-011/012;
- north is always up: bearing 0° projects above the origin, 90° right, 180°
  below and 270° left;
- every marker is calculated from the immutable first-observation
  `originBearingDeg + originDistanceMeters` fix;
- the chart radius uses a deterministic 1/2/5/10 scale large enough for the
  furthest selected personal fix;
- independent observation-origin cities remain separate local charts because
  the ledger contains no legitimate coordinates with which to join them;
- an origin-city selector switches between those charts without changing
  simulation state;
- the map shows only the selected origin, confirmed object markers, bearings,
  distances and provenance-safe labels;
- seed changes, page reload and **Очистить сессионные знания** still produce an
  empty map together with the empty ledger;
- preparing a return expedition from a ledger card also selects the matching
  local map anchor;
- the production physical item, server persistence, trading, uncertainty and
  fog of war remain outside this checkpoint.

## Running locally

```bash
npm run debug-map
```

Open `http://127.0.0.1:4173`.

1. Confirm that **Личная карта открытий** starts empty and contains no absolute
   coordinate labels.
2. Keep `STOP`, press **DEV: маршрут к цели** and advance to discovery.
3. Confirm that the mine appears northwest of the observation city and that its
   displayed bearing/distance match the ledger card.
4. Press **Подготовить поход к объекту** and confirm that the marker stays fixed
   while the expedition counter and prepared route change.
5. Reobserve the target: the observation count must increase, but its map anchor
   must remain the first personal fix.
6. Change seed or clear session knowledge; both the ledger and map must become
   empty.

## Automated verification

Four GAME-013 regressions cover cardinal north-up projection, separate
selectable city anchors, immutable first-fix placement, empty state and invalid
origin selection. They explicitly verify that the player-map snapshot contains
no latitude or longitude. Together with the unchanged suite, repository
verification contains 254 tests: 249 simulation/UI tests plus 5 tooling
regressions.

## Scope boundary

GAME-013 does not add `localStorage`, IndexedDB, a server, a database, account
persistence, map ownership/loss, copying, trading, uncertainty, route-history
retention or fog of war. It also does not infer the position of one observation
city relative to another through hidden world coordinates.

## Next checkpoint

`GAME-014` — retain executed expedition tracks on the same coordinate-free
session map and reveal only the corridors the player actually travelled, still
without server persistence or the production physical-map item.
