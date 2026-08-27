# Work handoff

Updated: 27 August 2026

This is the short operational recovery point for the autonomous MAIN3 series.
Repository history and checkpoint documents contain the full record.

## Current autonomous block

MVP-1 «Living Path» is in progress. Checkpoint 50 / LIBRARY-002 / version
`0.0.50` adds permanent degrading fallen-city libraries.

## Completed

- A city fall snapshots its local archive into a permanent world object at the
  exact authoritative city position.
- Information completeness declines continuously to zero over 30 game days;
  readability changes clear → fragmentary → illegible.
- Information becomes stale after seven days and obsolete at full loss;
  confirmed confidence downgrades below 50% completeness.
- Readable entries can leave only in an explicit physical carrier bundle.
- The fallen object remains discoverable after all entries become unrecoverable.
- Projection never mutates the original live/archive snapshot.

## Last known good commit

- `b7a4c982c5cf881b453906b50876e218b160a90b` — LIBRARY-002 functional commit;
  tree `ff541a7d020f87a71ccaff4f3f485fb007177bed`.
- Branch: `feature/library-002-fallen-archives`; PR/merge status is
  updated after the GitHub quality gate.

## Verification

- TypeScript build: PASS for `sim-core` and `debug-map`.
- Full `npm run verify:local`: `424/424` PASS, zero failures, compiled
  Checkpoint 50 demo PASS.
- Targeted live/fallen library suite: `15/15` PASS.
- `git diff --check`: PASS.

## Current task

Complete the PR/CI/merge cycle for Checkpoint 50, then continue immediately to
HISTORY-001.

## Next action

`HISTORY-001`: add rumor quality, persistent creature/population catch-up,
coordinate-free creature intelligence and earned legendary history as small
dependency-ordered slices without implementing full Magic/System 256.

## Scope boundary

No trading economy, production chains, tactical combat, PvP, multiplayer,
database, full physical-map inventory, Magic/System 256 or neural agents.

## Resume instruction

Read `AGENTS.md`, `docs/DEVELOPMENT_WORKFLOW.md`, `TODO.md`, the MVP-1 section of
`docs/ROADMAP.md`, `docs/MVP_SPEC.md`, this file and the latest checkpoint only.
Verify the branch/PR/main state, finish the current quality gate if necessary,
then continue with the exact next action above.
