# Changelog

## 0.0.41 — Checkpoint 41

- Added `GAME-024`: scheduled discovery `STOP` now executes `AVOID | CONTINUE` from the first stable warning across the complete patrol set.
- Preserved exact time domains: world time advances through the wait while route time remains pinned to the STOP coordinate.
- Kept `CONTINUE` non-mutating with the original route, complete scheduled wait and stable first contact unchanged.
- Made `AVOID` cancel only the unelapsed wait and validate the real-time departure continuation continuously against every patrol.
- Preserved contact and caller-supplied earlier-boundary priority at the same or an earlier expedition instant.
- Integrated all-patrol STOP clearance and stable contact identity into the debug-map execution, journal and contact focus.
- Added ten GAME-024 regressions; repository verification now runs 366 tests.

## 0.0.40 — Checkpoint 40

- Added `GAME-023`: moving `AVOID | CONTINUE` now executes from the first authoritative warning selected across the complete patrol set.
- Preserved `CONTINUE` as a non-mutating decision with the original route and stable first contact identity unchanged.
- Reused the continuous contact solver against every patrol for every deterministic AVOID candidate; a candidate is accepted only when the complete timed route remains contact-free from all of them.
- Preserved contact priority when any patrol reaches contact at the warning instant or earlier, and retained the original route when no configured detour is safe.
- Made route choice independent of patrol input order and patrol-cycle delay while preserving stable raw-ID arbitration.
- Integrated moving all-patrol clearance into the debug-map intercept flow while leaving scheduled-STOP doctrine explicitly tied to the selected QA patrol for the next slice.
- Added ten GAME-023 regressions; repository verification now runs 356 tests.

## 0.0.39 — Checkpoint 39

- Added `GAME-022`: moving expeditions and scheduled discovery `STOP`s now select the first authoritative 1000 m warning across several patrols.
- Reused the existing continuous single-patrol solvers for every candidate, then selected the earliest absolute world time without weakening their contact ordering or time-domain records.
- Made candidates inside the encounter tolerance deterministic through raw monster-ID ordering, independent of patrol array order and host locale.
- Rejected duplicate monster IDs so identity ties cannot silently fall back to caller ordering; empty sets remain valid and return no warning.
- Exposed the multi-patrol winner, exact time and moving/STOP activity in a separate debug-map result while keeping selected-patrol AVOID execution explicitly outside this detection-only slice.
- Added ten GAME-022 regressions; repository verification now runs 346 tests.

## 0.0.38 — Checkpoint 38

- Added `GAME-021`: the selected patrol can now raise the authoritative 1000 m warning while the caravan is stationary during a scheduled discovery `STOP`.
- Preserved exact time domains: world time advances through the wait while route time remains pinned to the exact STOP coordinate.
- Kept `CONTINUE` non-mutating with the original route object, complete scheduled wait and later contact unchanged.
- Made `AVOID` cancel only the unelapsed wait, depart from the exact STOP coordinate and validate the post-decision continuation against the patrol at its real world time.
- Preserved contact and caller-supplied earlier-boundary priority for any event at or before the warning; unavailable detours keep the original route and wait.
- Integrated the effective stop duration, route, outcome and `danger-avoidance` resume provenance into the debug map, journal and a dedicated three-step STOP scenario.
- Added eleven GAME-021 regressions; repository verification now runs 336 tests.

## 0.0.37 — Checkpoint 37

- Added `GAME-020`: the first 1000 m moving-patrol warning now executes the explicit `AVOID | CONTINUE` doctrine.
- Kept `CONTINUE` strictly non-mutating by returning the original `RoutePlan` object and preserving its previously forecast contact.
- Made `AVOID` preserve every fully executed command plus the exact partial command to the warning, insert one deterministic left/right waypoint, rejoin the interrupted segment and preserve the later command suffix.
- Selected the shortest safe side on the nearest configured clearance ring and accepted it only when the continuous time-aware solver proved the complete resolved route never entered the selected patrol's 500 m contact radius.
- Preserved contact priority for a warning/contact tie, explicit no-warning and unavailable-detour states, deterministic delayed world time and avoidance of a warning-only near pass.
- Added danger-doctrine controls, a same-time journal decision and a three-step DEV intercept flow; AVOID removes the later contact from authoritative outcome/log execution while CONTINUE leaves it intact.
- Added twelve GAME-020 regressions; repository verification now runs 325 tests.

