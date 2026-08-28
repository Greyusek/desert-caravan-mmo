# Work handoff

Updated: 28 August 2026

This is the short operational recovery point for the autonomous Stage 4 series.
Repository history and checkpoint documents contain the full record.

## Current autonomous block

MVP-1 «Living Path» and Trading Prototype Stage 3 remain complete at Checkpoint
70 / version `0.0.70`. The user has explicitly opened Stage 4. Tactical Combat
Prototype is decomposed into `TACTICAL-001` through `TACTICAL-007`, `UI-008` and
the final `COMBAT-001` proof. Stage 4.5 Player-facing UI Vertical Slice is
recorded in ROADMAP but remains gated until Stage 4 closes; its first action is
the separate `UI-VERTICAL-DECOMP` docs-only PR. Multiplayer and later stages
remain gated.

## Completed

- Checkpoints 43–53 retain independent regression coverage for the complete
  Living Path, persistent creatures, physical knowledge and earned history.
- Checkpoints 54–62 retain the complete seven-good Trading Prototype, physical
  player/NPC routes, market effects, information valuation and UI projection.
- TACTICAL-001–003 provide a seeded battlefield, physical source-linked units
  and deterministic validated MOVE/ATTACK/WAIT commands through completion.
- TACTICAL-004–006 make existing cargo physical, resolve retreat and apply
  health, permanent casualties and conserved cargo exactly once to world state.
- TACTICAL-007 makes tactical combat the default resolver for an existing
  authoritative PvE monster contact. It validates the contact against the same
  persistent creature, preserves current source health, executes tactical
  commands and returns winner/casualties/cargo to the global state.
- The unchanged GAME-005/006 Power stub is available through the new resolver
  only when callers explicitly select `LEGACY_POWER`.
- UI-008 projects that same resolved tactical snapshot in the dependency-free
  debug map: cells/zones, source-linked units, baggage, commands/events,
  casualties, winner, conserved cargo and exactly-once world return. Browser
  rendering contains no combat, cargo or world-return solver.

## Last known good main

- `306c18676f708ff70ff0153f5314428423a58713` — merge of PR #86.
- PR #86 functional head `cde249f0e1354664b565172abce1cacc6ee853ef`
  passed GitHub `CI / verify` run #185.

## Verification

- TypeScript build: PASS for `sim-core` and `debug-map`.
- Full `npm run verify:local`: `582/582` PASS, zero failures, compiled
  Checkpoint 70 demo PASS.
- Dedicated UI-008 snapshot/browser-boundary additions: `8/8` PASS.
- Debug-map plus tooling group: `142/142` PASS.
- Local debug server asset/content-type smoke test: PASS.
- `git diff --check`: PASS.

## Current task

Checkpoint 70 / `UI-008` is complete. The existing debug map now projects the
same tactical contact, physical state, command/event history, cargo outcome and
world return without browser simulation rules. No Stage 4 task is active. Stage
4.5 remains gated.

## Next action

From updated `main`, start `COMBAT-001`: add one deterministic seeded end-to-end
proof from a real global PvE contact through tactical battle and persistent
world consequences into continued global simulation, then close Stage 4. Do
not start Stage 4.5 in the same functional PR.

## Scope boundary

Tactical Combat Prototype only. No real-player PvP, multiplayer, production
database, player settlements, full Magic/System 256, neural agents, broad
production-chain simulation, Stage 4.5 implementation or Stage 5 work.

## Resume instruction

Read `AGENTS.md`, `docs/DEVELOPMENT_WORKFLOW.md`, `TODO.md`, this file and
`docs/CHECKPOINT_70.md`. Verify repository/PR/CI state. Continue with the first
unchecked Stage 4 queue item. Stop after `COMBAT-001`; Stage 5 requires an
explicit user command.
