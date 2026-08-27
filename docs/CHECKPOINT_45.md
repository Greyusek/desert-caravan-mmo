# Checkpoint 45 — LIVING-003: deterministic caravan tracks

Version: `0.0.45`

## Goal

Make actual NPC travel leave reproducible physical evidence. The server may
retain exact track positions and passage times, while a player inspecting a
track receives only bounded coordinate-free information and approximate age.

## Implemented

- `deriveNpcCaravanTrackMarks(...)` projects the authoritative distance already
  travelled and creates one stable physical mark per 500 m interval;
- scheduled caravans and zero movement leave no marks, while later world time
  only appends to the existing deterministic prefix;
- each server-side mark retains its exact position, source caravan, route
  distance, direction and passage time as authoritative world state;
- `observeCaravanTrack(...)` strips that server truth into an opaque track ID,
  observation time, eight-way direction and coarse age;
- age is grouped into `fresh` (under one hour), `recent` (under six hours),
  `old` (under one day) and `weathered` (one day or more);
- the player-facing clue contains no absolute coordinate, exact passage time or
  source-caravan identity.

## Automated verification

Six LIVING-003 regressions cover executed-prefix generation, no pre-departure
tracks, stable extension, coordinate-free observation shape, exact age/direction
buckets and invalid inputs. Repository verification contains 388 tests, all
passing, and the compiled demo reproduces a coordinate-free track clue.

## Scope boundary

Tracks are world evidence only. This checkpoint does not yet store them in
player knowledge/event journal, drive pursuit/evasion, decay remains, add loot
or exchange information with city libraries.
