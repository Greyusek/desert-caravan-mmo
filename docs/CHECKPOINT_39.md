# Checkpoint 39 — GAME-022: first danger warning across patrols

Version: `0.0.39`

## Goal

Select one first authoritative 1000 m danger warning across several cyclic
patrols without making the result depend on input order or runtime locale.
Apply the same rule during uninterrupted movement and inside one scheduled
discovery `STOP`, while keeping route replanning outside this detection-only
slice.

## Implemented

- `findFirstExpeditionMonsterDangerDetectionAmongPatrols(...)` evaluates every
  patrol through the existing continuous moving-warning solver and returns the
  earliest absolute world-time boundary;
- `findFirstExpeditionMonsterDangerDetectionDuringIdleStopAmongPatrols(...)`
  applies the same arbitration to entries raised strictly inside the scheduled
  stationary interval;
- candidates whose times differ by more than the established encounter
  tolerance are ordered by time;
- candidates inside that tolerance are treated as one authoritative instant
  and ordered by raw monster ID, without locale-sensitive comparison;
- duplicate monster IDs are rejected before evaluation, preventing caller
  array order from becoming an implicit final tie-break;
- an empty patrol set returns `null` while shared time/radius inputs are still
  validated;
- the selected record preserves the winning patrol's power, speed, route and
  patrol time, caravan activity, exact positions, separation and contact lead;
- the debug map evaluates both generated patrols and displays the winner,
  exact time, moving/STOP activity and forecast/detected state separately from
  the manually selected single-patrol doctrine.

## Manual acceptance

Run:

```bash
npm run debug-map
```

Open `http://127.0.0.1:4173` and:

1. Press **DEV: маршрут на перехват**. The GAME-022 line must name the first
   warning among both patrols and show its exact world time and moving state.
2. Advance to the warning. Its state must change from forecast to detected
   without changing the selected monster identity.
3. Select **STOP**, press **DEV: опасность во время STOP**, and confirm that
   the same line reports an idle warning when it is the first candidate.
4. Confirm that the `AVOID | CONTINUE` controls below are still labelled as a
   selected-patrol QA path; this checkpoint does not claim multi-patrol route
   clearance.

The compiled demo supplies simultaneous warnings in reverse ID order and
prints `demo-patrol-a` as the stable winner:

```bash
npm run demo
```

## Automated verification

Seven simulation-core regressions cover earliest-time selection, raw-ID ties,
input permutation, ignored clear patrols, delayed departure, scheduled STOP,
empty sets, duplicate IDs and shared scalar validation. Three debug-map
regressions cover stable presentation selection, the exact forecast/detected
transition and idle-STOP arbitration. Repository verification contains 346
tests: 341 simulation/UI tests plus 5 tooling tests.

## Scope boundary

GAME-022 selects a warning only. The existing danger doctrine still plans and
validates an AVOID route against one manually selected patrol. It does not yet
arbitrate contacts across patrols, prove a detour clear of all patrols, model
pursuit or alter first-boundary execution. GAME-023 is the separate moving
multi-patrol AVOID-clearance step; STOP composition remains later.
