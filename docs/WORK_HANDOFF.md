# Work handoff

Updated: 27 August 2026

This is the short operational recovery point for the autonomous MAIN3 series.
Repository history and checkpoint documents contain the full record.

## Current autonomous block

MVP-1 «Living Path» is in progress. Checkpoint 47 / CONSEQUENCE-001 / version
`0.0.47` adds permanent degrading caravan remains with minimal loot.

## Completed

- NPC destruction creates a permanent authoritative object at the exact
  world-time-projected caravan position.
- A deterministic temporary stub generates small food, water and salvage loot
  without introducing a production inventory or economy.
- Integrity and naturally remaining loot degrade linearly to zero over seven
  game days; the ruined object itself remains permanently present.
- Recovery takes only currently available loot, records recovered totals and
  cannot duplicate resources on repeated calls.

## Last known good commit

- `bf236071831d83bc87c7c999bfaca10bf1684e63` — CONSEQUENCE-001 functional commit;
  tree `d37f225acc5752f6a265d94d99da38ad1d17d7fe`.
- Branch: `feature/consequence-001-caravan-remains`; PR/merge status is
  updated after the GitHub quality gate.

## Verification

- TypeScript build: PASS for `sim-core` and `debug-map`.
- Full `npm run verify:local`: `402/402` PASS, zero failures, compiled
  Checkpoint 47 demo PASS.
- Targeted LIVING-004 / CONSEQUENCE-001 suite: `14/14` PASS.
- `git diff --check`: PASS.

## Current task

Complete the PR/CI/merge cycle for Checkpoint 47, then continue immediately to
KNOWLEDGE-001.

## Next action

`KNOWLEDGE-001`: record track/remains observations in player knowledge and the
event journal with source, observation time and confidence. Preserve coordinate
secrecy and do not introduce persistent storage yet.

## Scope boundary

No trading economy, production chains, tactical combat, PvP, multiplayer,
database, full physical-map inventory, Magic/System 256 or neural agents.

## Resume instruction

Read `AGENTS.md`, `docs/DEVELOPMENT_WORKFLOW.md`, `TODO.md`, the MVP-1 section of
`docs/ROADMAP.md`, `docs/MVP_SPEC.md`, this file and the latest checkpoint only.
Verify the branch/PR/main state, finish the current quality gate if necessary,
then continue with the exact next action above.
