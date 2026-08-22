# Checkpoint 18 — GAME-006: deterministic FLEE resolution

Version: `0.0.18`

## Goal

Resolve the strong-monster `FLEE` doctrine from explicit movement inputs without introducing escape probability, tactical rounds or a combat subsystem.

## Implemented

- public `FleeAttemptInput`, `FleeResolution` and `resolveFleeAttempt` API in `sim-core`;
- explicit caravan speed, monster speed, actual contact separation and requested safe separation as the complete input contract;
- strict speed rule: `caravanSpeed > monsterSpeed` succeeds, while equal or lower speed fails;
- exact relative-speed calculation and exact duration to open the requested safe gap;
- technical MVP safe separation of two interaction radii: 1000 m for the current 500 m contact boundary;
- composition with the GAME-005 Power resolver: weak monsters are still defeated automatically, successful FLEE continues the original route, failed FLEE terminates the expedition, and ACCEPT_FIGHT remains fatal;
- unchanged first-boundary ordering: an earlier STOP or fatal depletion suppresses contact, and fatal depletion wins an exact-time tie with FLEE;
- authoritative flee inputs and result metadata in the expedition timeline and DEV contact inspector;
- editable debug-map flee speed with a deterministic QA pair: 6 km/h succeeds against a 5.4 km/h patrol, while 5 km/h fails.

## Running locally

```bash
npm run debug-map
```

Open `http://127.0.0.1:4173`, select the `PWR 110` patrol and press **DEV: маршрут на перехват**.

1. Keep `FLEE` and speed 6 km/h. At contact the safe-gap duration is recorded and the caravan continues its original route.
2. Change speed to 5 km/h. At contact the patrol catches the caravan; movement and the executable journal stop, and arrival disappears.
3. Select `ACCEPT_FIGHT`. Its Power-based terminal defeat remains unchanged.
4. Reduce supplies enough to deplete before contact. Depletion remains the earlier authoritative boundary.

## Automated verification

Five focused flee tests cover success, lower and equal speeds, reproducibility and validation. Two Power-composition tests cover successful and failed FLEE. Three debug-map regressions cover both route outcomes and the exact-time depletion tie. Together with the unchanged suite, repository verification contains 173 tests: 168 simulation/UI tests plus 5 tooling regressions.

## Scope boundary

GAME-006 uses a transparent relative-speed abstraction. It does not replan geometry around a patrol, simulate pursuit steering, mutate the monster route, award loot, persist a defeated entity or create tactical combat. The successful caravan continues its existing route; safe-gap time is authoritative outcome metadata for this MVP layer.

The low-level Power API still exposes the GAME-005 `flee-required` state when a caller omits movement inputs. The integrated expedition and debug map always supply those inputs, so player-visible FLEE is fully resolved in GAME-006.

## Next checkpoint

`GAME-007` — make a generated city the authoritative expedition destination and complete the first return-to-city loop.
