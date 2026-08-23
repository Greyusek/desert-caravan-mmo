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
- [x] `UI-004`: add a compact deterministic expedition event log.
- [x] `GAME-001`: add the first deterministic rumor-driven search scenario.
- [x] `GAME-002`: add a simple `STOP | MARK_AND_CONTINUE` discovery doctrine.
- [x] `GAME-003`: add explicit completion, pause and fatal-depletion expedition outcomes.
- [x] `GAME-004`: connect SIM-008 moving monster encounters to the expedition and event timeline without combat.
- [x] `GAME-005`: resolve contacts with the transparent Player Power 100 / monster Power 90 or 110 pre-combat stub.
- [x] `GAME-006`: resolve `FLEE` deterministically from explicit movement inputs, preserving the no-tactical-combat MVP scope.
- [x] `GAME-007`: make a generated city the authoritative expedition destination and complete the first return-to-city loop.
- [x] `DESIGN-001`: consolidate GDD v0.3 and MVP_SPEC v0.3 around production world scale and the physical map/library information economy.
- [x] `DESIGN-002`: integrate the world bible, magic, bestiary, ecology, System 256 and presentation canon into GDD v0.4 without changing the GAME-005 implementation.

## Next

- [ ] `UI-005`: add deterministic play/pause controls with x1 / x10 / x100 / x1000 development speeds.
- [ ] UX (deferred): add local map/time zoom so short monster patrol loops remain readable beside long caravan routes.
- [x] Add a checkpoint demo for reproducing a world from its seed.

## Maintenance rules

- Keep tasks small enough for one feature or fix branch and one pull request.
- Add automated tests for functional work wherever practical.
- Mark work complete only after the build and test suite pass in CI.
- Skip routine manual review before MVP, but use the exceptions in [`docs/DEVELOPMENT_WORKFLOW.md`](docs/DEVELOPMENT_WORKFLOW.md).
- Update this list when a PR changes priorities; do not copy the full roadmap here.
