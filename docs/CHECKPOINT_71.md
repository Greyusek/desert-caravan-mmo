# Checkpoint 71 — COMBAT-001 end-to-end tactical combat

Version: `0.0.71`

## Implemented

- Adds one deterministic `createTacticalCombatScenario(seed)` server-truth
  composition in `sim-core`.
- Starts a cargo-bearing caravan on a real 2 km city-to-city trade journey and
  creates its first continuous-time contact with a closed monster patrol at the
  physical 100 m interaction boundary.
- Routes that contact through the existing TACTICAL-007 default path, places
  two persistent caravan members, one persistent creature and the caravan's
  existing ore/medicine stacks on the battlefield, then executes 17 validated
  commands to completion.
- Applies the guard's surviving health, the skirmisher and creature deaths, and
  conserved physical cargo exactly once to authoritative world state.
- Resumes the same active global journey at the contact boundary, proves 300 m
  of later movement, then records authoritative destination arrival while all
  combat consequences and the battle application identity remain intact.
- Makes UI-008 project this shared scenario and its continued-route/arrival
  result instead of assembling a separate tactical composition in debug code.
- Leaves the explicit `LEGACY_POWER` compatibility path and all earlier combat,
  cargo, retreat, trading and global-simulation APIs unchanged.

## Verification

- Dedicated COMBAT-001 core/UI additions: `12/12` PASS.
- Debug-map, tooling and COMBAT-001 group: `154/154` PASS.
- Full `npm run verify:local`: `594/594` PASS.
- `git diff --check`: PASS.

## Manual review

See [`MANUAL_TEST_CHECKPOINT_71.md`](MANUAL_TEST_CHECKPOINT_71.md) for the CLI,
browser projection, seed replay and global-continuation checks.

## Stage result

Stage 4 — Tactical Combat Prototype is complete. Stage 4.5 remains a separate
gated series whose first permitted action is the `UI-VERTICAL-DECOMP` docs-only
PR; no Player UI implementation is included in this checkpoint.
