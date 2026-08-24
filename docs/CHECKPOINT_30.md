# Checkpoint 30 — GAME-016: reached-city personal landmark

Version: `0.0.30`

## Goal

Make an authoritatively reached destination city part of the player's personal
session map without turning hidden server coordinates into player knowledge.

## Implemented

- a city landmark is recorded only when the expedition outcome is `completed`
  and carries an authoritative city-arrival boundary;
- the record contains the expedition, origin city, reached city, arrival time,
  relative bearing and relative distance;
- latitude and longitude are absent from the session ledger and map snapshot;
- repeated rendering of the same arrival is idempotent;
- planned, paused, depleted or otherwise unsuccessful journeys reveal no city;
- the landmark is projected only on the local chart of its expedition origin;
- independent origin-city charts remain unjoined;
- reached cities use a distinct named marker above the existing coordinate-free
  travelled corridor and session fog mask;
- persistence, physical maps and global map synchronization remain deferred.

## Manual acceptance

```bash
npm run debug-map
```

Open `http://127.0.0.1:4173`.

1. Select different start and destination cities.
2. Press **DEV: маршрут в город**.
3. Before arrival, confirm that the destination is absent from the personal map.
4. Advance time beyond the authoritative arrival.
5. Confirm that the reached city appears as a named square landmark on the
   start city's personal chart.
6. Move the DEV clock backwards: the confirmed landmark must remain.
7. Start from another city and confirm that its chart stays independent.

## Scope boundary

GAME-016 does not add absolute coordinates to player knowledge, database or
browser persistence, physical-map ownership, city-to-city global chart joins,
terrain discovery, trading, copying or server synchronization.

## Automated verification

Two GAME-016 regressions cover coordinate-free idempotent landmark storage and
projection on only the matching local chart. Together with the unchanged suite,
repository verification contains 267 tests: 262 simulation/UI tests plus 5
tooling regressions.
