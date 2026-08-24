# Checkpoint 34 — GAME-017: emergency supply return

Version: `0.0.34`

## Goal

Give the caravan its first automatic survival action: during uninterrupted
movement, food or water reaching an explicit emergency boundary invokes either
`RETURN_TO_ORIGIN` or `CONTINUE`. The decision must preserve all travel already
performed and remain deterministic from route, supplies and doctrine alone.

## Implemented

- the provisional emergency boundary is 50% of either initial stock; the
  existing 25% warning remains a later, separate journal signal;
- the first resource to reach 50% determines `food | water | both` and the
  exact decision time;
- `RETURN_TO_ORIGIN` preserves the complete executed route prefix up to that
  instant, removes every future command and adds one shortest great-circle leg
  back to the expedition origin;
- `CONTINUE` records the same decision boundary without changing the route;
- the return uses the original speed and moving-consumption profile; no supply
  refill or teleport occurs;
- entry into the 500 m radius of the origin city is resolved by the existing
  authoritative GAME-007 arrival rule and completes the expedition;
- the debug map exposes the doctrine choice, effective route, live state and a
  dedicated journal event;
- a deterministic DEV preset demonstrates preparation, the 50% decision and
  successful city re-entry in three clicks.

The 50% boundary is intentionally earlier than the 25% warning. On an outbound
route, returning over no more than the already travelled distance at unchanged
speed and consumption needs at most the half of stock that remains.

## Manual acceptance

Run:

```bash
npm run debug-map
```

Open `http://127.0.0.1:4173` and use the GAME-017 card in **Состояние
каравана**:

1. Keep **Вернуться в город старта** selected and click
   **DEV: проверить возврат**. The preset becomes a 40 km eastbound route at
   5 km/h with 100 food, 100 water and moving consumption of 12.5 units/hour.
   The card must predict the boundary at `T+04:00:00` and a direct 20 km
   return.
2. Click **DEV: к порогу 50%**. The caravan must be 20 km from the origin,
   both resources must show 50%, the future route must point back to the start,
   and the event log must activate **Аварийная доктрина: возврат**.
3. Click **DEV: к городу**. The outcome must become successful after re-entry
   into the origin-city radius, before either resource is depleted.

For the non-return branch, select `CONTINUE`: the decision is still logged at
50%, but the original route remains unchanged.

The compiled demo also prints the exact GAME-017 boundary, direct-return
distance and authoritative re-entry time:

```bash
npm run demo
```

## Automated verification

Eight simulation-core regressions cover exact and simultaneous thresholds,
zero consumption, route-prefix preservation, city re-entry before depletion,
`CONTINUE`, non-triggering routes and input validation. Two debug-map
regressions cover effective-route presentation, the journal decision and
priority of an earlier discovery pause. Repository verification contains 294
tests: 289 simulation/UI tests plus 5 tooling tests.

## Scope boundary

GAME-017 handles one continuous moving interval. If discovery `STOP` occurs
first, that earlier boundary remains authoritative; reaching 50% during its
idle interval and cancelling the remaining wait is GAME-018. This checkpoint
does not add automatic buying, money, cargo transfer, consumption of city
stocks by the caravan, selection among multiple known cities, persistence,
database state, production chains or prices.
