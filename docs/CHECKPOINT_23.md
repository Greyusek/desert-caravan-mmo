# Checkpoint 23 — GAME-009: discovery STOP idle lifecycle

Version: `0.0.23`

## Goal

Turn the discovery `STOP` from an instantaneous acknowledgement into an explicit simulated stay: world time and idle supply use continue while route movement remains pinned to the authoritative discovery coordinate, then the original route resumes on a shifted timeline.

## Implemented

- a pure `evaluateDiscoveryStopLifecycle` simulation-core operation;
- separate expedition/world time and SIM-005 route time across one scheduled STOP;
- an explicit non-negative stop duration selected before the resume command;
- moving consumption before and after STOP plus SIM-006 idle consumption during it;
- exact food, water or simultaneous depletion inside the idle interval;
- fatal depletion taking precedence over resume when both occur at the same instant;
- route movement frozen at the discovery coordinate throughout the wait and after any idle death;
- city entry, route completion, route milestones and supply warnings shifted by the full stop duration;
- one future journal resume event at the real world-time boundary, removed when earlier idle depletion makes it impossible;
- deterministic patrol world time after resume while the caravan continues from its original route time;
- contact-zoom caravan traces that remain stationary during the stop while patrol traces keep moving;
- live idle phase, elapsed/total wait, active idle rates, shifted resume time and idle-death explanation in the debug map;
- a DEV jump to the resume boundary without skipping a possible earlier fatal supply boundary.

## Running locally

```bash
npm run debug-map
```

Open `http://127.0.0.1:4173`.

1. Keep discovery doctrine **STOP** selected and leave **Стоянка после STOP** at 6 hours.
2. Press **DEV: маршрут к цели**, then advance to the discovery boundary.
3. Press **Ждать 6 ч и продолжить**. Confirm world time can advance while distance and caravan coordinate remain unchanged.
4. During the wait, confirm the supply cards show the idle rates and the journal forecasts resume at `STOP + 6 h`.
5. Advance to resume and then to completion. Confirm later route events and arrival are shifted by exactly 6 hours without a second discovery.
6. For the failure branch, lower food or water so it reaches zero during the wait. Confirm the caravan dies at the STOP coordinate, resume disappears and arrival is not recorded.

Manual acceptance may be batched with the next checkpoints; CI remains the merge gate.

## Automated verification

Eight lifecycle regressions cover route/world-time mapping, partial idle use, successful resume, shifted completion, idle death, exact resume/death ties, post-resume depletion, city entry, route-end pause and validation. Two contact regressions cover pre-STOP priority and shifted post-resume patrol world time. Five debug-map regressions cover live idle presentation data, shifted journal ETA, completion, idle death, exact ties and a 25% warning inside the stop. Together with the unchanged suite, repository verification contains 229 tests: 224 simulation/UI tests plus 5 tooling regressions.

## Scope boundary

GAME-009 schedules one fixed discovery stop and preserves the original route. It does not persist that command across reloads, collect resources at the object, replan the route, cancel or extend a running stop, award rewards, or add server/database state. A patrol that enters and leaves interaction radius entirely while the caravan is stationary is deliberately not invented by the moving-contact adapter; that stationary encounter becomes the next explicit lifecycle checkpoint.

## Next checkpoint

`GAME-010` — detect and resolve cyclic-patrol contact with the stationary caravan during the discovery-STOP interval.
