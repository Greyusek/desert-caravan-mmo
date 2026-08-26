# Desert Caravan MMO — MVP_SPEC v0.5

**Дата:** 24 августа 2026

**Цель:** первый играбельный прототип движения, поиска и выживания.

## 1. Проверяемая гипотеза

> Игроку интересно самостоятельно строить маршрут в неизвестной области, рисковать запасами ради поиска объекта и принимать решения на основе неполной информации ещё до появления торговли, PvP и полноценной боёвки.

## 2. Один игровой сценарий MVP

1. Игрок появляется в городе A.
2. Получает слух: «примерно в 30–50 км к северо-западу находится рудник».
3. Покупает/получает запас воды и еды.
4. Строит маршрут из нескольких сегментов `азимут + расстояние`.
5. Выбирает простые правила: остановиться у рудника; отметить объект и продолжить; избегать обнаруженной угрозы; при критической провизии вернуться/уйти в известный город.
6. Запускает экспедицию.
7. Симуляция двигает караван по реальной геометрии мира.
8. Объект может быть найден или пропущен в зависимости от траектории и обзора.
9. Блуждающий монстр может пересечь геометрический маршрут, но встреча произойдёт только при совпадении во времени и пространстве.
10. Игрок возвращается в город либо погибает от контакта/истощения.
11. На карте остаются реально открытые точки и пройденная траектория.

## 3. Зафиксированные тестовые константы v0.3

- карта north-up: север сверху, юг снизу, запад слева, восток справа;
- абсолютные координаты игроку не показываются;
- базовый обзор видимой цели: **300 м**;
- базовое обнаружение скрытого/затаившегося объекта: **150 м**;
- техническая граница раннего предупреждения об обнаруженной движущейся опасности GAME-019: **1000 м** — уже принятая безопасная дистанция FLEE и строго внешняя граница относительно контакта 500 м; это не оптический обзор и не раскрытие скрытой цели;
- текущая техническая граница encounter: **500 м** — это параметр прототипа, а не окончательная дистанция визуального контакта или удара; до production её нужно развести с обзором 300 м и скрытым обнаружением 150 м, кроме явно смоделированной засады;
- текущий технический радиус прибытия в город: **500 м** — отдельная семантическая граница GAME-007, не означающая размер городской застройки или encounter distance;
- сила игрока в заглушке боя: **100**;
- слабый монстр: **90**;
- сильный монстр: **110**;
- раннее предупреждение о малом запасе: **25%**;
- аварийная граница провизии GAME-017/018: **50%** исходного запаса еды или воды во время движения или discovery `STOP`; более ранний порог нужен, чтобы прямой возврат при неизменных скорости и расходе оставался физически достижимым;
- production-время: ориентир **1 игровой день ≈ 3–4 реальных часа**, окончательно после playtest;
- для разработки обязательны ускорения x1 / x10 / x100 / x1000.

Размер production-планеты численно пока **не зафиксирован**. Принят измеримый критерий: обычный караван не должен иметь возможности обойти её даже за десятилетия реального времени непрерывного пути. Точный радиус калибруется вместе со скоростью, масштабом игрового времени и плотностью событий; текущая сфера — тестовая. Геометрические функции должны принимать радиус планеты как параметр.

## 4. Минимальные сущности

### Player
- id
- current city
- personal physical map / discovered knowledge with source and confidence
- active caravan

### Caravan
- position (server coordinate)
- route[]
- active segment
- speed
- food
- water
- moving/standing consumption rates
- vision radius
- concealed discovery radius
- interaction radius
- power (MVP = 100)
- status
- doctrine rules

### City
- position
- population
- finite food stock
- finite water stock
- optional market
- known routes for emergency relocation

### WorldObject
- id
- type: city | oasis | mine | ruins | cave | hidden_monster
- position
- discovery radius modifier (optional)
- interaction radius
- discovered state

### MovingEntity
- id
- type: wandering_monster (later NPC caravan)
- route[]
- speed
- vision radius
- interaction radius
- power
- behavior

### Rumor
- origin city
- object type
- approximate bearing sector
- approximate distance/range
- information quality

## 5. Геометрические операции, которые обязаны иметь тесты

