# Changelog

## 0.0.14 — Checkpoint 14

- Added `GAME-002`: a pure deterministic `STOP | MARK_AND_CONTINUE` decision over the authoritative static-object discovery event.
- Made `STOP` freeze SIM-005 route movement at the exact first-entry coordinate and end executable route milestones at the decision.
- Made `MARK_AND_CONTINUE` record the target while preserving the original movement, ETA and arrival.
- Added a two-option discovery-doctrine control, live decision state, stopped caravan presentation and doctrine-specific timeline entries to the debug map.
- Kept future decisions hidden until discovery and preserved miss behavior without inventing a doctrine action.
- Added ten GAME-002 regressions; repository verification now runs 132 tests.
- Designated `GAME-003`, explicit expedition completion and fatal depletion outcomes, as the next checkpoint.

## 0.0.13 — Checkpoint 13

- Added `GAME-001`: a deterministic rumor about a hidden mine 30–50 km northwest of the selected origin city.
- Kept player-facing knowledge coarse while isolating exact target position, bearing and distance as server truth in a namespaced PRNG stream.
- Added a coordinate-free local north-up search inset, route overlay, live searching/found/missed states and a DEV-only direct-route control.
- Reused WORLD-003's authoritative 150 m route-entry discovery instead of duplicating proximity logic in the browser.
- Added revealed-only discovery and miss events to the expedition timeline so future outcomes are not leaked.
- Added twelve GAME-001 regressions; repository verification now runs 122 tests.
- Designated `GAME-002`, the first automatic `STOP | MARK_AND_CONTINUE` discovery doctrine, as the next checkpoint.

## 0.0.12 — Checkpoint 12

- Added `UI-004`: a compact deterministic expedition timeline in the debug-map sidebar.
- Added ordered departure, segment-completion, 25% supply warning, first-depletion and route-arrival events derived from existing route and SIM-006 truth.
- Added live occurred/current/future states tied to the simulation-time slider and kept future events visibly marked as forecasts.
- Combined simultaneous food/water warnings, preserved separate warnings for different depletion ratios, and ordered exact depletion before same-time arrival.
- Added eight event-log regressions; repository verification now runs 110 tests.
- Designated `GAME-001`, the first deterministic rumor-driven search scenario, as the next checkpoint.

## 0.0.11 — Checkpoint 11

- Added `UI-003`: a persistent caravan status panel driven by the existing SIM-005 route position and SIM-006 supply APIs.
- Added live route progress, segment and distance status, food/water meters, current depletion state, and a survival forecast through route ETA.
- Added editable initial stocks and moving/idle consumption profiles without adding a production dependency or coupling `sim-core` to the browser.
- Stopped supply projection at arrival so UI-003 does not invent post-route idle activity or expedition consequences.
- Added six caravan-panel regressions; repository verification now runs 102 tests.
- Designated `UI-004`, the deterministic expedition event log, as the next checkpoint; local patrol/time zoom remains a deferred UX improvement.

## 0.0.10 — Checkpoint 10

- Added `UI-002`: a four-segment caravan route editor anchored to any generated city.
- Added km/h and kilometer UI inputs that resolve through the public meter-based `sim-core` route API.
- Added a sampled, antimeridian-safe spherical route overlay, numbered waypoints, total distance, ETA and a time-aware caravan marker with developer details.
- Added five route-editor regressions; repository verification now runs 96 tests.
- Designated `UI-003`, the persistent caravan status and supplies panel, as the next checkpoint.

## 0.0.9 — Checkpoint 09

- Added `UI-001`: a dependency-free, north-up browser debug map over the public `sim-core` API.
- Added deterministic seed controls, a patrol-time slider, city/static-object/monster layers, exact developer coordinates and encounter radii, and antimeridian-safe patrol rendering.
- Added a restricted local static server and the `npm run debug-map` launch command without production dependencies.
- Added eight projection/snapshot regressions and two server-safety tests; repository verification now runs 91 tests.
- Designated `UI-002`, the four-segment caravan route editor, as the next checkpoint.

## 0.0.8 — Checkpoint 08