## 0.0.36 — Checkpoint 36

- Added `GAME-019`: an uninterrupted moving expedition now receives its first deterministic server-truth danger warning at 1000 m from a wandering patrol.
- Reused the established GAME-006 safe separation (`2 × 500 m`) as the technical warning boundary while keeping optical visibility 300 m and concealed detection 150 m as separate future sensor layers.
- Required the warning radius to be strictly larger than the monster's interaction radius; a route starting already inside contact records an exact tie with contact priority.
- Preserved absolute world time, expedition route time, patrol time, exact coordinates and the planned lead to a later contact in the warning record.
- Added a `danger-detected` journal event, a DEV world marker and concentric 1000/500 m circles in the contact inset without implementing `AVOID` geometry or changing route execution.
- Added ten GAME-019 regressions; repository verification now runs 313 tests.

## 0.0.35 — Checkpoint 35

- Added `GAME-018`: the original-expedition 50% food/water boundary now remains active during a scheduled discovery `STOP` and uses the idle consumption profile.
- Made `RETURN_TO_ORIGIN` cancel only the unelapsed part of the stop, preserve the exact discovery coordinate and replace the future route with one direct origin leg.
- Kept `CONTINUE` deterministic and non-mutating: it records the same idle decision while preserving the complete wait and original route.
- Preserved boundary priority: a route-changing stationary monster contact or defeat at the same or an earlier world time blocks the later emergency action; weak contacts do not.
- Added explicit world-time/route-time fields, effective stop duration, `supply-emergency` resume provenance and moving/idle labels to the DEV map and event log.
- Added a dedicated three-click `DEV: возврат из STOP` scenario alongside the existing moving-return preset.
- Added nine GAME-018 regressions; repository verification now runs 303 tests.

## 0.0.34 — Checkpoint 34

- Added `GAME-017`: food or water reaching the explicit 50% emergency threshold now invokes `RETURN_TO_ORIGIN | CONTINUE` during uninterrupted movement.
- Preserved the executed outbound prefix and replaced only future commands with one shortest great-circle return leg when return is selected.
- Kept the existing 25% supply warning separate from the earlier safety decision, so the default return remains physically achievable at unchanged speed and consumption.
- Made re-entry into the expedition's origin-city radius the authoritative successful outcome of an emergency return.
- Added the doctrine choice, deterministic three-click DEV scenario and a dedicated decision event to the debug map and journal.
- Kept discovery-STOP idle composition, automatic buying, money, city stock transfer, persistence and database work outside this checkpoint.
- Added ten GAME-017 regressions; repository verification now runs 294 tests.

## 0.0.33 — Checkpoint 33

- Added `CITY-003`: the first food or water shortage now reduces aggregate city population deterministically from authoritative world time.
- Set an explicit provisional loss rate of 1% of the remaining population per game day, compounded continuously from the exact depletion boundary.
- Integrated declining population into later consumption so a shrinking city uses any surviving stock more slowly.
- Preserved the full population before and exactly at first depletion, and retained a minimum of one inhabitant until a later abandonment rule exists.
- Exposed current/initial population, losses, shortage duration and the provisional rate in DEV city details and the checkpoint demo.
- Kept replenishment, migration, trade, production chains, prices and persistence outside this checkpoint.
- Added six CITY-003 regressions; repository verification now runs 284 tests.

## 0.0.32 — Checkpoint 32

