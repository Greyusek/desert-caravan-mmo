# Checkpoint 04 — WORLD-001: seeded world and cities

Version: `0.0.4`

## Goal

Create the first deterministic world layer without coupling simulation core to a database, server, or UI. The same seed and options must reproduce the same ordered set of cities.

## Implemented

- `generateSeededWorld(seed, options)`;
- ten cities by default, with stable IDs and names;
- valid server-side spherical coordinates away from the polar edge cases;
- optional city count for small focused simulations;
- a dependency-free, explicitly implemented seeded pseudo-random sequence;
- demo output that can be compared between runs.

City coordinates remain server data. This checkpoint does not expose them through a player-facing map.

## Automated verification

Six WORLD-001 tests verify:

- the default count of ten cities;
- byte-for-byte reproducibility with the same seed;
- different positions for different seeds;
- stable identities and valid coordinate ranges;
- configurable city count;
- rejection of empty seeds and invalid counts.

GitHub Actions runs `npm ci`, `npm run build`, and `npm test` on every pull request to `main` and every push to `main`.

## Next checkpoint

`WORLD-002` — deterministic hidden static objects: oasis, mine, ruins, and cave.
