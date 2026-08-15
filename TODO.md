# Desert Caravan MMO — TODO

This file tracks the next concrete, reviewable tasks. The longer-term direction and milestone exit criteria remain in [`docs/ROADMAP.md`](docs/ROADMAP.md).

## In progress

- [x] Establish GitHub-driven CI (`npm ci` → TypeScript build → automated tests).
- [x] Normalize repository line endings for Windows and Linux.
- [x] `WORLD-001`: generate a deterministic seeded world containing ten initial cities.
- [x] Open and merge PR #1 after CI succeeds.
- [x] `WORLD-002`: add deterministic hidden static objects (oasis, mine, ruins, cave).
- [x] `DEVX-001`: document the CI-gated pre-MVP workflow and add one-command local acceptance.
- [x] `WORLD-003` / `SIM-007`: detect hidden static objects on the caravan's real route.
- [x] `DEVX-002`: make local acceptance launch npm reliably on Windows.
- [x] `WORLD-004`: add deterministic wandering monsters with cyclic patrol routes.
- [x] `SIM-008`: detect encounters between two moving entities in overlapping time windows.
- [x] `UI-001`: add a dependency-free north-up developer debug map.
- [x] `UI-002`: add a four-segment caravan route editor to the debug map.
- [x] `UI-003`: add a persistent caravan status and supplies panel.

## Next

- [ ] `UI-004`: add a compact deterministic expedition event log.
- [ ] UX (deferred): add local map/time zoom so short monster patrol loops remain readable beside long caravan routes.
- [x] Add a checkpoint demo for reproducing a world from its seed.

## Maintenance rules

- Keep tasks small enough for one feature or fix branch and one pull request.
- Add automated tests for functional work wherever practical.
- Mark work complete only after the build and test suite pass in CI.
- Skip routine manual review before MVP, but use the exceptions in [`docs/DEVELOPMENT_WORKFLOW.md`](docs/DEVELOPMENT_WORKFLOW.md).
- Update this list when a PR changes priorities; do not copy the full roadmap here.
