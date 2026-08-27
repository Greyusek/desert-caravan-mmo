# Checkpoint 44 — LIVING-002: asymmetric caravan detection

Version: `0.0.44`

## Goal

Allow one travelling caravan to detect another without requiring reciprocal
visibility. Detection must reuse authoritative continuous movement and must not
leak absolute server coordinates into player-facing knowledge.

## Implemented

- `CaravanDetectionSubject` binds an identity and independent vision radius to
  an existing authoritative `RouteMotion`;
- `createNpcCaravanDetectionSubject(...)` converts a seeded NPC caravan to the
  same finite motion used by SIM-008;
- `findAsymmetricCaravanDetections(...)` evaluates both observer directions
  independently using each observer's own radius;
- different vision radii can therefore produce one sighting, two sightings at
  different times, or no sighting;
- a `CaravanSighting` exposes identities, observation time, separation and each
  entity's route elapsed time, but contains no coordinate or position field.

## Automated verification

Five LIVING-002 regressions cover one-way detection, the coordinate-free public
shape, independent deterministic first-detection times, seeded NPC conversion
and invalid identities/radii. Repository verification contains 382 tests: 377
previous simulation/UI tests plus five LIVING-002 tests and the existing tooling
tests.

## Scope boundary

This checkpoint detects living travellers only. It does not yet create tracks,
approximate track age, pursuit/evasion, remains, loot or information exchange.
