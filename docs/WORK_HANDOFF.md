# Work handoff

Updated: 24 August 2026

This is the short operational recovery point for an autonomous Work series.
Replace stale details after every completed task; do not append a development
diary. Repository history and checkpoint documents contain the full record.

## Current autonomous block

MVP-0 doctrine and supply survival, currently the transition from GAME-017 to
GAME-018 in ROADMAP section 1.5.

## Completed

- Checkpoint 34 / GAME-017 is merged and accepted on the user's Windows PC.
- Continuous movement invokes `RETURN_TO_ORIGIN | CONTINUE` at 50% food or
  water; origin-city re-entry completes a selected return.
- DEVX-003 establishes this persistent handoff as the recovery contract for
  limited-resource autonomous Work sessions.

## Last known good commit

- `25af4c2` — merged Checkpoint 34 / version `0.0.34`.
- User acceptance: `294/294` tests passed, zero failures, clean
  `main...origin/main`.
- The documentation-only commit containing this handoff is safe when present;
  resolve its exact identifier with `git log -1 --oneline`.

## Verification

- Last functional acceptance: `npm run accept:main` PASS on Windows 11.
- Checkpoint 34 CI: PASS.
- DEVX-003 changes documentation only; `git diff --check` is its required local
  verification and normal repository CI remains the merge gate.

## Current task

GAME-018 is next and has not started: if food or water reaches 50% during a
discovery STOP, `RETURN_TO_ORIGIN` must cancel the remaining idle wait and
depart from the exact stop coordinate.

## Next action

Create a feature branch from current `main`, read GAME-009/010 stop-lifecycle
contracts together with GAME-017, then add the smallest pure simulation
composition and exact boundary-ordering tests before touching the DEV UI.

## Known issues

- GAME-017 intentionally handles only uninterrupted movement.
- An earlier discovery STOP currently blocks emergency return even when the 50%
  threshold is crossed during its idle interval.
- GAME-018 must preserve existing priority for fatal depletion and monster
  contact ties; do not silently alter GAME-009/010 semantics.

## Resume instruction

Read `AGENTS.md`, `docs/DEVELOPMENT_WORKFLOW.md`, `TODO.md`, `docs/ROADMAP.md`
and this file. Verify the last known good point, continue `Current task` from
`Next action`, and follow: one small task -> tests -> stable commit ->
ROADMAP/TODO -> replace this handoff -> CI-gated PR/merge. If resources may not
cover another safe task, stop as `RESOURCE LIMIT CHECKPOINT` after updating
this file.
