# Checkpoint 15 — GAME-003: expedition outcomes

Version: `0.0.15`

## Goal

Turn the existing movement, supply and discovery-doctrine systems into one authoritative expedition lifecycle. A run must now remain active, pause at a STOP decision, complete on arrival or fail at fatal depletion instead of letting UI time continue beyond the real outcome.

## Implemented

- public `ExpeditionOutcomeStatus` with exact states `in-progress`, `paused`, `completed` and `failed`;
- pure `evaluateExpeditionOutcome` in `sim-core`, driven by the resolved route, initial supplies, moving consumption profile, selected time and optional doctrine pause time;
- earliest-boundary resolution across STOP, first fatal food/water depletion and route arrival;
- SIM-006 exact-zero rule preserved: fatal depletion wins a tie with arrival or STOP;
- terminal movement time, route distance, segment and coordinate derived from existing SIM-005/SIM-006 truth;
- route marker, supply projection and executable event timeline frozen at the authoritative boundary;
- impossible future events removed, including arrival after death and doctrine actions after an earlier depletion;
- STOP preserved as a non-terminal pause rather than being misreported as success or death;
- a dedicated debug-map outcome panel with current state, boundary cause and position;
- `DEV: к исходу` jumps to the first outcome; after completion or failure the same control repeats the current seed, route and supplies from T+0.

## Running locally

```bash
npm run debug-map
```

Open `http://127.0.0.1:4173` and use the outcome panel:

1. With the default safe supplies, press `DEV: к исходу` to reach a completed expedition, then press the repeat control to return the same run to T+0.
2. Open **Настроить провизию и расход**, set a deliberately insufficient starting stock, apply it and press `DEV: к исходу`; movement and the timeline stop at fatal depletion and no arrival is reported.
3. Use the rumor's DEV route with `STOP`; discovery pauses the expedition before later route outcomes and remains non-terminal.

## Automated verification

Eight `sim-core` tests cover active travel, later completion, early fatal depletion, exact depletion at arrival, STOP precedence, exact STOP/depletion ties, zero consumption and validation. Five debug-map tests cover successful arrival, route freezing on death, exact-time failure ordering, non-terminal STOP and suppression of impossible post-death doctrine decisions. Repository verification contains 145 tests: 140 simulation/UI tests plus 5 tooling regressions.

## Scope boundary

GAME-003 does not award resources, persist expedition history, create wrecks, resume a STOP pause, simulate post-stop idle consumption, require arrival at a city or resolve monster encounters. The repeat control resets only the current developer scenario; a production run/save loop remains outside this checkpoint.

## Next checkpoint

`GAME-004` — feed the existing SIM-008 moving caravan/monster encounter into the active expedition and deterministic timeline, initially as an authoritative contact event without combat resolution.
