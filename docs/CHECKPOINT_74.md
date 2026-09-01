# Checkpoint 74 — PLAYER-GLOBAL-001 Global Map / Caravan Command

Version: `0.0.74`

## Implemented

- Replaces the Global Map placeholder with a functional player-facing command
  screen while leaving City, formation, battle and result views for their own
  checkpoints.
- Projects only the allow-listed relative known places and route geometry;
  north is always rendered upward and no seed, absolute coordinate, hidden
  encounter or Debug UI control reaches the browser.
- Adds five independent presentation layers: cities, known objects, route,
  rumors/threats and events. Empty projected layers truthfully show zero.
- Displays projected food, water, members, speed, remaining distance, ETA and
  critical warnings without recalculating authoritative game outcomes.
- Enables destination selection and journey start only when the player
  projection exposes the matching action.
- Keeps one local controller behind the Player UI endpoint so accepted commands
  advance revision, route and journal state; unsupported commands are rejected.
- Adds a collapsible, newest-first player journal and updates it after route
  preparation and departure.
- Preserves the standalone Debug UI boundary and the finite bootstrap failure
  state introduced by the preceding fix.

## Verification

- Dedicated PLAYER-GLOBAL-001 model/session additions: `9/9` PASS.
- Full `npm run verify:local`: `630/630` PASS.
- HTTP state transition: `city → ready → travelling` PASS.
- Rejected action preserves session revision: PASS.
- `git diff --check`: PASS.

## Manual review

See [`MANUAL_TEST_CHECKPOINT_74.md`](MANUAL_TEST_CHECKPOINT_74.md) for exact
branch-switching, launch and player-flow checks.

## Next

`PLAYER-CITY-001`: implement the City view over the existing market and physical
information/library operations without expanding browser authority.