- destination point from `(lat, lon, bearing, distance)`;
- great-circle distance between two points;
- interpolation/position on active segment at timestamp T;
- ETA to segment end;
- route total distance;
- minimum distance between moving entity and static object over time interval;
- potential encounter between two moving entities over overlapping time intervals;
- wrap/continuity around the planet.

## 6. Симуляционное время

Production-time пока не фиксируем окончательно. Рабочая гипотеза: **1 игровой день = 3–4 реальных часа**.

Для разработки обязательны режимы:

- x1
- x10
- x100
- x1000

Симуляция должна быть детерминированной при одинаковом world seed и одинаковых командах пользователя, насколько это практично.

## 7. UI первого прототипа

Один экран можно разделить на 4 зоны:

1. **Local map** — north-up плоскость, город, открытая местность, пройденный путь, известные объекты и туман войны; координаты не подписываются.
2. **Route editor** — таблица сегментов: угол, расстояние, добавить/удалить/переставить.
3. **Caravan panel** — скорость, вода, еда, обзор, статус, ETA.
4. **Event log** — обнаружения, решения доктрины, расход запасов, контакт, смерть, прибытие.

В dev mode поверх карты показываются настоящие координаты, радиусы и скрытые сущности.

## 8. Доктрина MVP и офлайн

**Безопасного офлайн-режима нет.** Сервер продолжает симуляцию, даже если браузер закрыт.

Минимальные правила:

- static object: `STOP | MARK_AND_CONTINUE`;
- detected danger: `AVOID | CONTINUE`;
- supplies below threshold: `RETURN_TO_LAST_KNOWN_CITY | CONTINUE`; в первом срезе GAME-017 последним известным безопасным городом считается город старта экспедиции, поэтому исполняется `RETURN_TO_ORIGIN | CONTINUE`;
- in city + low supplies: `AUTO_BUY_IF_AVAILABLE | DO_NOT_BUY`;
- city depleted + supplies critical: `MOVE_TO_NEAREST_KNOWN_CITY | STAY`;
- arrival at waypoint: `CONTINUE | STOP`.

Автопокупка работает только если у персонажа хватает денег **и** у города физически есть ресурс. Если городской запас исчерпан, NPC также продолжают потреблять ресурсы и могут погибать.

## 9. Контакт с монстрами до tactical combat

Полноценной боёвки в MVP-0 нет. Используем прозрачную заглушку:

- `Player Power = 100`;
- `Monster Power = 90` → при неизбежном контакте монстр погибает;
- `Monster Power = 110` → игроку/доктрине доступны `FLEE` или `ACCEPT_FIGHT`;
- `ACCEPT_FIGHT` против 110 в MVP означает смерть экспедиции;
- `FLEE` получает явные скорости каравана и монстра, фактическую дистанцию контакта и безопасную дистанцию;
- техническая безопасная дистанция GAME-006 равна двум interaction radius: **1000 м** при текущей границе контакта 500 м;
- строго более быстрый караван открывает разрыв со скоростью `caravanSpeed - monsterSpeed`, достигает безопасной дистанции за `(safeSeparation - contactSeparation) / relativeSpeed` и продолжает исходный маршрут;
- равная или меньшая скорость означает терминальное поражение на границе контакта; случайности, бонуса от Power и tactical rounds нет.
- те же правила действуют, если циклический патруль входит в радиус неподвижного каравана во время discovery `STOP`: слабая угроза не отменяет ожидание, успешный `FLEE` досрочно возобновляет маршрут, а истощение сохраняет приоритет при точном совпадении времени.
- GAME-019 отделяет раннее предупреждение от контакта: движущийся патруль сначала создаёт server-truth событие на 1000 м, а при сохранённом курсе позже входит в 500 м; если экспедиция уже стартовала внутри 500 м, обе границы совпадают и приоритет имеет контакт.
- GAME-020 исполняет `AVOID | CONTINUE` на этой границе во время непрерывного движения. `CONTINUE` сохраняет исходный маршрут без изменений. `AVOID` сохраняет исполненный префикс, вставляет один детерминированный waypoint, возвращается к концу прерванного сегмента и сохраняет поздний суффикс; новый маршрут принимается только после непрерывной проверки отсутствия входа в 500 м выбранного патруля.
- GAME-021 переносит ту же границу и решение внутрь scheduled discovery `STOP`. Мировое время продолжает идти при закреплённом route time; `CONTINUE` сохраняет полное ожидание, а `AVOID` отменяет только его остаток, выходит из точной координаты остановки и принимает обход лишь после проверки продолжения против выбранного патруля на фактическом мировом времени. Контакт или другая авторитетная граница на том же либо более раннем мгновении сохраняет приоритет.
- GAME-022 выбирает одну первую server-truth границу 1000 м среди нескольких патрулей как при движении, так и внутри scheduled discovery `STOP`. Более раннее время имеет приоритет, а кандидаты в пределах числового допуска упорядочиваются по raw monster ID независимо от порядка входного массива и локали. Этот слой только обнаруживает опасность: обход по-прежнему проверяется против одного выбранного патруля до отдельного multi-patrol checkpoint.