- Added `SIM-008`: first moving encounter across overlapping absolute-time windows.
- Added finite and cyclic route motions, caller-bounded searches, and the existing 500 m interaction radius as the default.
- Added deterministic continuous-time search across route and patrol-cycle boundaries without fixed-tick sampling.
- Added ten tests for synchronized and delayed crossings, time clipping, later patrol cycles, antimeridian continuity, tangent contact, symmetry, inactive routes, and validation; repository verification now runs 81 tests.
- Designated `UI-001`, the first north-up debug map, as the next checkpoint.

## 0.0.7 — Checkpoint 07

- Added `WORLD-004`: deterministic wandering monsters with stable IDs and isolated PRNG streams.
- Added physically closed three-leg patrol routes and cyclic position evaluation at arbitrary elapsed time.
- Added provisional MVP movement constants and ten monster tests; repository verification now runs 71 tests.
- Designated `SIM-008`, time-aware encounter detection for two moving entities, as the next checkpoint.

### Development workflow included since 0.0.6

- Fixed `npm run accept:main` on Windows by avoiding direct `spawnSync` execution of `npm.cmd`.
- Added three cross-platform npm invocation regression tests.

## 0.0.6 — Checkpoint 06

- Added `WORLD-003` / `SIM-007`: exact first-entry discovery of static objects along spherical route segments.
- Added the 150 m concealed-object default, custom-radius validation, travel-ordered discovery events, and antimeridian-safe geometry.
- Added ten discovery tests and a deterministic demo scenario; the complete suite now contains 58 tests.
- Designated `WORLD-004`, a deterministic wandering monster with a cyclic route, as the next checkpoint.

### Development workflow included since 0.0.5

- Added persistent repository instructions for Codex in `AGENTS.md`.
- Added one-command Windows acceptance with concise summaries and full failure logs outside the repository.
- Removed the duplicate TypeScript build from GitHub Actions while preserving existing `npm test` and `npm run demo` behavior.
- Documented the CI-gated pre-MVP merge and revert process without advancing the product version or checkpoint.

## 0.0.5 — Checkpoint 05

- Added `WORLD-002`: deterministic hidden static oasis, mine, ruins, and cave objects.
- Isolated every object kind in a namespaced PRNG stream without changing `WORLD-001` cities.
- Added configurable per-kind counts, stable IDs, golden regression coverage, and demo output.
- Designated `WORLD-003` route-and-radius discovery as the next checkpoint.

## 0.0.4 — Checkpoint 04

- Added GitHub Actions CI for clean installation, TypeScript compilation, and tests.
- Added the root `TODO.md` for short-term, pull-request-sized work.
- Added LF line-ending normalization across Windows and Linux.
- Added `WORLD-001`: dependency-free deterministic seeded generation of ten cities.
- Added six automated WORLD-001 tests and a reproducible demo scenario.

## 0.0.1 — 2026-08-14

### Added
- Project skeleton for simulation-first development.
- SIM-001 world coordinate types and unit conventions.
- SIM-002 spherical destination-point calculation.
- SIM-003 great-circle distance calculation.
- Automated tests for normalization, wrap-around and geometry invariants.
- Small console demo for a 100 km route command.

### Documentation
- GDD updated to v0.2 with the latest decisions on time scale, north-up map, detection constants, offline survival, monster power stub, physical city resources, cartography and the simplified color set.
- ROADMAP and MVP_SPEC updated to the small-checkpoint development model.

## 0.0.2 — Checkpoint 02

- Добавлен `SIM-004`: составной маршрут из `bearing + distance`.
- Добавлен расчёт ETA сегментов и полного маршрута.
- Добавлен `SIM-005`: вычисление положения каравана в момент времени `T`.
- Добавлены данные о пройденном/оставшемся расстоянии и текущем сегменте.
- Добавлено 10 автоматических тестов; всего 22.
- Demo обновлён для четырёхсегментного маршрута длиной 87 км.

## 0.0.3 — Checkpoint 03

- Checkpoint 02 подтверждён на рабочем компьютере пользователя: 22/22 теста.
- Добавлен `SIM-006`: запасы еды и воды.
- Добавлены отдельные нормы расхода для движения и стоянки.
- Добавлен точный расчёт времени первого истощения food/water.
- Для MVP истощение любого критического запаса считается фатальным событием.
- Добавлена проверка, хватит ли запасов на заданную длительность.
- Demo связывает маршрут с запасами: показывает момент истощения и положение каравана в этот момент.
- Добавлено 10 автоматических тестов SIM-006; всего 32 теста.
