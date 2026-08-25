# Work handoff

Updated: 25 August 2026

This is the short operational recovery point for an autonomous Work series.
Replace stale details after every completed task; do not append a development
diary. Repository history and checkpoint documents contain the full record.

## Current autonomous block

MVP-0 doctrine and survival, transitioning from the stable GAME-019 warning
boundary to the first `AVOID | CONTINUE` route decision.

## Completed

- Checkpoint 36 / GAME-019 / version `0.0.36` adds the first moving-patrol
  server-truth danger warning at 1000 m, reusing the GAME-006 safe separation.
- A normal approach is detected strictly before the existing 500 m contact;
  an expedition already inside contact records an exact tie with contact
  priority, and invalid non-outer warning radii are rejected.
- The warning preserves world/route/patrol time, exact positions and planned
  contact lead; a near pass may be detected without producing contact.
- The DEV journal, world marker and concentric 1000/500 m contact inset expose
  the boundary without changing the route or implementing avoidance geometry.

## Last known good commit

- `37a4c52b879f57a51607b8078c4afb27d3c01f74` — remote functional commit for
  Checkpoint 36 / version `0.0.36`; tree
  `b5ae4e809775c6ffd7029591f3522f4e7171f859` exactly matches the locally
  verified feature tree.
- `1bde0e1f2b55fed9a37dfcb7c01a92bd690965b2` — merged main immediately before
  Checkpoint 36 (Checkpoint 35 merge).

## Verification

- Clean `npm ci` with the workspace cache: PASS.
- TypeScript build: PASS for `sim-core` and `debug-map`.
- Automated suite: `313/313` PASS, zero failures (`308` simulation/UI plus `5`
  tooling regressions).
- Compiled Checkpoint 36 demo: PASS; warning at 1000 m / `T=29.289322 s`,
  contact at 500 m after `35.355339 s`, order `before-contact`.
- Git tree equality and `git diff --check`: PASS.
- GitHub Actions remains the merge gate. If this file is read from `main`, the
  Checkpoint 36 PR passed that gate before merge.

## Current task

Checkpoint 36 is complete. No GAME-020 production code has started. If the
checkpoint is already on `main`, only the user's Windows acceptance remains.

## Next action

Run `npm run accept:main` on the user's Windows checkout. After a PASS, start
GAME-020 as a new small task: at the first 1000 m warning execute
`AVOID | CONTINUE`. `CONTINUE` must preserve the route byte-for-byte; `AVOID`
must preserve the executed prefix and replace only future movement with one
deterministic detour whose resolved path stays outside the 500 m contact
boundary. Keep idle-STOP composition and several patrols outside that slice.

## Known issues

- GAME-019 warning composition covers uninterrupted moving execution only; it
  does not yet span a discovery STOP.
- Expedition composition still selects only the first patrol contact; several
  simultaneous patrols remain outside the slice.
- `AVOID`, automatic resupply, money/cargo transfer, selection among known
  cities and persistence are not implemented.

## Resume instruction

Read `AGENTS.md`, `docs/DEVELOPMENT_WORKFLOW.md`, `TODO.md`, `docs/ROADMAP.md`
and this file. Verify the last known good point, continue `Current task` from
`Next action`, and follow: one small task -> tests -> stable commit ->
ROADMAP/TODO -> replace this handoff -> CI-gated PR/merge. If resources may not
cover another safe task, stop as `RESOURCE LIMIT CHECKPOINT` after updating
this file.
