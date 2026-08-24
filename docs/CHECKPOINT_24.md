# Checkpoint 24 — GAME-010: patrol contact during discovery STOP

Version: `0.0.24`

## Goal

Close the execution gap left by GAME-009: a cyclic patrol must be able to enter and leave the interaction radius while the caravan is stationary at a discovery `STOP`, and that contact must use the same authoritative Power/FLEE and first-boundary rules as a moving encounter.

## Implemented

- a third SIM-008 route-motion mode, `stationary`, which keeps one coordinate fixed while absolute simulation time advances;
- continuous first-entry search between the fixed STOP coordinate and a cyclic patrol without fixed-tick sampling;
- complete contact search before STOP, inside the idle interval and after resume;
- explicit `moving | idle` caravan activity in authoritative contact metadata;
- a contact exactly at planned resume belongs to the moving phase instead of being duplicated as an idle contact;
- fatal food/water depletion remains authoritative when it occurs before or exactly with a stationary contact;
- Player Power 100 automatically defeats a PWR 90 patrol and the scheduled wait continues;
- PWR 110 plus failed `FLEE` or `ACCEPT_FIGHT` terminates the expedition at the STOP coordinate;
- successful `FLEE` interrupts the remaining wait and resumes the original route at the exact contact world time;
- supplies, route/world-time mapping, later ETA and journal events use only the actual idle duration after a contact-forced resume;
- contact and forced-resume events remain separately ordered in the expedition journal;
- a deterministic **DEV: патруль к стоянке** preset builds a closed QA patrol whose first radius entry occurs halfway through the six-hour STOP, without seed hunting.

## Running locally

```bash
npm run debug-map
```

Open `http://127.0.0.1:4173`.

1. Select the PWR 110 patrol, keep `FLEE` and speed 6 km/h.
2. Press **DEV: патруль к стоянке**. The preset selects `STOP`, a six-hour wait and the direct discovery route.
3. Press **DEV: к исходу** to reach discovery, then **Ждать 6 ч и продолжить**.
4. Confirm the contact forecast lies inside the idle interval and the caravan coordinate remains fixed before it.
5. Press **DEV: к контакту**. Successful FLEE must cancel the remaining wait, record contact before forced resume and continue the original route.
6. Repeat with PWR 90. The patrol dies, but the caravan remains stationary until the full six hours expire.
7. Repeat with PWR 110 and speed 5 km/h or `ACCEPT_FIGHT`. The expedition must fail at the STOP coordinate.

## Automated verification

One SIM-008 regression covers continuous cyclic entry into a stationary radius. Two expedition-contact regressions cover a transient idle-only contact and the exact resume boundary. Six debug-map regressions cover the deterministic QA patrol, weak-monster continuation, successful contact-forced resume, failed FLEE, `ACCEPT_FIGHT`, and an exact idle-depletion/contact tie. Together with the unchanged suite, repository verification contains 238 tests: 233 simulation/UI tests plus 5 tooling regressions.

## Scope boundary

GAME-010 resolves the first selected patrol contact around one scheduled discovery STOP. It does not persist a defeated monster, create loot, replan a tactical escape path, handle several simultaneous patrols, award discovery resources, save expedition state or add server/database storage. The QA patrol replacement exists only in the developer map; production world generation remains unchanged.

## Next checkpoint

`GAME-011` — retain discovered-object knowledge in an in-session player expedition ledger so a repeated journey no longer forgets every previous finding, without adding database persistence yet.
