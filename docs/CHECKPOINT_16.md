# Checkpoint 16 — GAME-004: moving monster contact

Version: `0.0.16`

## Goal

Connect the existing continuous-time SIM-008 encounter solver to the live expedition lifecycle. A finite caravan route and a cyclic wandering-monster patrol must now produce one deterministic first-contact boundary that stops executable movement and appears in the expedition journal, without inventing tactical combat.

## Implemented

- public `ExpeditionMonsterContact` and `findFirstExpeditionMonsterContact` API in `sim-core`;
- composition of a finite caravan route with an absolute-time cyclic WORLD-004 patrol through SIM-008;
- authoritative monster ID, power, interaction radius, absolute time, route time, patrol time, separation and both exact coordinates preserved in the contact record;
- first moving contact added as a non-terminal expedition pause at the exact 500 m interaction-radius entry;
- deterministic precedence with existing boundaries: an earlier STOP remains first, while fatal depletion wins both earlier and exact-time contact ties;
- caravan movement, supply projection and executable timeline freeze at the selected contact boundary;
- dedicated GAME-004 panel showing forecast, executed contact or a contact made impossible by an earlier boundary;
- `monster-contact` journal event with monster power, separation, segment and route distance;
- DEV-only contact marker on the world map;
- `DEV: маршрут на перехват` QA preset that chooses the nearest generated city and synchronizes arrival at the patrol start with a whole number of monster cycles.

## Running locally

```bash
npm run debug-map
```

Open `http://127.0.0.1:4173`:

1. Press **DEV: маршрут на перехват**. The preset chooses the nearest city and builds a route with a predicted contact.
2. Press **DEV: к исходу**. The caravan and patrol meet at the first 500 m boundary, the expedition pauses and the contact becomes the current journal event.
3. Reduce food or water enough to deplete before the predicted encounter. The contact panel reports that interception is no longer executable and the expedition still fails at the earlier depletion boundary.
4. Press **Повторить экспедицию** to replay the same deterministic seed and route from T+0.

## Automated verification

Five `sim-core` tests cover metadata, absolute patrol time for a delayed departure, no-contact routes, reproducibility and validation. Five debug-map tests cover the guaranteed QA intercept, non-terminal contact pause and journal entry, earlier fatal depletion, exact contact/depletion tie priority and an earlier discovery STOP. Repository verification contains 155 tests: 150 simulation/UI tests plus 5 tooling regressions.

## Scope boundary

GAME-004 does not resolve combat, remove a defeated monster, resume movement after contact, calculate escape probability, persist the encounter or expose exact coordinates in a production player UI. The interaction-radius contact is server truth; the dedicated screen remains a DEV overlay.

## Next checkpoint

`GAME-005` — add the transparent pre-combat Power stub from MVP_SPEC (`Player Power 100` against monster Power 90/110) and resolve the first contact without building tactical combat.
