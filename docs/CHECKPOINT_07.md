# Checkpoint 07 — WORLD-004: cyclic wandering monster

Version: `0.0.7`

## Goal

Create a reproducible moving danger whose position can be evaluated at any simulation time on a physically closed patrol route, without adding encounter logic yet.

## Implemented

- public `WanderingMonster` and `WanderingMonsterPosition` APIs;
- one wandering monster by default, with validated configurable count and stable IDs;
- a separate PRNG namespace per monster, preserving every existing city and static object;
- a three-leg spherical patrol whose last leg physically returns to its start;
- cyclic position evaluation with cycle index, time inside the cycle, segment, progress, and traveled/remaining loop distance;
- provisional MVP constants: speed 1.5 m/s, visible-target radius 300 m, interaction radius 500 m, and alternating weak/strong power 90/110;
- unchanged WORLD-001 cities and WORLD-002 static objects for every seed.

The route contains an explicit closing segment. Reaching the end does not teleport the monster: the next cycle begins at the same physical coordinate. Generated routes are authoritative server-side data and are not player-facing map DTOs.

## Automated verification

Ten WORLD-004 tests cover default identity and constants, seed reproducibility and variance, configurable counts and validation, PRNG isolation, physical closure, exact cycle boundaries, segment progress, later-cycle metadata, invalid/open routes, and a `checkpoint-04` golden patrol. Repository verification contains 71 tests: 68 simulation/world tests plus 3 tooling regressions.

## Scope boundary

This checkpoint does not decide whether a caravan meets the monster. A geometric path crossing without overlapping time remains a non-encounter.

## Next checkpoint

`SIM-008` — calculate the first time two moving entities enter an encounter radius during their overlapping time interval.
