# Checkpoint 22 — GAME-008: resume after discovery STOP

Version: `0.0.22`

## Goal

Let an expedition explicitly continue from the exact authoritative discovery `STOP` without discarding the original route, moving the pause coordinate or triggering the same target a second time.

## Implemented

- a pure `resumeStaticObjectDiscoveryDoctrine` simulation-core operation;
- resume validation against the exact `objectId` stored by the executed `STOP` decision;
- an explicit `resumed-and-continuing` state that reopens route time while preserving the original STOP decision;
- the resume instant, segment, route distance and caravan coordinate copied from the authoritative discovery boundary;
- a browser-session acknowledgement of the resumed target;
- a **Продолжить маршрут** action only when the active expedition boundary is a discovery STOP;
- unchanged route geometry, ETA and current coordinate at the instant resume is issued;
- deterministic movement beyond the pause on the next simulation tick;
- one discovery event, one STOP event and one later-ordered resume event at the shared exact timestamp;
- suppression of a repeated STOP for the acknowledged target on every subsequent re-evaluation;
- unchanged competition with later fatal depletion, monster contact, route end and city arrival;
- reset of the acknowledgement when the seed, route, supplies, selected patrol or discovery doctrine changes;
- visible resumed state in the rumor panel, caravan forecast, world inspector and expedition journal.

## Running locally

```bash
npm run debug-map
```

Open `http://127.0.0.1:4173`.

1. Keep discovery doctrine **STOP** selected.
2. Press **DEV: маршрут к цели** and advance the clock to discovery.
3. Confirm the caravan pauses exactly at the mine and the action changes to **Продолжить маршрут**.
4. Press **Продолжить маршрут**. The coordinate and elapsed time must not jump.
5. Start the clock or press **DEV: к исходу**. The caravan must move beyond the mine without another discovery or STOP event.
6. Confirm the original discovery, STOP and resume remain visible once each in the journal.

## Automated verification

Four simulation-core regressions cover exact-boundary resume, later route-time continuation, authoritative object identity and invalid pending/continuing states. Five debug-map regressions cover exact coordinate preservation, no duplicate discovery, completion on the original route, post-resume fatal depletion and dormant/invalid acknowledgements. Together with the unchanged suite, repository verification contains 214 tests: 209 simulation/UI tests plus 5 tooling regressions.

## Scope boundary

GAME-008 models an immediate command at the existing route-time boundary. It does not add elapsed idle time, consume idle supplies, persist discovered targets across expeditions or reloads, collect resources at the object, replan the route, award rewards or add server/database state. Those are separate lifecycle and persistence checkpoints.

## Next checkpoint

`GAME-009` — model explicit time spent at a discovery STOP and apply SIM-006 idle consumption before route resume.
