# Checkpoint 32 — CITY-002: aggregate NPC consumption

Version: `0.0.32`

## Goal

Make finite city stocks change with authoritative world time by adding the
smallest aggregate NPC population and consumption model. Population decline,
production and trade remain later checkpoints.

## Implemented

- every city receives a deterministic population of 100–500 inhabitants;
- population uses a per-city namespaced PRNG stream and does not perturb world
  geometry, stocks or other entities;
- default provisional consumption is explicit: 1 food and 2 water units per
  person per game day;
- a pure simulation function projects current stocks at any non-negative world
  time from immutable initial stocks;
- consumed quantities never exceed the initial stock and current stocks clamp
  at zero;
- the exact first-depletion time and `food | water | both` cause are exposed;
- the DEV city panel shows population, current and initial stocks, and resource
  status at the selected world time;
- no mutation, database or browser persistence is introduced.

## Manual acceptance

```bash
npm run debug-map
```

Open `http://127.0.0.1:4173`, click a city and note its population and initial
stocks. Move the DEV time slider forward and click the city again: current food
and water must fall while initial values and population stay unchanged. Water
falls twice as fast as food per NPC. A sufficiently late time must show an
explicit depleted status rather than negative stocks.

## Automated verification

Eight CITY-002 regressions cover deterministic population, independence from
city count, exact proportional consumption, exact and simultaneous depletion,
zero-rate behavior, validation and DEV world-time projection. Repository
verification contains 278 tests: 273 simulation/UI tests plus 5 tooling tests.

## Scope boundary

CITY-002 does not reduce population during shortages, replenish stocks, model
production chains, prices, trade, caravan resupply, persistence or accounts.
