# Checkpoint 28 — GAME-014: travelled session corridors

Version: `0.0.28`

## Goal

Retain the parts of expedition routes the caravan has actually executed and
show them on the player-facing session knowledge map without storing absolute
server coordinates or revealing planned future travel.

## Implemented

- a public `PlayerTravelLedger` belongs to one deterministic world seed and
  lives only for the current browser session;
- `recordExpeditionTravelProgress` receives authoritative route progress but
  stores only the executed prefix as normalized `bearing + distance` legs;
- a partial current leg is truncated at the exact travelled distance, while
  every later planned leg is absent from player knowledge;
- repeated browser renders are idempotent and moving the DEV clock backwards
  cannot reduce already retained progress;
- extending a track must preserve every executed bearing and distance, so
  later route edits cannot rewrite personal history;
- replacing a route after movement starts creates a distinct expedition in the
  debug workflow;
- tracks from different origin cities remain on separate selectable charts;
- the player map scales from both confirmed object fixes and travelled local
  points, then draws a soft corridor, center line and exact retained endpoint;
- the current expedition is highlighted separately from earlier tracks;
- changing seed, reloading the page or clearing session knowledge removes both
  discoveries and travel tracks together.

## Running locally

```bash
npm run debug-map
```

Open `http://127.0.0.1:4173`.

1. Confirm that the personal map starts empty and shows `Путей: 0`.
2. Press **DEV: маршрут к цели** and move the time slider partway: only the
   executed route prefix must appear on the personal map.
3. Move the slider farther: the same expedition corridor must extend without a
   duplicate track.
4. Move the slider backwards: the retained corridor must not shrink.
5. Advance to `STOP`, contact, depletion or arrival: the line must end at the
   same authoritative boundary as the caravan.
6. Repeat the expedition or replace the route after movement: the previous
   corridor must remain and the new one must have the next expedition number.
7. Clear session knowledge or change seed: both markers and tracks must reset.

## Automated verification

Eight GAME-014 regressions cover zero movement, partial-leg truncation, hidden
future legs, idempotent rendering, retained maximum progress, executed-prefix
immutability, independent city origins, local north-up projection, world-seed
isolation and snapshots without latitude or longitude. Together with the
unchanged suite, repository verification contains 262 tests: 257 simulation/UI
tests plus 5 tooling regressions.

## Scope boundary

GAME-014 does not add terrain tiles, a visibility-radius mask, production fog
of war, `localStorage`, IndexedDB, a server, a database, account persistence,
physical map ownership, copying, trading or global chart synchronization. The
wide visual corridor is presentation only; its physical survey width is not
yet simulation data.

## Next checkpoint

`GAME-015` — reveal a physically scaled 300 m player-visibility corridor around
actually travelled tracks as the first session fog-of-war slice, still without
terrain tiles, server persistence or the production physical-map item.
