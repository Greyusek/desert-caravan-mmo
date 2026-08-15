# Checkpoint 17 — GAME-005: Power contact resolution

Version: `0.0.17`

## Goal

Resolve the first authoritative moving-monster contact with the transparent MVP Power stub from `MVP_SPEC`: Player Power is 100, generated QA monsters have Power 90 or 110, and no tactical combat simulation is introduced.

## Implemented

- public `DEFAULT_PLAYER_POWER`, `StrongMonsterContactDoctrine`, `PowerContactResolution` and `resolveMonsterPowerContact` API in `sim-core`;
- Player Power greater than monster Power produces `monster-defeated`, keeps the expedition non-terminal and continues the original route;
- stronger or equal monsters use an explicit `FLEE | ACCEPT_FIGHT` doctrine instead of an implicit random roll;
- `FLEE` produces a non-terminal pause at the exact contact boundary, leaving escape resolution to the next checkpoint;
- `ACCEPT_FIGHT` produces a terminal expedition defeat at that same authoritative boundary;
- Power result is composed with the existing GAME-003 first-boundary rules, supplies, discovery STOP, route arrival and GAME-004 contact truth;
- weak-monster victories remain timeline events but do not suppress later route milestones or arrival;
- debug map now generates two deterministic QA patrols (`PWR 90` and `PWR 110`), provides a patrol selector and exposes contact doctrine, comparison and result states;
- event log and DEV inspector preserve Player Power, monster Power, delta, doctrine and resolution status.

## Running locally

```bash
npm run debug-map
```

Open `http://127.0.0.1:4173` and verify these three paths:

1. Select the `PWR 90` patrol and press **DEV: маршрут на перехват**. Jump to the outcome: the monster is defeated automatically and the caravan continues toward arrival.
2. Select the `PWR 110` patrol, choose **Бежать (FLEE)** and rebuild the intercept route. At contact the caravan pauses; no escape probability is invented in this checkpoint.
3. Keep the `PWR 110` patrol, choose **Принять бой (ACCEPT_FIGHT)** and repeat. Contact becomes a terminal expedition defeat.

Earlier discovery STOP or fatal depletion still prevents a later contact from executing. Fatal depletion also keeps precedence on an exact-time tie.

## Automated verification

Six `sim-core` tests cover the public Power resolver, weak/strong/equal comparisons, both strong-monster doctrines, custom player power, reproducibility and validation. Three additional debug-map regressions cover the two QA powers, a strong-monster FLEE pause and a strong-monster ACCEPT_FIGHT defeat, while existing contact-precedence coverage remains intact. Repository verification contains 164 tests: 159 simulation/UI tests plus 5 tooling regressions.

## Scope boundary

GAME-005 does not calculate escape probability, compare speeds, resume a paused `FLEE`, model tactical rounds, award loot, persist defeated monsters or expose exact Power/coordinates in a production player UI. The debug controls and second QA patrol exist only to verify deterministic server truth.

## Next checkpoint

`GAME-006` — resolve `FLEE` deterministically from explicit movement inputs such as relative speed and contact geometry, without adding tactical combat.
