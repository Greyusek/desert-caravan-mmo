# Work handoff

Updated: 25 August 2026

This is the short operational recovery point for an autonomous Work series.
Replace stale details after every completed task; do not append a development
diary. Repository history and checkpoint documents contain the full record.

## Current autonomous block

MVP-0 doctrine and survival, transitioning from the stable uninterrupted
moving `AVOID | CONTINUE` execution to the same decision during discovery
`STOP`.

## Completed

- Checkpoint 37 / GAME-020 / version `0.0.37` executes the first danger
  doctrine at the authoritative GAME-019 1000 m warning boundary.
- `CONTINUE` returns the original route object and contact unchanged.
- `AVOID` preserves the exact executed prefix, inserts one deterministic
  left/right waypoint, rejoins the interrupted segment and preserves its later
  command suffix.
- The nearest configured clearance ring is accepted only when the complete
  resolved timed route has no continuous 500 m contact with the selected
  patrol; an unsafe or unavailable detour is never claimed as successful.
- Contact keeps priority for an at-contact warning tie. Warning-only near
  passes, delayed world time and both doctrine paths remain deterministic.
- The DEV selector, three-step intercept flow and journal expose the decision;
  AVOID removes the later contact from outcome/log execution while CONTINUE
  retains it.

## Last known good commit

- `a86a2b67072d17c1eec8fb4b0199432108d60ade` — local functional commit for
  Checkpoint 37 / version `0.0.37`; tree
  `3d7d746bc69d85258d2baf8b446377f77d5b37e1`.
- `97d898f4d50b3fa0d5f2a48c713fce74e40cae98` — merged main immediately before
  Checkpoint 37 (Checkpoint 36 merge).

## Verification

- Clean `npm ci` with the workspace cache: PASS.
- TypeScript build: PASS for `sim-core` and `debug-map`.
- Automated suite: `325/325` PASS, zero failures (`320` simulation/UI plus `5`
  tooling regressions).
- Compiled Checkpoint 37 demo: PASS; AVOID selects the deterministic right
  detour, adds 5.667 km and reports `contact-after=none`.
- Local debug server: PASS; Checkpoint 37 HTML and the doctrine integration are
  served with the expected browser assets.
- Git tree and `git diff --check`: PASS at the functional commit.
- GitHub Actions remains the merge gate. If this file is read from `main`, the
  Checkpoint 37 PR passed that gate before merge.

## Current task

Checkpoint 37 is complete. No GAME-021 production code has started. If the
checkpoint is already on `main`, only the user's Windows acceptance remains.

## Next action

Run `npm run accept:main` on the user's Windows checkout. After a PASS, start
GAME-021 as a new small task: detect the selected moving patrol at 1000 m
during a scheduled discovery `STOP`, execute `AVOID | CONTINUE` at exact world
time, preserve contact/earlier-boundary priority, and let AVOID cancel only the
remaining wait before departing from the exact stop coordinate. Keep several
patrols outside that slice.

## Known issues

- GAME-020 danger doctrine covers uninterrupted movement only; it does not yet
  span a discovery STOP.
- Avoidance checks deterministic one-waypoint candidates on finite clearance
  rings and returns `detour-unavailable` if none is safe; pursuit and arbitrary
  pathfinding remain outside the slice.
- Expedition composition still selects only the first patrol contact; several
  simultaneous patrols remain outside the slice.
- Automatic resupply, money/cargo transfer, selection among known cities,
  persistence and production sensor calibration are not implemented.

## Resume instruction

Read `AGENTS.md`, `docs/DEVELOPMENT_WORKFLOW.md`, `TODO.md`, `docs/ROADMAP.md`
and this file. Verify the last known good point, continue `Current task` from
`Next action`, and follow: one small task -> tests -> stable commit ->
ROADMAP/TODO -> replace this handoff -> CI-gated PR/merge. If resources may not
cover another safe task, stop as `RESOURCE LIMIT CHECKPOINT` after updating
this file.
