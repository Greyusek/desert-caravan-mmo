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
- [x] `DEVX-003`: keep a short persistent Work handoff in the repository so an autonomous series can resume safely after a resource-limit stop.
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
- [x] `CITY-003`: reduce aggregate population deterministically after the first food or water shortage and slow remaining consumption as the city shrinks.
- [x] `GAME-017`: at the 50% food/water boundary during uninterrupted movement, execute `RETURN_TO_ORIGIN | CONTINUE` and replace only the future route when returning.
- [x] `GAME-018`: if the 50% boundary occurs during a discovery STOP, let emergency return cancel the remaining idle wait and depart from the exact stop coordinate.
- [x] `GAME-019`: define the first detected-danger boundary and validate its radius/order relative to the 500 m contact boundary before implementing `AVOID | CONTINUE` route changes.
- [x] `GAME-020`: at the first 1000 m detected-danger boundary, execute `AVOID | CONTINUE`; preserve the route for `CONTINUE` and replace only its future prefix with one deterministic 500 m-clearance detour for `AVOID`.
- [x] `GAME-021`: compose the same 1000 m warning and `AVOID | CONTINUE` decision with a scheduled discovery `STOP`; preserve contact priority, and let AVOID cancel only the remaining wait before departing from the exact stop coordinate.
- [x] `GAME-022`: select the first authoritative 1000 m danger warning across several patrols with stable time/monster-id tie-breaking; keep multi-patrol avoidance clearance outside this detection-only slice.
- [x] `GAME-023`: execute moving `AVOID | CONTINUE` for the selected first warning and accept an AVOID route only after continuous clearance checks against every patrol; keep discovery-STOP composition for a later slice.
- [x] `GAME-024`: compose multi-patrol `AVOID | CONTINUE` with a scheduled discovery `STOP`, preserving exact world/route time, contact priority and all-patrol clearance after departure.
- [x] `GAME-025`: promote stable multi-patrol contact selection into the authoritative expedition contact/outcome API, preserving first-boundary priority without resolving more than one contact per slice.
- [x] `LIVING-001`: add deterministic route-backed NPC caravans that reuse SIM-004/SIM-005 and authoritative world time.
- [x] `LIVING-002`: add asymmetric caravan detection without requiring reciprocal visibility.
- [x] `LIVING-003`: derive deterministic coordinate-free tracks with approximate age from executed NPC travel.
- [x] `LIVING-004`: add minimal deterministic pursuit/evasion over the existing route model.
- [x] `CONSEQUENCE-001`: retain destroyed caravans as degrading world remains with minimal loot.
- [x] `KNOWLEDGE-001`: record tracks/remains with source, observation time and confidence in player knowledge and the event journal.
- [x] `LIBRARY-001`: add local city archives and physical knowledge deposit/copy transfer without global synchronization.
- [x] `LIBRARY-002`: keep fallen-city libraries discoverable and degrade their information deterministically.
- [x] `HISTORY-001`: add several coordinate-free rumor types with deterministic information quality.
- [x] `HISTORY-002`: add persistent creatures/populations with deterministic simulation-detail catch-up.
- [x] `HISTORY-003`: add coordinate-free creature intelligence and earned legendary history without full Magic/System 256.
- [x] `MVP1-001`: prove the complete deterministic Living Path scenario and close MVP-1.
- [x] Add a checkpoint demo for reproducing a world from its seed.

## Trading Prototype queue

- [x] `TRADE-001`: add a seven-good catalog and deterministic city production/consumption projected from authoritative world time over finite stocks, reusing existing food/water stocks and populations.
- [x] `TRADE-002`: derive transparent bounded buy/sell prices from each city's current stock and target demand without random price rolls.
- [x] `TRADE-003`: add capacity-limited caravan cargo, local buy/sell transactions, physical route delivery, a trade journal and route profit/loss.
- [x] `TRADE-004`: make a route-backed NPC trader buy, physically carry and sell through the same market operations so later player prices change.
- [ ] `INFO-TRADE-001`: quote a physical knowledge bundle for one target library from local novelty, accuracy, age, independent confirmation and strategic value.
- [ ] `INFO-TRADE-002`: enforce small physical-copy limits and bundle fidelity/age degradation so repeated, copied or degraded information is worth less or zero.
- [ ] `UI-007`: expose city goods, production/consumption, prices, cargo, transactions, route result, NPC market impact and information value in the existing debug map.
- [ ] `TRADING-001`: prove the complete deterministic Trading Prototype in one seeded end-to-end scenario and close Stage 3.

## Future R&D anchors

- [x] `DESIGN-AI-001`: integrate the autonomous «Искины» direction into GDD/ROADMAP as a future simulation layer. The accepted contract and experiments live in [`docs/AI_ISKINS_CONCEPT.md`](docs/AI_ISKINS_CONCEPT.md) and [`docs/ROADMAP.md`](docs/ROADMAP.md); implementation remains behind the current MVP checkpoints and its dependency gate.

## Maintenance rules

- Keep tasks small enough for one feature or fix branch and one pull request.
- Add automated tests for functional work wherever practical.
- Mark work complete only after the build and test suite pass in CI.
- Skip routine manual review before MVP, but use the exceptions in [`docs/DEVELOPMENT_WORKFLOW.md`](docs/DEVELOPMENT_WORKFLOW.md).
- Update this list when a PR changes priorities; do not copy the full roadmap here.
