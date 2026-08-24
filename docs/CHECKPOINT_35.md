# Checkpoint 35 — GAME-018: emergency return from discovery STOP

Version: `0.0.35`

## Goal

Extend the existing 50% supply doctrine across one scheduled discovery
`STOP`. World time and idle consumption must keep advancing while route time
is pinned; `RETURN_TO_ORIGIN` must cancel only the unelapsed wait and leave
from the exact stop coordinate.

## Implemented

- the threshold remains 50% of the expedition's original food or water stock;
  arriving at `STOP` does not reset the baseline;
- moving consumption is projected to the stop and idle consumption determines
  the exact threshold inside the scheduled wait;
- a threshold tied with arrival at `STOP` is an idle decision at zero elapsed
  wait, while a strictly earlier moving threshold remains GAME-017;
- `RETURN_TO_ORIGIN` truncates the stop at the threshold, preserves the
  complete outbound prefix and adds one shortest great-circle leg from the
  exact stop coordinate to the origin;
- world-time return ETA includes the actual idle duration, while route time
  remains movement-only;
- `CONTINUE` exposes the same decision without changing the route or scheduled
  stop duration;
- an earlier or tied route-changing stationary contact or monster defeat keeps
  priority; a weak contact that does not alter execution does not suppress the
  later supply decision;
- the expedition outcome retains both scheduled and effective idle durations,
  and the event log records `idle` activity plus `supply-emergency` resume
  provenance;
- the debug map includes a dedicated deterministic three-click STOP-return
  preset alongside the GAME-017 moving preset.

## Manual acceptance

Run:

```bash
npm run debug-map
```

Open `http://127.0.0.1:4173`, keep **Вернуться в город старта** selected and:

1. Click **DEV: возврат из STOP**. The preset must draw an exact route to the
   rumor target at 5 km/h, select `STOP`, schedule six hours of waiting, start
   with 100 food / 100 water, use zero moving consumption and 25 units/hour
   idle consumption. The card must predict a 50% boundary two hours after the
   discovery stop and a direct return from that point.
2. Click **DEV: к порогу 50%**. The caravan must still occupy the exact
   discovery coordinate, both resources must show 50%, the remaining four
   hours of waiting must be cancelled, and the event log must place the supply
   decision before **Аварийный возврат прервал стоянку** at the same timestamp.
3. Click **DEV: к городу**. The expedition must complete on authoritative
   re-entry into the origin-city radius; the effective route must contain only
   the executed outbound prefix and direct return.

For the non-return branch, prepare the preset again and select `CONTINUE`. The
50% decision is still logged, but the full six-hour stop and original route
remain unchanged.

The compiled demo prints the GAME-018 idle threshold, effective wait, exact
return distance and world-time return ETA:

```bash
npm run demo
```

## Automated verification

Six simulation-core regressions cover the original-stock idle threshold,
truncated and preserved waits, strict moving/idle ownership, the exact STOP
tie and input validation. Three debug-map regressions cover world/route time,
the effective outcome and journal, and priority of an earlier route-changing
contact. Repository verification contains 303 tests: 298 simulation/UI tests
plus 5 tooling tests.

## Scope boundary

GAME-018 covers a threshold reached during one discovery `STOP`. It does not
yet recompute a new mixed-activity 50% boundary after a completed stop, add
automatic buying, money or cargo transfer, choose among several known cities,
persist an expedition, handle several simultaneous patrols, or implement
detected-danger `AVOID` route planning.
