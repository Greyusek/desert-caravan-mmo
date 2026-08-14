# Changelog

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
