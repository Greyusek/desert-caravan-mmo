# Work handoff

Updated: 26 August 2026

This is the short operational recovery point for an autonomous Work series.
Replace stale details after every completed task; do not append a development
diary. Repository history and checkpoint documents contain the full record.

## Current autonomous block

MVP-0 doctrine and survival. Moving `AVOID | CONTINUE` now executes from the
first authoritative warning across several patrols, and every accepted detour
is continuously clear of the complete patrol set. The next slice is the same
multi-patrol execution during a scheduled discovery `STOP`.

## Completed

- Checkpoint 40 / GAME-023 / version `0.0.40` executes moving doctrine from the
  stable GAME-022 warning selected across all patrols.
- `CONTINUE` preserves the original route object and the stable first contact;
  contact from any patrol at the warning instant or earlier keeps priority.
- `AVOID` reuses deterministic one-waypoint candidates and accepts one only
  after every patrol's continuous contact solver clears the complete timed
  route.
- An unsafe candidate can be rejected by a non-trigger patrol; if no configured
  candidate is safe, `detour-unavailable` preserves the original route.
- Input order and whole patrol-cycle delay cannot change the selected identity
  or detour geometry; clearance IDs are exposed in stable raw-ID order.
- The DEV moving intercept executes against both generated patrols and uses the
  stable first contact for CONTINUE. The scheduled-STOP doctrine remains
  explicitly scoped to the selected QA patrol.

## Last known good commit

- `92ea83a69359087fe52a25c44a87bce820cd5b29` — local functional commit for
  Checkpoint 40 / version `0.0.40`; tree
  `448f1a254f7b5b9ba7fe634f52a8ca01dfb909e7`.
- `0d5211a4a2de6f9be5fb4ca360207fe91f07e55e` — merged and user-accepted main
  immediately before Checkpoint 40 (Checkpoint 39 merge).

## Verification

- Clean `npm ci` with the workspace cache before implementation: PASS.
- TypeScript build: PASS for `sim-core` and `debug-map`.
- Automated suite: `356/356` PASS, zero failures (`351` simulation/UI plus `5`
  tooling regressions).
- Compiled Checkpoint 40 demo: PASS; simultaneous input selects
  `demo-patrol-a`, checks `demo-patrol-a,demo-patrol-b`, chooses the stable
  right detour and reports no contact after replanning.
- Local debug server start and HTTP response: PASS on
  `http://127.0.0.1:4173`; the served page contains the GAME-023 multi-patrol
  section and browser assets build successfully.
- Git tree and `git diff --check`: PASS at the functional commit.
- GitHub Actions remains the merge gate. If this file is read from `main`, the
  Checkpoint 40 PR passed that gate before merge.

## Current task

Checkpoint 40 is complete on `feature/game-023-multi-patrol-avoidance`.
Publication and CI-gated merge are pending.

## Next action

When publication is authorized, publish the feature branch, open its PR and
merge only after `CI / verify` succeeds. Then run `npm run accept:main` on the
user's Windows checkout. After a PASS, start GAME-024 as a new small task:
compose multi-patrol `AVOID | CONTINUE` with a scheduled discovery `STOP`,
preserving exact world/route time, contact priority and all-patrol clearance
after departure.

## Known issues

- Moving danger doctrine is multi-patrol-safe, but scheduled discovery `STOP`
  execution still follows one selected patrol and must not be described as
  all-patrol-safe.
- GAME-024 must compose aggregate warning/contact arbitration with exact
  world/route time and effective-idle departure without weakening current
  first-boundary priority.
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
