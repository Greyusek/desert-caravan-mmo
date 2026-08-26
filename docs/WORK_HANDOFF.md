# Work handoff

Updated: 25 August 2026

This is the short operational recovery point for an autonomous Work series.
Replace stale details after every completed task; do not append a development
diary. Repository history and checkpoint documents contain the full record.

## Current autonomous block

MVP-0 doctrine and survival. The first authoritative 1000 m danger warning is
now selected deterministically across several patrols during uninterrupted
movement and a scheduled discovery `STOP`. The next slice is moving doctrine
execution with clearance against the complete patrol set.

## Completed

- Checkpoint 39 / GAME-022 / version `0.0.39` adds detection-only arbitration
  across several patrols while reusing each existing continuous warning solver.
- The earliest absolute world time wins. Candidates within the established
  encounter tolerance are ordered by raw monster ID, independently of caller
  array order and runtime locale.
- Duplicate monster IDs are rejected before evaluation; an empty patrol set
  remains valid and returns no warning after shared input validation.
- Moving and scheduled-STOP variants preserve the winning patrol's time
  domains, activity, coordinates, separation and planned contact lead.
- The DEV map evaluates both generated patrols and displays one winner,
  forecast/detected state and moving/STOP activity in a dedicated line.
- Existing `AVOID | CONTINUE` remains explicitly tied to the manually selected
  QA patrol; Checkpoint 39 does not claim multi-patrol detour safety.

## Last known good commit

- `30180d4b8b8448b5a869c754d5b1fa97867220fa` — local functional commit for
  Checkpoint 39 / version `0.0.39`; tree
  `c464e638b88b73a4f26b61290d1c73a083041d11`.
- `0c12c903877653fef665dbed5aedbfc6aed68fe5` — merged main immediately before
  Checkpoint 39 (Checkpoint 38 merge and accepted Windows baseline).

## Verification

- Clean `npm ci` with the workspace cache before implementation: PASS.
- TypeScript build: PASS for `sim-core` and `debug-map`.
- Automated suite: `346/346` PASS, zero failures (`341` simulation/UI plus `5`
  tooling regressions).
- Compiled Checkpoint 39 demo: PASS; simultaneous input
  `[demo-patrol-b, demo-patrol-a]` selects `demo-patrol-a` at the exact shared
  warning time.
- Local debug server start: PASS on `http://127.0.0.1:4173`; Checkpoint 39 HTML,
  browser model integration and compiled sim-core entry build successfully.
- Git tree and `git diff --check`: PASS at the functional commit.
- GitHub Actions remains the merge gate. If this file is read from `main`, the
  Checkpoint 39 PR passed that gate before merge.

## Current task

Checkpoint 39 is complete on `feature/game-022-multi-patrol-danger`.
Publication and CI-gated merge are pending.

## Next action

When publication is authorized, publish the feature branch, open its PR and
merge only after `CI / verify` succeeds. Then run `npm run accept:main` on the
user's Windows checkout. After a PASS, start GAME-023 as a new small task:
execute moving `AVOID | CONTINUE` for the selected first warning and accept an
AVOID continuation only after continuous clearance checks against every
patrol. Keep scheduled-STOP composition for a later slice.

## Known issues

- Danger detection now arbitrates several patrols, but contact/outcome
  arbitration still follows one selected patrol in the debug execution path.
- Existing AVOID validates deterministic one-waypoint candidates against only
  the selected patrol and must not yet be described as multi-patrol safe.
- GAME-023 should cover uninterrupted movement only; reusing it during a STOP
  requires a separate first-boundary and effective-idle composition step.
- Avoidance returns `detour-unavailable` if no configured one-waypoint candidate
  is safe; pursuit and arbitrary pathfinding remain outside the slice.
- Automatic resupply, money/cargo transfer, selection among known cities,
  persistence and production sensor calibration are not implemented.

## Resume instruction

Read `AGENTS.md`, `docs/DEVELOPMENT_WORKFLOW.md`, `TODO.md`, `docs/ROADMAP.md`
and this file. Verify the last known good point, continue `Current task` from
`Next action`, and follow: one small task -> tests -> stable commit ->
ROADMAP/TODO -> replace this handoff -> CI-gated PR/merge. If resources may not
cover another safe task, stop as `RESOURCE LIMIT CHECKPOINT` after updating
this file.
