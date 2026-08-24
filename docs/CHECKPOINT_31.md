# Checkpoint 31 — CITY-001: finite seeded city stocks

Version: `0.0.31`

## Goal

Introduce the smallest authoritative city-resource layer required by MVP-0:
every generated city owns finite food and water stocks, while purchases,
population consumption and persistence remain outside this checkpoint.

## Implemented

- every city receives one matching `CityStocks` record;
- food and water are safe integers in the inclusive 10,000–50,000 unit range;
- generation is deterministic for the world seed;
- each city uses its own namespaced PRNG stream;
- changing city count does not perturb stocks of existing city IDs;
- city positions and all existing golden seeded outputs remain unchanged;
- the DEV world-map detail panel shows both stock values when a city is selected;
- no client-facing personal map information is expanded by these DEV values.

## Manual acceptance

```bash
npm run debug-map
```

Open `http://127.0.0.1:4173` and click several city markers on the DEV world
map. Each city detail must show finite **Еда в городе** and **Вода в городе**
values. Reloading with the same seed must reproduce them; changing the seed
must change at least part of the stock set.

## Automated verification

Three CITY-001 regressions cover range and city coverage, deterministic seed
behavior, and independence from configured city count. The existing debug-map
world-layer test also confirms that stocks reach DEV presentation. Repository
verification contains 270 tests: 265 simulation/UI tests plus 5 tooling tests.

## Scope boundary

CITY-001 does not add buying, selling, prices, caravan resupply, NPC
consumption, population loss, production chains, database persistence or
account state.