- Added `CITY-002`: every seeded city now has a deterministic aggregate NPC population of 100–500 inhabitants.
- Added a pure authoritative world-time projection for aggregate food and water consumption.
- Set explicit provisional rates of 1 food and 2 water units per NPC per game day.
- Calculated exact first-depletion time and cause while clamping later stocks at zero.
- Exposed current stocks, initial stocks, population and depletion status in DEV city details.
- Kept population loss, trading, production and persistence outside this checkpoint.
- Added eight CITY-002 regressions; repository verification now runs 278 tests.

## 0.0.31 — Checkpoint 31

- Added `CITY-001`: every seeded city now has finite food and water stocks.
- Generated safe-integer stocks in the inclusive 10,000–50,000 unit range.
- Isolated every city's stock PRNG stream from city positions, other cities, static objects and wandering monsters.
- Exposed city stocks in the DEV map detail panel without adding trading, purchases, NPC consumption or persistence.
- Added three CITY-001 regressions; repository verification now runs 270 tests.

## 0.0.30 — Checkpoint 30

- Added `GAME-016`: a city enters personal session knowledge only after the expedition completes at its authoritative arrival boundary.
- Stored only a confirmed relative bearing/distance fix from the expedition's origin city; no latitude or longitude enters the player ledger or knowledge-map snapshot.
- Kept planned routes, interrupted journeys, depletion and failed arrivals from revealing destination cities.
- Rendered reached cities as named landmarks on the matching local origin-city chart without joining independent charts through server truth.
- Made repeated browser renders idempotent for the same expedition and city.
- Added GAME-016 regressions for coordinate-free storage and local-chart projection.

## Unreleased — Design consolidation

- Adopted autonomous «Искины» as a long-term design pillar without moving it ahead of the functional checkpoint sequence.
- Canonized `AI decides; simulation resolves`, subject-limited perception, validated Action API boundaries and model/provider independence.
- Added NPC / AI Player, City AI, Species AI, separated memory/learning layers and Cognitive LOD to GDD v0.5.
- Added gated `AI-001..AI-005` experiments to the roadmap without introducing neural dependencies into MVP-0.
- Integrated the previously unmerged world-bible history into the repository without changing runtime code or package version.
- Added canonical chapters for world history, magic, bestiary, ecology, System 256 and presentation direction.
- Published GDD v0.4 as the cross-document entry point and preserved GDD v0.2/v0.3 as archives.
- Resolved the old System 256 wording: the architecture is canonical, while numeric coefficients and implementation remain deferred.
- Added information provenance, permanent simulated creatures and emergent legendary monsters to the long-term design contract.

## 0.0.29 — Checkpoint 29

- Added `GAME-015`: actually travelled tracks now cut a physically scaled 300 m visibility radius through the session map's unexplored field.
- Reused the accepted `DEFAULT_VISIBLE_TARGET_RADIUS_METERS` simulation constant instead of introducing a presentation-only width.
- Converted the former fixed-width decorative corridor into a scale-dependent diameter derived from map meters per pixel.
- Added an SVG fog mask that unions all travelled corridors for the selected origin city while keeping future route legs absent.
- Kept confirmed knowledge markers and expedition center lines readable above the fog layer without joining independent city charts.
- Added three GAME-015 scaling regressions; repository verification now runs 265 tests.
- Recorded the acceptance finding about reached cities as `GAME-016`, the next checkpoint: confirm an arrived city as a relative personal-map landmark without exposing its server coordinates.

## 0.0.28 — Checkpoint 28

- Added `GAME-014`: every expedition retains its actually travelled route prefix in coordinate-free session knowledge.
- Stored only normalized bearing/distance legs up to authoritative movement progress; untravelled future legs never enter the player ledger.
- Made repeated rendering idempotent and kept maximum reached progress when the DEV clock is moved backwards.
- Prevented later route edits from rewriting an already executed corridor and started a distinct expedition when replacing a route after movement.
- Drew prior corridors, current-expedition progress and exact travelled endpoints on the matching local city chart.
- Kept tracks from different origin cities separate and reset them together with the existing seed-bound session knowledge.
- Added eight GAME-014 regressions; repository verification now runs 262 tests.
- Designated `GAME-015`, a 300 m player-visibility fog corridor around actually travelled tracks, as the next checkpoint.

