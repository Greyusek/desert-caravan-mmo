# Checkpoint 38 — GAME-021: danger avoidance during discovery STOP

Version: `0.0.38`

## Goal

Compose the authoritative 1000 m danger warning and `AVOID | CONTINUE`
decision with one scheduled discovery `STOP`. World time must keep advancing
while route time is pinned. `CONTINUE` must preserve the complete wait;
`AVOID` must cancel only its unelapsed part, depart from the exact STOP
coordinate and remain clear of the selected patrol at the real departure
time.

## Implemented

- `findFirstExpeditionMonsterDangerDetectionDuringIdleStop(...)` searches the
  stationary interval continuously against one cyclic patrol and returns the
  exact world, expedition, route and patrol times;
- a warning strictly before STOP is not emitted again, entry exactly at STOP
  belongs to the idle phase, and entry at the exact resume instant remains a
  later moving-execution concern;
- the idle warning uses the same 1000 m technical boundary and preserves its
  exact lead to the existing 500 m contact;
- `planExpeditionMonsterDangerResponseDuringIdleStop(...)` exposes scheduled
  and effective idle duration, interruption state, blocking boundary and
  completion time;
- `CONTINUE` returns the original `RoutePlan` object, full idle duration and
  original contact unchanged;
- `AVOID` preserves the route prefix to the exact STOP coordinate, cancels
  only the remaining wait, inserts the same deterministic one-waypoint
  geometry as GAME-020 and retains the later command suffix;
- candidate validation begins at the warning's actual world time, so patrol
  motion during the elapsed wait is part of the authoritative clearance
  proof;
- contact or a caller-supplied authoritative boundary at or before the
  warning blocks doctrine execution; an unavailable detour preserves both the
  original route and complete wait;
- the debug map composes the effective STOP lifecycle into supplies, contact,
  outcome, route progress and event ordering, including a `danger-avoidance`
  route-resume reason;
- the dedicated DEV scenario advances in three deterministic steps: prepare
  the STOP, reach the exact warning/decision and reach the resulting boundary.

## Manual acceptance

Run:

```bash
npm run debug-map
```

Open `http://127.0.0.1:4173` and:

1. Keep **STOP** and **AVOID** selected, then click **DEV: опасность во время
   STOP**. The result must forecast a 1000 m decision during the six-hour
   discovery wait.
2. Click the same button when it reads **DEV: к решению в STOP**. Route time
   must remain at the discovery coordinate while world time reaches the
   warning. The journal must show danger detection, AVOID and an interrupted
   STOP/resume at the same authoritative instant.
3. Confirm that only the unelapsed wait was cancelled, the detour starts from
   the exact STOP coordinate and no selected-patrol 500 m contact remains.
4. Click **DEV: к финишу обхода**. The expedition must reach its later route
   boundary through the verified detour.
5. Select **CONTINUE**, prepare the STOP scenario again and advance twice.
   The route and complete scheduled wait must stay unchanged, followed by the
   original idle 500 m contact.

The compiled demo prints separate world/route warning times, effective versus
scheduled idle duration and `contact-after=none`:

```bash
npm run demo
```

## Automated verification

Eight simulation-core regressions cover pinned route time, full-wait
CONTINUE, truncated-wait AVOID, exact STOP geometry, real-world continuation
clearance, contact and earlier-boundary priority, suppression of a pre-STOP
warning, patrol-cycle determinism and input validation. Three debug-map
regressions cover the planned AVOID snapshot, executed lifecycle/journal and
CONTINUE contact path. Repository verification contains 336 tests: 331
simulation/UI tests plus 5 tooling tests.

## Scope boundary

GAME-021 still resolves one selected patrol and one scheduled discovery STOP.
It does not arbitrate several patrol warnings, prove a detour clear of multiple
threats, guarantee a path when all configured one-waypoint candidates fail,
model pursuit, persist doctrine state or calibrate production sensors.
GAME-022 is the separate detection-only arbitration step for several patrols.
