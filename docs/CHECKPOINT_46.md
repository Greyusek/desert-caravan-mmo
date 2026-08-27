# Checkpoint 46 — LIVING-004: route-backed pursuit and evasion

Version: `0.0.46`

## Goal

Add a minimal deterministic behavioral consequence to caravan detection without
creating tactical combat or a second movement system.

## Implemented

- an observer with a sighting can build a finite pursuit route from its exact
  authoritative position toward the target's observed position;
- immediate reciprocal detection lets the target build a finite evasion route
  directly away from the pursuer;
- one-way detection produces pursuit without granting the unaware target an
  evasion maneuver;
- every maneuver preserves the actor's existing speed and planet radius, starts
  at authoritative sighting world time and is a normal `RoutePlan`/`RouteMotion`;
- SIM-008 resolves a faster pursuer reaching contact and a faster evader opening
  distance without any new collision or movement rules;
- a later detection calculated on an abandoned original path cannot be reused
  after pursuit begins and must be recomputed against changed motion.

## Automated verification

Seven LIVING-004 regressions cover route/speed reuse, one-way awareness,
reciprocal evasion, stale-later-sighting rejection, deterministic catch,
deterministic escape and invalid inputs. Repository verification contains 395
tests, all passing, plus the compiled Checkpoint 46 demo.

## Scope boundary

The maneuver horizon is deliberately finite and does not preserve or invent a
long-term AI goal. No tactical rounds, damage, loot, inventory, economy or
multiplayer behavior is introduced.
