# Work handoff

Updated: 25 August 2026

This is the short operational recovery point for an autonomous Work series.
Replace stale details after every completed task; do not append a development
diary. Repository history and checkpoint documents contain the full record.

## Current autonomous block

MVP-0 doctrine and survival. The single-patrol `AVOID | CONTINUE` path now
works during uninterrupted movement and a scheduled discovery `STOP`; the
next slice is deterministic warning arbitration across several patrols.

## Completed

- Checkpoint 38 / GAME-021 / version `0.0.38` composes the authoritative
  1000 m warning and `AVOID | CONTINUE` with one scheduled discovery STOP.
- World time advances while route time and caravan position remain pinned to
  the exact STOP boundary. A pre-STOP warning is not emitted again, while the
  exact STOP instant belongs to idle execution.
- `CONTINUE` preserves the original route object, full scheduled wait and
  later contact unchanged.
- `AVOID` preserves the exact route prefix to STOP, cancels only the unelapsed
  wait and validates the post-decision continuation against the patrol at its
  real world time before accepting the deterministic waypoint detour.
- Contact or a caller-supplied boundary at or before the warning keeps
  priority; unavailable detours preserve the original route and wait.
- The DEV map composes effective STOP duration, route, contact, outcome and
  journal ordering, including `danger-avoidance` resume provenance and a
  dedicated three-step STOP scenario.

## Last known good commit

- `c9969f0dc8c034c3c5e877d895ce6ae75a662d1c` — local functional commit for
  Checkpoint 38 / version `0.0.38`; tree
  `ba6552a9b4feecd10ae3040d0ba3b9c484dfce10`.
- `7873c601e578ac1c927759b0572d6b00c1c20a27` — merged main immediately before
  Checkpoint 38 (Checkpoint 37 merge and accepted Windows baseline).

## Verification

- Clean `npm ci` with the workspace cache: PASS.
- TypeScript build: PASS for `sim-core` and `debug-map`.
- Automated suite: `336/336` PASS, zero failures (`331` simulation/UI plus `5`
  tooling regressions).
- Compiled Checkpoint 38 demo: PASS; the idle warning reports separate world
  and route times, `40 / 200 s` effective/scheduled idle and
  `contact-after=none`.
- Local debug server: PASS; Checkpoint 38 HTML, the STOP QA control, browser
  integration and compiled sim-core entry are served successfully.
- Git tree and `git diff --check`: PASS at the functional commit.
- GitHub Actions remains the merge gate. If this file is read from `main`, the
  Checkpoint 38 PR passed that gate before merge.

## Current task

Checkpoint 38 is complete. On `feature/game-021-danger-stop`, publication and
CI-gated merge are pending. On `main`, only the user's Windows acceptance is
pending.

## Next action

If still on the feature branch and publication is authorized, publish it,
open its PR and merge only after `CI / verify` succeeds. Then run
`npm run accept:main` on the user's Windows checkout. After a PASS, start
GAME-022 as a new small task: select the earliest 1000 m warning across several
patrols with stable time/monster-id tie-breaking, without implementing
multi-patrol avoidance clearance in the same slice.

## Known issues

- GAME-021 still evaluates one selected patrol; several simultaneous warning
  and contact candidates are not arbitrated.
- Avoidance checks deterministic one-waypoint candidates on finite clearance
  rings and returns `detour-unavailable` if none is safe; pursuit and arbitrary
  pathfinding remain outside the slice.
- GAME-022 is detection-only; a later step must verify any executed detour
  against every relevant patrol before claiming multi-patrol safety.
- Automatic resupply, money/cargo transfer, selection among known cities,
  persistence and production sensor calibration are not implemented.

## Resume instruction

Read `AGENTS.md`, `docs/DEVELOPMENT_WORKFLOW.md`, `TODO.md`, `docs/ROADMAP.md`
and this file. Verify the last known good point, continue `Current task` from
`Next action`, and follow: one small task -> tests -> stable commit ->
ROADMAP/TODO -> replace this handoff -> CI-gated PR/merge. If resources may not
cover another safe task, stop as `RESOURCE LIMIT CHECKPOINT` after updating
this file.
