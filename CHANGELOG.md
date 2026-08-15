# Changelog

## Unreleased — Windows acceptance fix

- Fixed `npm run accept:main` on Windows by avoiding direct `spawnSync` execution of `npm.cmd`.
- Added three cross-platform npm invocation regression tests; repository verification now runs 61 tests.

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