## 0.0.27 — Checkpoint 27

- Added `GAME-013`: confirmed session-ledger entries render on a player-facing coordinate-free north-up knowledge map.
- Derived every marker only from its immutable first-observation bearing and distance; the map snapshot contains no latitude or longitude.
- Kept discoveries from different origin cities on separate selectable local charts instead of joining them through hidden server coordinates.
- Added deterministic 1/2/5/10 chart scaling, cardinal grid, origin and object labels, relative bearings and distances.
- Kept return-route preparation connected to the matching map anchor while preserving GAME-011/012 re-observation behavior.
- Added four GAME-013 regressions; repository verification now runs 254 tests.
- Designated `GAME-014`, retaining executed expedition tracks and travelled corridors on the session map, as the next checkpoint.

## 0.0.26 — Checkpoint 26

- Added `GAME-012`: every confirmed discovery retains a normalized bearing and distance from its first-observation city without storing an absolute world coordinate.
- Added a pure known-object return-navigation API whose first personal observation remains the immutable route anchor after later re-observations.
- Converted a selected entry into one real route-editor leg plus three empty legs, preserving the existing four-segment UI contract.
- Added a per-entry action that starts the next expedition at T+0, selects the original city and fills the route directly from player knowledge.
- Added visible relative-navigation facts and prepared-route state to the session knowledge panel.
- Added five GAME-012 regressions; repository verification now runs 250 tests.
- Designated `GAME-013`, a player-facing north-up session knowledge map derived only from relative fixes, as the next checkpoint.

## 0.0.25 — Checkpoint 25

- Added `GAME-011`: a seed-bound in-session player discovery ledger shared by repeated expeditions in the current browser tab.
- Recorded confirmed direct-observation provenance, first/latest expedition context and observation counts without storing absolute world coordinates in the player-facing ledger.
- Made recording idempotent per object and expedition so repeated browser renders cannot invent duplicate observations.
- Added known-target execution: a later expedition reobserves the object, continues through an otherwise selected STOP and emits a distinct journal event without a second doctrine decision.
- Added a visible knowledge panel, expedition counter and explicit session reset; changing seed or reloading the page also starts an empty ledger.
- Added seven GAME-011 regressions; repository verification now runs 245 tests.
- Designated `GAME-012`, return-expedition preparation from a selected known-object entry using relative navigation data, as the next checkpoint.

## 0.0.24 — Checkpoint 24

- Added `GAME-010`: continuous cyclic-patrol contact with a stationary caravan during the discovery-STOP interval.
- Extended SIM-008 with a stationary route-motion mode while preserving absolute patrol world time and exact interaction-radius entry.
- Tagged every authoritative expedition contact as moving or idle and kept a contact exactly at scheduled resume in the moving phase.
- Preserved first-boundary ordering: earlier or exact-time idle depletion suppresses contact; weak patrol victory keeps the planned wait; failed FLEE and ACCEPT_FIGHT remain terminal at STOP.
- Made successful FLEE cancel the remaining wait, consume only the actual idle duration and resume the original route at the exact contact time.
- Added ordered stationary-contact/forced-resume journal events, STOP-aware contact presentation and a deterministic DEV patrol preset that requires no seed hunting.
- Added nine GAME-010 regressions; repository verification now runs 238 tests.
- Designated `GAME-011`, an in-session player discovery ledger across repeated expeditions, as the next checkpoint.

## 0.0.23 — Checkpoint 23

- Added `GAME-009`: an explicit discovery-STOP duration with separate expedition/world time and SIM-005 route time.
- Kept the caravan at the exact discovery coordinate while applying SIM-006 idle consumption, then resumed the unchanged route after the scheduled wait.
- Made food, water or simultaneous depletion during the stop fatal at its exact world time; depletion tied with resume wins and removes the impossible resume event.
- Shifted later milestones, arrival, route completion, supply warnings and post-resume moving contacts by the full idle duration while cyclic patrol world time continues uninterrupted.
- Added an editable stop-duration control plus live wait progress, idle rates, shifted journal facts and an idle-death state to the debug map.
- Added fifteen GAME-009 regressions; repository verification now runs 229 tests.
- Designated `GAME-010`, patrol contact with a stationary caravan during discovery STOP, as the next checkpoint.

