# Work handoff

Updated: 27 August 2026

This is the short operational recovery point for the autonomous MAIN3 series.
Repository history and checkpoint documents contain the full record.

## Current autonomous block

MVP-1 «Living Path» is in progress. Checkpoint 49 / LIBRARY-001 / version
`0.0.49` adds local city archives and physical knowledge transfer.

## Completed

- Traveller or library knowledge is copied into an explicit physical bundle.
- Depositing changes only the targeted city archive; unrelated city archives
  remain byte-for-byte unchanged until a carrier delivers a bundle.
- Archive merge retains all unique provenance, strongest confidence and latest
  deterministic facts.
- Re-depositing the same physical bundle is idempotent, and copying knowledge
  out never removes the local archive original.
- `informationValueUnits` equals novel provenance count as an explicit
  temporary exchange stub, not money or a market price.
- Bundles and archives remain coordinate-free.

## Last known good commit

- `0ec287a24c433f5016a161075d9cb5a8074ed2ac` — LIBRARY-001 functional commit;
  tree `a73127dcda3e389bf9dc467dd7c0ef7de2a762db`.
- Branch: `feature/library-001-local-archives`; PR/merge status is
  updated after the GitHub quality gate.

## Verification

- TypeScript build: PASS for `sim-core` and `debug-map`.
- Full `npm run verify:local`: `417/417` PASS, zero failures, compiled
  Checkpoint 49 demo PASS.
- Targeted knowledge/library suite: `15/15` PASS.
- `git diff --check`: PASS.

## Current task

Complete the PR/CI/merge cycle for Checkpoint 49, then continue immediately to
LIBRARY-002.

## Next action

`LIBRARY-002`: keep a fallen-city library as a discoverable world object and
degrade archive information deterministically over world time. Preserve physical
locality and do not add production persistence or global synchronization.

## Scope boundary

No trading economy, production chains, tactical combat, PvP, multiplayer,
database, full physical-map inventory, Magic/System 256 or neural agents.

## Resume instruction

Read `AGENTS.md`, `docs/DEVELOPMENT_WORKFLOW.md`, `TODO.md`, the MVP-1 section of
`docs/ROADMAP.md`, `docs/MVP_SPEC.md`, this file and the latest checkpoint only.
Verify the branch/PR/main state, finish the current quality gate if necessary,
then continue with the exact next action above.
