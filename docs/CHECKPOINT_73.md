# Checkpoint 73 — PLAYER-SHELL-001 standalone Player UI

Version: `0.0.73`

## Implemented

- Adds a separate dependency-free `packages/player-ui` browser application.
- Serves Player UI independently on port 4174 while preserving Debug UI on
  port 4173 as a distinct application.
- Supplies the browser only with the serialized allow-listed player projection
  through a local read-only endpoint; Player UI assets cannot request Debug UI
  or `sim-core` source files.
- Adds five top-level navigation entries: Global Map, City, Caravan
  Preparation, Battle and Battle Result.
- Derives every available/disabled navigation state from the projected session
  screen list and rejects unavailable, unknown or missing screens.
- Establishes the first desktop visual language: shared typography, spacing,
  surfaces, borders, controls, selected/disabled/focus/critical states and
  reduced-motion behavior.
- Adds accessible loading/error states, skip navigation, semantic landmarks,
  visible keyboard focus and responsive layout fallbacks.
- Guards browser bootstrap and the local session request with finite timeouts,
  catches module-loading failures and replaces an indefinite spinner with a
  retryable diagnostic state.
- Keeps functional map layers, market operations, formation and combat controls
  out of this shell checkpoint; those remain separate queued tasks.

## Verification

- Dedicated PLAYER-SHELL-001 model/tooling additions: `15/15` PASS.
- Full `npm run verify:local`: `621/621` PASS.
- Local HTTP smoke: root/CSS/bootstrap/main/model/API `200`, safe payload PASS.
- `git diff --check`: PASS.

## Manual review

See [`MANUAL_TEST_CHECKPOINT_73.md`](MANUAL_TEST_CHECKPOINT_73.md) for visual
shell, navigation, Player/Debug separation and responsive checks.

## Next

`PLAYER-GLOBAL-001`: implement the known north-up map, caravan command status,
route actions, layer controls and compact journal within the established shell.
