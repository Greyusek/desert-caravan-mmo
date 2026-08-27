# Work handoff

Updated: 27 August 2026

This is the short operational recovery point for the autonomous MAIN3 series.
Repository history and checkpoint documents contain the full record.

## Current autonomous block

MVP-1 «Living Path» is in progress. Checkpoint 45 / LIVING-003 / version
`0.0.45` adds deterministic physical NPC tracks with coordinate-free clues.

## Completed

- NPC travel creates authoritative track marks every 500 m only along the
  prefix physically executed by authoritative world time.
- Marks are distance-anchored, so advancing time appends a deterministic suffix
  without rewriting existing world history.
- Server-side marks retain their world position, source and passage time.
- Player-facing clues expose only an opaque track identity, observation time,
  eight-way travel direction and coarse `fresh | recent | old | weathered` age.
- Player clues contain no coordinate, exact passage time or source-caravan ID.

## Last known good commit

- `83d5b99ed67c2d4a097c324f1d47cea8b46a7621` — LIVING-003 functional commit;
  tree `3c8906b960bf08a7bf3a863c9955279bd6f5d233`.
- Branch: `feature/living-003-coordinate-free-tracks`; PR/merge status is
  updated after the GitHub quality gate.

## Verification

- TypeScript build: PASS for `sim-core` and `debug-map`.
- Full `npm run verify:local`: `388/388` PASS, zero failures, compiled
  Checkpoint 45 demo PASS.
- Targeted LIVING-001/002/003 suite: `16/16` PASS.
- `git diff --check`: PASS.

## Current task

Complete the PR/CI/merge cycle for Checkpoint 45, then continue immediately to
LIVING-004.

## Next action

`LIVING-004`: add minimal deterministic pursuit/evasion over the existing
route model. Reuse authoritative route, speed, world time and encounter
primitives; do not create tactical combat or a second movement system.

## Scope boundary

No trading economy, production chains, tactical combat, PvP, multiplayer,
database, full physical-map inventory, Magic/System 256 or neural agents.

## Resume instruction

Read `AGENTS.md`, `docs/DEVELOPMENT_WORKFLOW.md`, `TODO.md`, the MVP-1 section of
`docs/ROADMAP.md`, `docs/MVP_SPEC.md`, this file and the latest checkpoint only.
Verify the branch/PR/main state, finish the current quality gate if necessary,
then continue with the exact next action above.
