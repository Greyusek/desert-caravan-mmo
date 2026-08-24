# Checkpoint 25 — GAME-011: in-session discovery ledger

Version: `0.0.25`

## Goal

Close the memory gap between repeated expeditions: once the caravan confirms a
static object, the current browser session must retain that player knowledge and
recognize the same object on a later expedition without pretending that a
database, account save or production physical map already exists.

## Implemented

- a deterministic `PlayerDiscoveryLedger` value in `sim-core`, bound to one
  world seed and independent from UI, storage, database and networking code;
- confirmed direct-observation provenance and confidence for every entry;
- first and latest observation metadata: expedition number, origin city, rumor,
  elapsed time, route segment and route distance;
- no absolute world coordinate in the player-facing ledger value;
- immutable first-observation records plus an observation count for later
  expeditions;
- idempotent recording: repeated browser renders cannot duplicate one object's
  observation inside the same expedition;
- an explicit browser expedition counter advanced by **Повторить экспедицию**;
- recognition of knowledge acquired in an earlier expedition;
- `known-and-continuing` discovery execution: a known object can be observed
  again, but does not execute a second `STOP` or doctrine-decision event;
- a distinct **known target observed** expedition-log event;
- a visible session knowledge panel with provenance, confidence, first/latest
  expedition and observation count;
- seed changes, page reload and **Очистить сессионные знания** start an empty
  ledger, while ordinary route edits keep compatible knowledge.

## Running locally

```bash
npm run debug-map
```

Open `http://127.0.0.1:4173`.

1. Keep `STOP` selected and press **DEV: маршрут к цели**.
2. Press **DEV: к исходу**. Confirm the first discovery stops the caravan and
   creates one confirmed entry in **Журнал знаний игрока**.
3. Use the wait-and-resume action, then advance to the route outcome.
4. Press **Повторить экспедицию**. The panel must show **Экспедиция #2** while
   preserving the mine learned in expedition #1.
5. Keep `STOP`, run the same route and advance to its outcome. The mine must be
   reported as already known, the route must not stop there, the event log must
   contain **Подтверждён известный рудник**, and the observation count must be 2.
6. Change the seed or press **Очистить сессионные знания**. The incompatible
   session ledger must become empty.

The shorter first pass is available with `MARK_AND_CONTINUE`: discover the mine,
advance to the route end, repeat the expedition, restore `STOP`, then execute the
same route.

## Automated verification

Five `sim-core` regressions cover coordinate-free confirmed provenance,
idempotent render-safe recording, later-expedition re-observation, knowledge
visibility by expedition and invalid chronological input. Two debug-map
regressions cover pre-entry pending state and known-target continuation without a
second STOP or doctrine event. Together with the unchanged suite, repository
verification contains 245 tests: 240 simulation/UI tests plus 5 tooling
regressions.

## Scope boundary

GAME-011 stores knowledge only in JavaScript memory for the current browser tab.
It does not use `localStorage`, IndexedDB, a server or a database; survive page
reload; create an account-owned item; transfer or sell knowledge; model physical
map loss; reveal absolute coordinates; navigate to a selected entry; or implement
the production personal map, fog of war, city libraries and information economy.

## Next checkpoint

`GAME-012` — select a known ledger entry and prepare a return expedition from
its original city using relative navigation data, still without database
persistence or a production physical-map implementation.
