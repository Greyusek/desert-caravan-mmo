# Work handoff

Updated: 26 August 2026

This is the short operational recovery point for an autonomous Work series.
Replace stale details after every completed task; do not append a development
diary. Repository history and checkpoint documents contain the full record.

## Current autonomous block

MVP-0 doctrine and survival. Multi-patrol `AVOID | CONTINUE` now executes both
while moving and during a scheduled discovery `STOP`, with exact time domains
and all-patrol clearance. The next slice promotes stable contact selection into
the authoritative expedition contact/outcome API.

## Completed

- Checkpoint 41 / GAME-024 / version `0.0.41` composes aggregate patrol danger
  doctrine with one scheduled discovery `STOP`.
- Warning and contact arbitration preserve earliest-time then raw-ID ordering;
  contact or a caller-supplied boundary at the same or earlier instant wins.
- `CONTINUE` preserves the original route, complete scheduled wait and stable
  first contact.
- `AVOID` cancels only the unelapsed wait, departs from the exact STOP
  coordinate at the real world time and checks every patrol continuously.
- Input order and whole patrol-cycle delay cannot change selected identity,
  effective idle duration or detour geometry.
- The DEV STOP flow now uses both generated patrols for warning, doctrine,
  route clearance, journal execution and contact focus.

## Last known good commit

- `bbabad4bcc30dd0e9b91c71232628b87b5c437e9` — local functional commit for
  Checkpoint 41 / version `0.0.41`; tree
  `0624001d25ab6f16341ba3ec0c0da793cb6e2ccb`.
- `f7ebc8d0330336b49f333ace6cc92adabb0bc8d9` — merged and user-accepted main
  immediately before Checkpoint 41 (Checkpoint 40 merge).

## Verification

- Clean `npm ci` with the workspace cache before implementation: PASS.
- TypeScript build: PASS for `sim-core` and `debug-map`.
- Automated suite: `366/366` PASS, zero failures (`361` simulation/UI plus `5`
  tooling regressions).
- Compiled Checkpoint 41 demo: PASS; simultaneous idle input selects
  `idle-demo-patrol-a`, clears both sorted patrol IDs, preserves route time at
  100 seconds, truncates idle time to 40 seconds and reports no later contact.
- Local debug server start and HTTP response: PASS on
  `http://127.0.0.1:4173`; the served page contains the GAME-024 multi-patrol
  STOP section and browser assets build successfully.
- Git tree and `git diff --check`: PASS at the functional commit.
- `GITHUB_CI_NOT_STARTED`: GitHub Actions did not register a `CI / verify` run
  for PR #48 after the permitted observation window.
- `LOCAL_VERIFY_PASS`: the complete local quality gate passed on the published
  Checkpoint 41 content.
- `TREE_VERIFIED`: PR #48 HEAD tree
  `64d24f89a2083a242f7b6f284c3652a8866a3833` exactly matches the locally
  verified Checkpoint 41 tree; no source change followed verification.

## Current task

Checkpoint 41 is complete on `feature/game-024-multi-patrol-stop`; PR #48 is
published and eligible for the documented local-verification CI fallback.

## Next action

Merge PR #48 using the verified-tree fallback, then start GAME-025 as a new
small task: promote stable multi-patrol contact selection into the authoritative
expedition contact/outcome API while preserving first-boundary priority and
resolving no more than one contact per slice.

## Known issues

- Danger doctrine is multi-patrol-safe for moving and scheduled-STOP execution,
  but stable contact selection is still planner-internal rather than a public
  expedition contact/outcome API.
- GAME-025 should expose only the first aggregate contact; repeated sequential
  encounters remain a later composition problem.
- Avoidance returns `detour-unavailable` if no configured one-waypoint candidate
  is safe; pursuit and arbitrary pathfinding remain outside the slice.
- Automatic resupply, money/cargo transfer, selection among known cities,
  persistence and production sensor calibration are not implemented.

## Resume instruction

Read `AGENTS.md`, `docs/DEVELOPMENT_WORKFLOW.md`, `TODO.md`, `docs/ROADMAP.md`
and this file. Verify the last known good point, continue `Current task` from
`Next action`, and follow: one small task -> tests -> stable commit ->
ROADMAP/TODO -> replace this handoff -> PR/merge using GitHub CI when available
or the documented verified-tree fallback when it does not start. If resources
may not cover another safe task, stop as `RESOURCE LIMIT CHECKPOINT` after
updating this file.
