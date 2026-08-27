# Checkpoint 47 — CONSEQUENCE-001: permanent degrading caravan remains

Version: `0.0.47`

## Goal

Turn NPC destruction into persistent physical world history with a minimal
resource consequence, without adding tactical combat, inventory simulation or
a trading economy.

## Implemented

- `createNpcCaravanRemains(...)` projects the caravan at destruction world time
  and creates one permanent authoritative world object at that exact position;
- identical seed, caravan, time and cause reproduce identity, position and loot;
- a temporary deterministic stub provides small integer food, water and salvage
  amounts solely for validating the Living Path hypothesis;
- integrity and naturally remaining loot degrade linearly over seven game days;
- after full degradation the object remains present as `ruined` even with zero
  available loot;
- recovery records cumulative recovered units, so repeating it cannot duplicate
  resources and late recovery receives only the degraded remainder.

## Automated verification

Seven CONSEQUENCE-001 regressions cover exact destruction position,
reproducibility, timed degradation, permanent ruined state, one-time recovery,
late degraded recovery and invalid state. Repository verification contains 402
tests, all passing, plus the compiled Checkpoint 47 demo.

## Scope boundary

The loot fields are an explicit temporary value stub. No equipment, capacity,
prices, item stacks, tactical combat resolution, production chains, database or
network persistence is introduced.
