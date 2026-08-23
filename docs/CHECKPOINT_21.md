# Checkpoint 21 — UI-006: local contact zoom

Version: `0.0.21`

## Goal

Keep short cyclic monster patrols and their 500 m contact boundary readable when the authoritative caravan route spans a much larger world distance and duration.

## Implemented

- a dedicated north-up local inset inside the existing monster-contact panel;
- automatic focus on the exact planned SIM-008 contact when one exists;
- automatic fallback focus on the selected patrol's current authoritative position when the route has no contact;
- spatial windows of ±1 km, ±5 km and ±25 km;
- temporal windows of ±5 minutes, ±30 minutes and ±3 hours around the focus time;
- simultaneous sampled traces for the finite caravan route and the cyclic monster patrol;
- exact caravan and monster markers at the focus timestamp;
- the selected monster's real interaction radius, projected around its focus position;
- deterministic tangent-plane projection derived from great-circle distance and bearing;
- finite caravan traces clamp to route start and end while the patrol uses its existing cyclic position function at the same timestamps;
- zoom changes update presentation without pausing UI-005 playback or modifying elapsed simulation time;
- visible scale rings, north marker, legend, focus kind and exact time-window caption;
- responsive layout that keeps the inset usable below the two-column contact panel.

## Running locally

```bash
npm run debug-map
```

Open `http://127.0.0.1:4173`.

1. Press **DEV: маршрут на перехват**. The inset must focus the planned contact and show both trajectories.
2. Select ±25 km / ±3 h to inspect the patrol loop in expedition context.
3. Select ±1 km / ±5 min to inspect the 500 m interaction boundary and the two exact contact positions.
4. Switch spatial and temporal presets while Play is running. The clock must continue without resetting or pausing.
5. Change to a route without a calculated contact. The inset must follow the selected patrol at the current simulation time instead of showing stale contact data.

## Automated verification

Seven focused UI-006 regressions cover the exact preset sets, contact-centered projection, distance invariance across spatial zoom, stable focus across temporal zoom, deterministic patrol fallback, clipping to the finite expedition interval, and invalid preset/contact identity rejection. Together with the unchanged suite, repository verification contains 205 tests: 200 simulation/UI tests plus 5 tooling regressions.

## Scope boundary

UI-006 does not change SIM-008, world coordinates, patrol routes, expedition timing, contact resolution or clock speed. Its sampled lines are presentation traces around exact authoritative positions, not a second encounter calculation. It adds no player-facing fog of war, pan gesture, production map tiles or tactical-combat camera.

## Next checkpoint

`GAME-008` — resume a discovery-STOP expedition from its exact authoritative pause without rediscovering the same target.