Затаившийся монстр использует уменьшенный базовый радиус обнаружения (150 м). Блуждающий монстр движется по собственному маршруту, поэтому геометрическое пересечение путей без совпадения во времени встречу не создаёт.

## 10. Карты и знания

В первом MVP у игрока одна физическая личная карта. Она хранит только реально открытые или полученные сведения. Карта уникальна для конкретного путешественника и не синхронизируется с другими игроками или городами автоматически.

Каждое сведение сохраняет происхождение и степень доверия. Купленную карту можно использовать и физически передать дальше, но нельзя выдать за собственное подтверждённое открытие при продаже библиотеке. Точные уровни достоверности и правила копирования остаются за пределами MVP-0.

Для более позднего слоя принят системный контракт:

`путешественник → физические сведения → городская библиотека → локальный архив → платная копия/фрагмент`.

Библиотека является градообразующим институтом: принимает или покупает карты и наблюдения, объединяет их в городской архив и продаёт копии. Картограф/библиотекарь обслуживает архив, но не является самим хранилищем. После падения города библиотека остаётся объектом мира и постепенно теряет полноту, точность, читаемость и актуальность; найденные остатки могут содержать знания сотен или тысяч путешественников.

Точные формулы цены, подтверждения, объединения, копирования и деградации пока остаются гипотезой. Кандидаты для цены: новизна для конкретного архива, точность, давность, независимое подтверждение и стратегическая ценность.

## 11. Что сознательно не делаем в MVP-0

- регистрацию и публичный сервер;
- PvP;
- полноценную производственно-торговую экономику;
- магию;
- навыки 0–500%;
- полную реализацию System 256 — её семицветный круг, Белый/Чёрный и три независимых канала уже каноничны, но распределение оттенков и численный баланс не входят в MVP-0;
- предметизацию лута;
- городские библиотеки, рынок информации и деградацию архивов;
- автономных нейросетевых NPC, City AI и Species AI;
- основание городов;
- чат/кланы;
- красивую финальную графику;
- мобильную адаптацию production-качества.

## 12. Предварительная архитектура

Один репозиторий, simulation-first, без микросервисов.

```text
/apps
  /web        browser UI (позже)
  /server     authoritative simulation/API (позже)
/packages
  /shared     shared types/contracts (когда понадобится)
  /sim-core   pure simulation & geometry
/docs
  GDD
  ROADMAP
  MVP_SPEC
```

Критическая часть — `sim-core`: чистые функции без UI и БД. Геометрия, движение, расход запасов и encounter detection тестируются отдельно.

Стек: TypeScript / Node.js; browser UI позже; server-authoritative backend. БД подключается тогда, когда появится необходимость сохранять изменяемый мир между запусками.

Будущие Искины являются сменным слоем над детерминированной симуляцией, а не её заменой. Архитектурная граница: `Perception API → Agent → Action API → authoritative simulation`. Агент не читает server truth, не мутирует мир напрямую и знает только физически доступные субъекту сведения; MVP-0 должен собираться, запускаться и воспроизводиться без нейросетевой модели или внешнего AI-провайдера.

## 13. Definition of Done MVP-0

