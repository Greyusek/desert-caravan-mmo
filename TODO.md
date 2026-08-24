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
- [x] `UI-005`: add deterministic play/pause controls with x1 / x10 / x100 / x1000 development speeds.
- [x] `UI-006`: add local map/time zoom so short monster patrol loops and close encounters remain readable beside long caravan routes.
- [x] `GAME-008`: resume a discovery-STOP expedition from its exact authoritative pause without rediscovering the same target.
- [x] `GAME-009`: model explicit time spent at a discovery STOP with SIM-006 idle consumption before resume.
- [x] `GAME-010`: resolve cyclic-patrol contact with a stationary caravan during the discovery-STOP interval.
- [x] `GAME-011`: retain discovered-object knowledge in an in-session player expedition ledger without database persistence.
- [x] `GAME-012`: prepare a return expedition from a selected known-object ledger entry using relative navigation data.
- [x] `DESIGN-001`: consolidate GDD v0.3 and MVP_SPEC v0.3 around production world scale and the physical map/library information economy.
- [x] `DESIGN-002`: integrate the world bible, magic, bestiary, ecology, System 256 and presentation canon into GDD v0.4 without changing the GAME-005 implementation.

## Next

- [x] `GAME-013`: render confirmed ledger entries on a coordinate-free north-up session knowledge map, still without production physical-map ownership or database persistence.
- [x] `GAME-014`: retain executed expedition tracks on that session map and reveal only actually travelled corridors, still without database persistence or the production physical-map item.
- [x] `GAME-015`: reveal a physically scaled 300 m player-visibility corridor around actually travelled tracks as the first session fog-of-war slice.
- [x] `GAME-016`: after authoritative arrival, record the reached city as a confirmed relative personal-map landmark without exposing or globally joining server coordinates.
- [x] `CITY-001`: give every seeded city deterministic finite food and water stocks, visible in DEV tools but not yet consumed or traded.
- [x] `CITY-002`: generate aggregate NPC populations and project their food/water consumption from authoritative world time.
- [x] Add a checkpoint demo for reproducing a world from its seed.

## Future R&D anchors

- [x] `DESIGN-AI-001`: integrate the autonomous «Искины» direction into GDD/ROADMAP as a future simulation layer. The accepted contract and experiments live in [`docs/AI_ISKINS_CONCEPT.md`](docs/AI_ISKINS_CONCEPT.md) and [`docs/ROADMAP.md`](docs/ROADMAP.md); implementation remains behind the current MVP checkpoints and its dependency gate.

## Maintenance rules

- Keep tasks small enough for one feature or fix branch and one pull request.
- Add automated tests for functional work wherever practical.
- Mark work complete only after the build and test suite pass in CI.
- Skip routine manual review before MVP, but use the exceptions in [`docs/DEVELOPMENT_WORKFLOW.md`](docs/DEVELOPMENT_WORKFLOW.md).
- Update this list when a PR changes priorities; do not copy the full roadmap here.
