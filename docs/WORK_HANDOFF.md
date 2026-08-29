# Work handoff

Updated: 29 August 2026

This is the short operational recovery point after the Stage 4 series.
Repository history and checkpoint documents contain the full record.

## Current autonomous block

MVP-1 «Living Path», Trading Prototype Stage 3 and Tactical Combat Prototype
Stage 4 are complete at Checkpoint 71 / version `0.0.71`. `TACTICAL-001` through
`TACTICAL-007`, `UI-008` and the final `COMBAT-001` proof are closed. Stage 4.5
Player-facing UI Vertical Slice is now unblocked, but its first action remains
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
- COMBAT-001 owns the final shared server-truth composition: an active physical
  route creates the contact, tactical resolution applies source health, deaths
  and cargo once, and the same journey resumes 300 m then arrives with every
  consequence intact. UI-008 now projects this scenario directly.

## Last known good main

- `27cd80ee82adb492d088f03194ade3aea475d40d` — merge of PR #87 / UI-008,
  immediately before the COMBAT-001 feature branch.

## Verification

- TypeScript build: PASS for `sim-core` and `debug-map`.
- Full `npm run verify:local`: `594/594` PASS, zero failures, compiled
  Checkpoint 71 demo PASS.
- Dedicated COMBAT-001 server-truth/UI additions: `12/12` PASS.
- Debug-map, tooling and COMBAT-001 group: `154/154` PASS.
- Local debug server asset/content-type smoke test: PASS.
- `git diff --check`: PASS.

## Current task

Checkpoint 71 / `COMBAT-001` and Stage 4 are complete. No functional Stage 4
task remains active. Stage 4.5 implementation has not started.

## Next action

After this checkpoint is accepted, start the separate docs-only
`UI-VERTICAL-DECOMP` PR required by the supplied Stage 4.5 prompt. Decompose the
Player-facing UI Vertical Slice before any implementation and do not mix code
changes into that PR.

## Scope boundary

The completed branch contains Tactical Combat Prototype only. The next PR is
documentation-only decomposition. No real-player PvP, multiplayer, production
database, player settlements, full Magic/System 256, neural agents, broad
production-chain simulation or Stage 5 work.

## Resume instruction

Read `AGENTS.md`, `docs/DEVELOPMENT_WORKFLOW.md`, the supplied Stage 4.5 prompt,
`TODO.md`, this file and `docs/CHECKPOINT_71.md`. Verify the COMBAT-001 PR is
merged and accepted, then create only the `UI-VERTICAL-DECOMP` docs-only PR.