- [x] запустить проект одной понятной командой;
- [x] увидеть стартовый город;
- [x] получить слух;
- [x] построить минимум 4-сегментный маршрут;
- [x] запустить симуляцию;
- [x] наблюдать изменение позиции и запасов;
- [x] найти объект при попадании в радиус обзора;
- [x] пройти мимо объекта, если радиус обзора не задел его;
- [x] избежать или встретить блуждающего монстра в зависимости от времени;
- [x] увидеть реакцию автоматической доктрины;
- [x] завершить маршрут или погибнуть от истощения;
- [x] вернуться именно в город;
- [x] перезапустить тот же seed и воспроизвести тестовый сценарий;
- [x] автоматические тесты геометрии проходят.

## 14. Backlog

- [x] `SIM-001` — тип координаты мира и единицы измерения.
- [x] `SIM-002` — функция destination point.
- [x] `SIM-003` — great-circle distance.
- [x] `SIM-004` — route segments и ETA.
- [x] `SIM-005` — положение каравана в момент T.
- [x] `SIM-006` — food/water consumption.
- [x] `WORLD-001` — seeded world с 10 городами.
- [x] `WORLD-002` — статичные скрытые объекты.
- [x] `WORLD-003` — route-aware discovery статичных объектов.
- [x] `SIM-007` — точный first-entry discovery radius check.
- [x] `WORLD-004` — wandering monster cyclic route.
- [x] `SIM-008` — time-aware moving encounter.
- [x] `UI-001` — debug map.
- [x] `UI-002` — route editor.
- [x] `UI-003` — caravan panel.
- [x] `UI-004` — event log.
- [x] `GAME-001` — rumor scenario.
- [x] `GAME-002` — simple doctrine.
- [x] `GAME-003` — expedition completion/death.
- [x] `GAME-004` — expedition monster encounter event.
- [x] `GAME-005` — pre-combat Power-stub contact resolution.
- [x] `GAME-006` — deterministic `FLEE` resolution without tactical combat.
- [x] `GAME-007` — authoritative destination-city arrival and first return loop.
- [x] `UI-005` — deterministic play/pause clock with x1 / x10 / x100 / x1000 development speeds.
- [x] `UI-006` — local spatial/time zoom for short patrol loops and close encounters.
- [x] `GAME-008` — explicit route resume after an authoritative discovery STOP without rediscovering the acknowledged target.
- [x] `GAME-009` — explicit discovery-STOP duration and SIM-006 idle consumption before resume.
- [x] `GAME-010` — cyclic-patrol contact with a stationary caravan during the discovery-STOP interval.
- [x] `GAME-011` — in-session player discovery ledger across repeated expeditions without database persistence.
- [x] `GAME-012` — prepare a return expedition from a selected known-object entry using relative navigation data.
- [x] `GAME-013` — render confirmed entries on a coordinate-free north-up session knowledge map.
- [x] `GAME-014` — retain executed expedition tracks and actually travelled corridors on the session knowledge map.
- [x] `GAME-015` — reveal a 300 m player-visibility corridor around travelled tracks as session fog of war.
- [x] `GAME-016` — confirm an authoritatively reached city as a relative personal-map landmark.
- [x] `CITY-001` — deterministic finite food/water stocks for every seeded city.
- [x] `CITY-002` — aggregate NPC population consumes city stocks from authoritative world time.
- [x] `CITY-003` — first shortage deterministically reduces population and later consumption.
- [x] `GAME-017` — execute `RETURN_TO_ORIGIN | CONTINUE` when food or water reaches 50% during uninterrupted movement.
- [x] `GAME-018` — compose the 50% emergency boundary with discovery-STOP idle consumption and depart from the exact stop coordinate.
- [x] `GAME-019` — establish the first detected-danger boundary and its ordering relative to contact before adding `AVOID | CONTINUE` route replanning.
- [x] `GAME-020` — execute `AVOID | CONTINUE` at that warning boundary and keep the avoidance geometry outside the 500 m contact radius.
- [x] `GAME-021` — compose the warning and danger doctrine with a scheduled discovery STOP, preserving exact world/route time and first-boundary priority.
- [x] `GAME-022` — select the first danger warning across several patrols with stable time/identity ordering before attempting multi-patrol avoidance clearance.
- [ ] `GAME-023` — execute moving danger doctrine for the selected warning and validate every accepted AVOID continuation against all patrols.
