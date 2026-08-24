# Checkpoint 33 — CITY-003: shortage-driven population decline

Version: `0.0.33`

## Goal

Make a real city shortage affect its aggregate NPC population while preserving
the pure authoritative world-time projection introduced in CITY-002. Recovery,
migration, production and trade remain later checkpoints.

## Implemented

- population remains unchanged before and exactly at the first food or water
  depletion boundary;
- after that boundary, the default provisional loss is 1% of the remaining
  population per game day;
- loss is deterministic and compounds continuously from authoritative world
  time, so projecting the same city at the same instant always gives the same
  result;
- current population is exposed as an integer and never falls below one in this
  MVP slice; abandonment requires a later explicit rule;
- consumption after shortage integrates the declining aggregate population, so
  any resource that remains available is consumed more slowly;
- the original exact shortage time and `food | water | both` cause remain
  available;
- DEV city details expose initial/current population, losses, shortage timing,
  current/initial stocks and the provisional daily loss rate;
- the checkpoint demo prints a projection ten game days after the first
  shortage.

## Manual acceptance

Run:

```bash
npm run demo
```

Find the `CITY-003` line. Its `population=current/initial` value must have a
smaller current value, `lost` must be positive, and one or both resource stocks
must be zero after ten shortage days.

For the DEV presentation, run `npm run debug-map`, open
`http://127.0.0.1:4173`, and click a city. The detail card must show current and
initial population, zero losses before shortage, the predicted first-shortage
time and the explicit 1% per-game-day loss rate.

## Automated verification

Six CITY-003 regressions cover the exact shortage boundary, compounded loss,
slower remaining consumption, zero attrition, invalid attrition and DEV
world-time projection. Repository verification contains 284 tests: 279
simulation/UI tests plus 5 tooling tests.

## Scope boundary

CITY-003 does not replenish stocks, restore population, migrate NPCs, abandon
or destroy cities, model production chains, prices, trade, caravan resupply,
persistence or accounts.
