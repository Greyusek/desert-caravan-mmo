# Checkpoint 43 — LIVING-001: route-backed NPC caravans

Version: `0.0.43`

## Goal

Add the first living traveller without creating an alternative movement model.
NPC caravans must derive their position from the same resolved routes, speed
units and authoritative world-time domain as player expeditions.

## Implemented

- `NpcCaravan` stores one authoritative `RoutePlan`, departure time, city
  identities and existing vision/interaction units;
- the seeded world contains one configurable NPC caravan by default;
- generated travellers move directly between real seeded cities and remain
  deterministic for the same seed/options;
- `npcCaravanPositionAtWorldTime(...)` maps authoritative world time to the
  existing SIM-005 `positionAtTime(...)` solver;
- delayed departures produce explicit `scheduled`, `moving` and `arrived`
  states without maintaining a second mutable coordinate;
- NPC counts do not perturb the existing static-object or monster streams.

## Automated verification

Five LIVING-001 regressions cover seeded generation, direct reuse of SIM-005,
departure/arrival boundaries, configurable deterministic generation, PRNG
isolation and invalid time/count inputs. Repository verification contains 377
tests: 372 simulation/UI tests plus 5 tooling tests.

## Scope boundary

This checkpoint creates physical travellers only. Detection, tracks,
pursuit/evasion, remains, loot and information exchange remain later MVP-1
checkpoints.
