# Checkpoint 37 — GAME-020: execute AVOID | CONTINUE

Version: `0.0.37`

## Goal

Execute the first explicit danger doctrine at the stable GAME-019 warning
boundary. `CONTINUE` must preserve the route exactly. `AVOID` must keep the
already travelled prefix, replace only the first future part with one
deterministic detour and prove that the resolved route stays outside the
selected patrol's 500 m contact radius.

## Implemented

- `planExpeditionMonsterDangerResponse(...)` resolves one selected moving
  patrol on an uninterrupted finite expedition route;
- `CONTINUE` returns the original `RoutePlan` object and its original contact
  unchanged;
- `AVOID` keeps every completed command and the exact partial command to the
  1000 m warning coordinate;
- one left/right waypoint is inserted, the route rejoins the end of the
  interrupted original segment, and every later command remains in the
  resolved suffix;
- candidate waypoints use deterministic `2 / 3 / 5 / 8 / 13 ×` warning-radius
  rings; the shortest safe side on the nearest successful ring wins, with a
  stable left-side tie break;
- every candidate is resolved as a complete timed route and accepted only if
  the continuous moving-contact solver returns no entry into 500 m;
- if no single candidate is safe, the explicit `detour-unavailable` result
  preserves the original route instead of claiming an unverified avoidance;
- a warning/contact tie remains `blocked-by-contact`, so contact priority from
  GAME-019 cannot be bypassed;
- a warning-only near pass can still execute AVOID, and a patrol-period delayed
  expedition preserves the same geometry while shifting absolute world time;
- the debug map adds an `AVOID | CONTINUE` selector, live doctrine result and a
  `danger-doctrine-decision` event immediately after `danger-detected` at the
  same authoritative second;
- AVOID feeds the verified effective route into arrival, supplies, player
  tracks, contact resolution and the executable journal; CONTINUE feeds the
  original route byte-for-byte.

## Manual acceptance

Run:

```bash
npm run debug-map
```

Open `http://127.0.0.1:4173` and:

1. Keep **AVOID** selected and click **DEV: маршрут на перехват**. The result
   must forecast one left/right detour and a positive added distance.
2. Click the same button again when it reads **DEV: к решению 1000 м**. The
   journal must show **Обнаружена опасность** and then **Доктрина опасности:
   обойти** at the same timestamp. The result must state that the whole new
   path was checked outside 500 m.
3. Inspect the route and the local contact inset (±5 km is convenient). The
   route must leave the exact warning point through one waypoint, rejoin the
   interrupted route, and the contact panel/log must contain no 500 m contact.
4. Click **DEV: к финишу обхода**. The expedition reaches its normal later
   boundary without a selected-patrol contact.
5. Select **CONTINUE**, click **DEV: новый перехват**, then advance through the
   1000 m decision. The route must remain unchanged and the original 500 m
   contact must remain in the forecast/executed journal.

The compiled demo prints the selected side, added route distance and
`contact-after=none`:

```bash
npm run demo
```

## Automated verification

Nine simulation-core regressions cover exact route identity for CONTINUE,
prefix/suffix preservation, one-waypoint geometry, continuous 500 m clearance,
determinism, a warning-only near pass, no-warning behavior, contact priority,
delayed world time and validation. Three debug-map regressions cover AVOID and
CONTINUE snapshots plus journal/outcome contact removal. Repository
verification contains 325 tests: 320 simulation/UI tests plus 5 tooling tests.

## Scope boundary

GAME-020 covers one selected patrol during uninterrupted movement. It does not
compose warning/avoidance across a discovery STOP, choose among several
simultaneous patrols, guarantee a path when no one-waypoint candidate is safe,
model pursuit, expose hidden monsters, persist doctrine state or calibrate
terrain/weather sensors. GAME-021 is the separate discovery-STOP composition.
