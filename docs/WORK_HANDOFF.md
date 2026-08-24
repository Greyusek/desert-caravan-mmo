# Work handoff

Updated: 24 August 2026

This is the short operational recovery point for an autonomous Work series.
Replace stale details after every completed task; do not append a development
diary. Repository history and checkpoint documents contain the full record.

## Current autonomous block

MVP-0 doctrine and survival, transitioning from the completed GAME-018 supply
composition to the detected-danger prerequisite for `AVOID | CONTINUE`.

## Completed

- Checkpoint 35 / GAME-018 / version `0.0.35` composes the original-stock 50%
  boundary with discovery-STOP idle consumption.
- `RETURN_TO_ORIGIN` truncates only the unelapsed wait and departs from the
  exact stop coordinate; `CONTINUE` preserves the full stop and route.
- Earlier or tied route-changing stationary contacts and monster defeats keep
  priority, while the event log records idle supply decisions and
  `supply-emergency` resume provenance.
- A dedicated `DEV: возврат из STOP` preset, checkpoint document and nine new
  regressions are included.

## Last known good commit

- `98ac8c0c5d4b850c0247dc11ce8376e3e2ad8262` — remote functional commit for
  Checkpoint 35 / version `0.0.35`; tree
  `2d78b4396e80b712ac76698ab637cde9c9f361fb` exactly matches the locally
  verified feature tree.
- `62c3f05a6c378a941411d879ba2a4eb8202b7c87` — merged main immediately before
  Checkpoint 35 (DEVX-003 handoff checkpoint).

## Verification

- TypeScript build: PASS for `sim-core` and `debug-map`.
- Automated suite: `303/303` PASS, zero failures (`298` simulation/UI plus `5`
  tooling regressions).
- Compiled Checkpoint 35 demo: PASS; idle threshold at world `T=4 h`, effective
  wait `2/6 h`, exact 10 km return and origin at world `T=6 h`.
- Git tree equality and `git diff --check`: PASS.
- GitHub Actions remains the merge gate. If this file is read from `main`, the
  Checkpoint 35 PR passed that gate before merge.

## Current task

Checkpoint 35 is complete. No GAME-019 production code has started. If the
checkpoint is already on `main`, only the user's Windows acceptance remains.

## Next action

Run `npm run accept:main` on the user's Windows checkout. After a PASS, start
GAME-019 as a new small task: first define and test the server-truth
detected-danger boundary and its ordering relative to the 500 m contact
boundary. Do not implement avoidance geometry until that contract is stable.

## Known issues

- GAME-018 covers a 50% boundary during one discovery STOP; it does not yet
  recompute a new mixed-activity emergency boundary after a completed stop.
- Expedition composition still selects only the first patrol contact; several
  simultaneous patrols remain outside the slice.
- Detected-danger `AVOID`, automatic resupply, money/cargo transfer, selection
  among known cities and persistence are not implemented.

## Resume instruction

Read `AGENTS.md`, `docs/DEVELOPMENT_WORKFLOW.md`, `TODO.md`, `docs/ROADMAP.md`
and this file. Verify the last known good point, continue `Current task` from
`Next action`, and follow: one small task -> tests -> stable commit ->
ROADMAP/TODO -> replace this handoff -> CI-gated PR/merge. If resources may not
cover another safe task, stop as `RESOURCE LIMIT CHECKPOINT` after updating
this file.
