# Checkpoint 29 — GAME-015: physical session visibility corridor

Version: `0.0.29`

## Goal

Turn retained travel history into the first honest session fog-of-war slice:
only the area within the accepted 300 m player-visibility radius around
actually travelled paths is revealed, and the rest of the local chart remains
unexplored.

## Implemented

- the knowledge-map snapshot reuses the simulation constant
  `DEFAULT_VISIBLE_TARGET_RADIUS_METERS = 300`;
- the physical radius is converted to pixels from the selected chart's
  `scaleRadiusMeters / radiusPixels`, so zooming out changes presentation width
  without changing the 300 m rule;
- every travelled track contributes a round-ended visibility corridor with a
  physical diameter of 600 m;
- an SVG luminance mask unions those corridors and covers every other part of
  the chart with an unexplored fog layer;
- the map's route center lines remain visible as travel history and confirmed
  object markers remain readable as explicit player knowledge;
- the mask uses only coordinate-free local chart points derived from retained
  bearing/distance legs;
- independent origin-city charts still have independent masks;
- empty knowledge does not invent a visibility aperture;
- planned future route legs, terrain tiles, server coordinates and persistent
  map state remain absent.

## Running locally

```bash
npm run debug-map
```

Open `http://127.0.0.1:4173`.

1. Confirm that the personal chart starts empty.
2. Press **DEV: маршрут к цели** and advance only partway.
3. Confirm that the travelled line cuts a narrow transparent corridor through
   the dark field and that the UI states `Обзор 300 м`.
4. Advance farther: visibility must extend only with actually travelled path;
   no future segment may appear.
5. Move the DEV slider backwards: the retained visible corridor must not
   shrink.
6. Repeat an expedition: the fog openings from both expeditions must remain.
7. Clear session knowledge or change seed: tracks and fog openings must reset
   together.

## Automated verification

Three GAME-015 regressions verify the exact 300 m contract, inverse pixel
scaling between 10 km and 100 km charts, and the absence of an invented opening
in an empty session. Together with the unchanged suite, repository verification
contains 265 tests: 260 simulation/UI tests plus 5 tooling regressions.

## Acceptance finding carried forward

GAME-014 manual acceptance confirmed that a route and a static discovery remain
visible, but an authoritatively reached destination city is not yet added to
personal knowledge. This is expected under the completed scope rather than a
failed arrival. It is now the explicit next checkpoint.

## Scope boundary

GAME-015 does not add terrain tiles, a full production fog system, visible-city
or creature discovery, `localStorage`, IndexedDB, a server, a database, account
persistence, physical map ownership, copying, trading or global chart
synchronization. A reached city therefore still appears only on the DEV world
map until GAME-016 records its relative personal fix.

## Next checkpoint

`GAME-016` — after authoritative arrival, record the reached city as a confirmed
relative landmark on the matching personal chart without exposing its absolute
server coordinate or globally joining independent city maps.
