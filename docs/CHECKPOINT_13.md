# Checkpoint 13 — GAME-001: deterministic rumor search

Version: `0.0.13`

## Goal

Turn the existing route, hidden-object discovery and expedition timeline into the first uncertain player objective: investigate a coarse rumor and either find the target or finish the route without discovering it.

## Implemented

- one deterministic rumor per selected origin city and world seed;
- a player-facing clue containing only target kind, northwest sector, 30–50 km range and rough information quality;
- a separately namespaced PRNG stream for the exact hidden mine, so existing city, static-object and monster golden values stay unchanged;
- a coordinate-free local north-up search inset with range rings, clue sector, planned route and live caravan position;
- authoritative discovery through the existing WORLD-003 first-entry calculation and the concealed-object radius of 150 m;
- explicit `searching`, `found` and `missed` states driven by selected simulation time;
- discovery or miss events added to the expedition timeline only after the outcome has occurred;
- DEV-only exact target markers and a direct-route button for deterministic QA.

The regular clue object contains no target coordinate. Exact bearing, distance and position remain inside `serverTruth`, which the debug overlay intentionally exposes for verification.

## Running locally

```bash
npm run debug-map
```

Open `http://127.0.0.1:4173`. The default route explores the rumored northwest sector. Use `DEV: маршрут к цели` to replace it with a one-leg exact QA route, then move the simulation-time slider to the discovery moment. Change the route away from the sector and move time to arrival to verify the miss state.

## Automated verification

Seven `sim-core` tests cover clue privacy, reproducibility, advertised bounds, seed/origin isolation and validation. Five debug-map tests cover local projection, absence of future outcome spoilers, exact 150 m discovery, route-completion miss and timeline ordering. Repository verification contains 122 tests: 117 simulation/UI tests plus 5 tooling regressions.

## Scope boundary

GAME-001 does not persist discovered knowledge, stop the caravan, apply doctrine, create rewards, add a production player map or fog of war, or move authority into the browser. The local search map is an MVP interaction slice inside the developer screen.

## Next checkpoint

`GAME-002` — add the first deterministic doctrine choice for a discovered target: `STOP` or `MARK_AND_CONTINUE`, and record the automatic decision in the expedition timeline.
