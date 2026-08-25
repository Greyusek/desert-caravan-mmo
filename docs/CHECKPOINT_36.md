# Checkpoint 36 — GAME-019: detected-danger boundary before contact

Version: `0.0.36`

## Goal

Establish one deterministic server-truth warning boundary for a visible moving
patrol before implementing `AVOID | CONTINUE`. The boundary must occur before
the existing 500 m contact in a normal approach and must not silently mutate
the expedition route.

## Implemented

- the first technical danger warning uses 1000 m, equal to the already
  established GAME-006 safe separation (`2 × 500 m`);
- the warning radius is explicitly separate from the 300 m optical-visibility
  constant and the 150 m concealed-object detection radius;
- `findFirstExpeditionMonsterDangerDetection(...)` continuously finds the
  first entry of an uninterrupted finite expedition into the cyclic patrol's
  warning radius;
- the authoritative record preserves absolute world time, expedition/route
  time, patrol time, exact positions, separation, monster identity and Power;
- when a later 500 m contact exists, the record exposes its exact timestamp
  and warning lead; a near pass can instead be `no-contact`;
- configurations whose warning radius is not strictly larger than contact are
  rejected;
- an expedition that starts already inside contact records both boundaries at
  the same instant as `at-contact`, making contact priority explicit;
- the DEV journal adds `danger-detected` before `monster-contact`, the world
  overlay marks the warning coordinate, and the local contact inset draws
  concentric 1000 m warning and 500 m interaction circles;
- GAME-019 observes only: it does not execute `AVOID`, change route commands,
  alter Power/FLEE resolution or compose warning time across a discovery STOP.

## Manual acceptance

Run:

```bash
npm run debug-map
```

Open `http://127.0.0.1:4173` and:

1. Click **DEV: маршрут на перехват**. The expedition journal must forecast
   **Обнаружена опасность** at 1000 m before the existing monster-contact event
   at 500 m.
2. Inspect the local contact inset. It must show the teal dashed outer danger
   boundary and the red dashed inner interaction boundary; zoom changes their
   pixels without changing 1000/500 m server distances.
3. Start playback at x1000 or move the time slider through the warning time.
   The `danger-detected` event and DEV `DETECTED` marker must become occurred
   before contact.
4. Verify that the planned route is unchanged after the warning. Existing
   Power/FLEE behavior must still execute only at the later 500 m contact.

The compiled demo prints the exact warning, contact and lead:

```bash
npm run demo
```

## Automated verification

Eight simulation-core regressions cover the derived 1000 m default, exact
warning-before-contact order, a warning without contact, the start-inside tie,
delayed world time, no invented remote knowledge, determinism and validation.
Two debug-map regressions cover forecast/execution state, journal order and
route immutability. Repository verification contains 313 tests: 308
simulation/UI tests plus 5 tooling tests.

## Scope boundary

GAME-019 covers the first visible moving patrol on uninterrupted execution. It
does not implement avoidance geometry, the `AVOID | CONTINUE` doctrine,
stationary warning composition, concealed ambushes, several simultaneous
patrols, pursuit replanning, persistence or sensor calibration for terrain and
weather.

