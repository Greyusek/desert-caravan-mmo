# Checkpoint 51 — HISTORY-001: multi-type rumor quality

Version: `0.0.51`

## Goal

Let world history produce several useful rumor kinds with explicit information
quality and approximate age, without exposing server coordinates.

## Implemented

- one public contract supports `caravan-passage`, `caravan-loss`,
  `creature-sighting` and `fallen-library` rumors;
- probable single-source information is `unverified`, additional independent
  sources raise it through `rough` and `reliable`;
- confirmed information is `reliable`, and two confirmed sources become
  `corroborated`;
- rumor age is grouped into `fresh`, `recent`, `old` and `ancient` instead of
  exposing exact observation time;
- source IDs are normalized before deterministic identity generation, so input
  order cannot change the rumor;
- the player-facing rumor shape contains no absolute coordinate.

## Automated verification

Six HISTORY-001 regressions cover all four types, the quality ladder, age
buckets, deterministic reproduction, source-order independence and validation.
Repository verification contains 430 tests, all passing, plus the compiled
Checkpoint 51 demo.

## Scope boundary

Creature persistence, simulation LOD/catch-up, detailed creature intelligence,
legend history, full Magic/System 256 and neural agents remain later slices.
