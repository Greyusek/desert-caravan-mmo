# Work handoff

Updated: 27 August 2026

This is the short operational recovery point for the autonomous MAIN3 series.
Repository history and checkpoint documents contain the full record.

## Current autonomous block

MVP-1 «Living Path» is in progress. Checkpoint 48 / KNOWLEDGE-001 / version
`0.0.48` adds coordinate-free provenance-aware world evidence knowledge.

## Completed

- Track and remains observations enter a dedicated session evidence state.
- Every knowledge entry stores first/latest observation time, confidence and a
  complete ordered provenance list.
- Direct track clues are `probable`; direct remains inspection is `confirmed`.
- Every accepted observation appends exactly one coordinate-free journal event;
  repeated renders at the same time are idempotent.
- Later observations preserve provenance and update current facts, including
  remains becoming ruined/empty.
- Serialized player state contains no coordinates, destruction time or source
  caravan identity.

## Last known good commit

- `54403ca2af49b1daeb18fded2a46b29834d29523` — KNOWLEDGE-001 functional commit;
  tree `82641de5c9c4dffccfa1177f1764a5bc8083ecf7`.
- Branch: `feature/knowledge-001-evidence-ledger`; PR/merge status is
  updated after the GitHub quality gate.

## Verification

- TypeScript build: PASS for `sim-core` and `debug-map`.
- Full `npm run verify:local`: `409/409` PASS, zero failures, compiled
  Checkpoint 48 demo PASS.
- Targeted track/remains/evidence suite: `20/20` PASS.
- `git diff --check`: PASS.

## Current task

Complete the PR/CI/merge cycle for Checkpoint 48, then continue immediately to
LIBRARY-001.

## Next action

`LIBRARY-001`: add local city archives and physical knowledge deposit/copy
transfer without global synchronization. Preserve provenance/confidence and use
only a minimal deterministic value stub instead of Trading Prototype economics.

## Scope boundary

No trading economy, production chains, tactical combat, PvP, multiplayer,
database, full physical-map inventory, Magic/System 256 or neural agents.

## Resume instruction

Read `AGENTS.md`, `docs/DEVELOPMENT_WORKFLOW.md`, `TODO.md`, the MVP-1 section of
`docs/ROADMAP.md`, `docs/MVP_SPEC.md`, this file and the latest checkpoint only.
Verify the branch/PR/main state, finish the current quality gate if necessary,
then continue with the exact next action above.
