# Checkpoint 26 — GAME-012: known-object return navigation

Version: `0.0.26`

## Goal

Make confirmed session knowledge actionable: select one known-object ledger
entry and prepare a new expedition from the city where that object was first
observed, using only the player's relative navigation data rather than an
absolute server coordinate.

## Implemented

- every confirmed direct observation now retains a normalized bearing and a
  positive distance from its observation-origin city;
- the player-facing ledger still contains no latitude, longitude or absolute
  world coordinate;
- a pure `createKnownObjectReturnNavigation` API selects one known entry and
  returns its original city plus one `bearing + distance` route command;
- the first observation remains the immutable navigation anchor even after a
  later expedition reobserves the same object;
- the debug-map adapter converts that command into the existing four-segment
  editor: one real leg followed by three zero-length legs;
- each ledger card shows the confirmed relative fix and exposes **Подготовить
  поход к объекту**;
- selecting the action advances the expedition counter, resets time to T+0,
  restores the original city as route start and fills the editor from the
  ledger rather than reading current server truth;
- prepared-route state is visible in the ledger while ordinary DEV/manual route
  replacement clears that state;
- GAME-011 known-target behavior remains intact: the return expedition can
  reobserve the mine but cannot execute a second discovery `STOP`.

## Running locally

```bash
npm run debug-map
```

Open `http://127.0.0.1:4173`.

1. Keep `STOP` selected, press **DEV: маршрут к цели** and advance to the first
   discovery.
2. Confirm that the ledger card now shows the origin city, bearing and distance
   but no latitude/longitude.
3. Press **Подготовить поход к объекту** on that card.
4. Confirm that the expedition number advances, time returns to T+0, the start
   city matches the first observation and route segment 1 receives the stored
   bearing/distance while segments 2–4 are zero.
5. Advance to the route outcome. The known mine must be reobserved, the
   observation count must increase and `STOP` must not execute again.

## Automated verification

Three `sim-core` regressions cover coordinate-free route extraction, immutable
first-observation anchoring and invalid selection. Two debug-map regressions
cover four-leg editor conversion and unknown-entry rejection. Together with the
unchanged suite, repository verification contains 250 tests: 245 simulation/UI
tests plus 5 tooling regressions.

## Scope boundary

GAME-012 does not add `localStorage`, IndexedDB, a server, a database, account
persistence, map trading, physical-map ownership, fog of war, uncertainty,
navigation from an arbitrary city or a player-facing rendered knowledge map.
The exact relative fix is learned only after direct discovery and remains bound
to its first-observation city for this checkpoint.

## Next checkpoint

`GAME-013` — render confirmed ledger entries on a player-facing north-up session
knowledge map derived only from relative fixes, still without server persistence
or production physical-map ownership.