## 0.0.18 — Checkpoint 18

- Added `GAME-006`: a public deterministic FLEE resolver driven by explicit caravan speed, monster speed, contact separation and safe separation.
- Made a strictly faster caravan escape a stronger patrol, calculate the exact time needed to open the safe gap and continue its original route.
- Made equal or lower flee speed a terminal expedition defeat at the authoritative contact boundary, without random rolls or tactical combat.
- Preserved first-boundary semantics: earlier STOP or fatal depletion suppresses FLEE, and fatal depletion still wins an exact-time tie.
- Added editable flee speed, patrol speed, flee outcome, route state and timeline metadata to the debug map; 6 km/h succeeds against the 5.4 km/h QA patrol while 5 km/h fails.
- Added nine GAME-006 regressions; repository verification now runs 173 tests.
- Designated `GAME-007`, authoritative arrival at a real destination city and completion of the first return loop, as the next checkpoint.

## 0.0.17 — Checkpoint 17

- Added `GAME-005`: a public deterministic Player Power 100 versus monster Power contact resolver with explicit route dispositions.
- Made Player Power 100 defeat Monster Power 90 automatically and continue the original route without an invented combat simulation.
- Added `FLEE | ACCEPT_FIGHT` doctrine for Monster Power 110: `FLEE` pauses for the next escape checkpoint, while `ACCEPT_FIGHT` is a terminal expedition defeat.
- Preserved first-boundary semantics with discovery STOP, fatal supply depletion and arrival; an earlier or exact-time fatal boundary still takes precedence over contact.
- Added two deterministic QA patrols, a monster selector, Power comparison, doctrine controls, result states and authoritative timeline metadata to the debug map.
- Added nine GAME-005 regressions; repository verification now runs 164 tests.
- Designated `GAME-006`, deterministic escape resolution after `FLEE` without tactical combat, as the next checkpoint.

## 0.0.16 — Checkpoint 16

- Added `GAME-004`: a public deterministic expedition/monster contact API that composes finite caravan movement with an absolute-time cyclic patrol through SIM-008.
- Made the first 500 m moving contact a non-terminal expedition pause that freezes movement, supply projection and executable future events.
- Preserved first-boundary rules: earlier STOP still wins, while fatal depletion wins earlier and exact-time contact ties.
- Added a dedicated contact forecast/state panel, a contact marker and a `monster-contact` timeline event with authoritative monster power and separation.
- Added a deterministic DEV intercept preset that chooses the nearest city and synchronizes the route with whole patrol cycles for reliable manual QA.
- Added ten GAME-004 regressions; repository verification now runs 155 tests.
- Designated `GAME-005`, transparent Player Power 100 versus monster Power 90/110 contact resolution without tactical combat, as the next checkpoint.

## 0.0.15 — Checkpoint 15

- Added `GAME-003`: a pure deterministic expedition outcome resolver with explicit `in-progress`, `paused`, `completed` and `failed` states.
- Resolved the first authoritative boundary among discovery-doctrine STOP, fatal food/water depletion and route arrival; fatal depletion wins exact-time ties to preserve the SIM-006 MVP rule.
- Capped movement, supplies and executable timeline events at the resolved boundary, preventing arrival or doctrine actions after an earlier death.
- Added a dedicated debug-map outcome panel with boundary cause and position plus a DEV control that jumps to the outcome and then repeats the same expedition from T+0.
- Preserved STOP as a non-terminal pause while arrival and fatal depletion become terminal success/failure states.
- Added thirteen GAME-003 regressions; repository verification now runs 145 tests.
- Designated `GAME-004`, connecting SIM-008 moving monster encounters to the live expedition and timeline without combat, as the next checkpoint.

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
