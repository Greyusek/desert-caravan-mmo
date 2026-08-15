# Checkpoint 09 — UI-001: north-up developer debug map

Version: `0.0.9`

## Goal

Make the deterministic simulation visible in a browser for the first time without coupling `sim-core` to UI code or selecting a large frontend framework before the MVP needs one.

## Implemented

- dependency-free static HTML/CSS and browser-native ES modules checked by TypeScript;
- a restricted local Node.js asset server launched with `npm run debug-map`;
- north-up equirectangular projection of the complete seeded world;
- editable world seed with deterministic regeneration;
- visible layers for ten cities, four hidden static objects, wandering monsters, and physical patrol loops;
- a patrol-time slider that evaluates the cyclic monster through the public simulation API;
- an inspector with exact server coordinates, Power, 300 m vision radius, and 500 m interaction radius;
- antimeridian path splitting so a short wrapped patrol leg is never drawn across the whole map;
- responsive desktop and narrow-screen layout.

`sim-core` does not import or depend on the map. The UI consumes only its public compiled ES-module API, so the authoritative deterministic model remains reusable by a future server.

## Running locally

```bash
npm run debug-map
```

Open `http://127.0.0.1:4173` and stop the local server with `Ctrl+C`.

## Automated verification

Eight UI model tests cover projection bounds, invalid coordinates, complete world layers, reproducibility, seed variance, patrol-cycle time, ordinary paths, and antimeridian splitting. Two tooling tests cover the server allowlist, traversal rejection, and browser-safe content types. Repository verification contains 91 tests: 86 simulation/UI tests plus 5 tooling regressions.

## Scope boundary

This is a developer truth view, not the player's map. It intentionally reveals hidden objects and exact coordinates. It does not add fog of war, discovery persistence, route editing, a caravan panel, an event log, a backend, or a database.

## Next checkpoint

`UI-002` — add a minimal four-segment caravan route editor and render its resolved spherical route on this debug map.
