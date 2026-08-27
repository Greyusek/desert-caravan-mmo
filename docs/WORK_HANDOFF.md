# Work handoff

Updated: 27 August 2026

This is the short operational recovery point for the autonomous MAIN3 series.
Repository history and checkpoint documents contain the full record.

## Current autonomous block

MVP-1 «Living Path» is in progress. Checkpoint 46 / LIVING-004 / version
`0.0.46` adds deterministic route-backed pursuit and evasion.

## Completed

- A detected target creates a finite pursuit `RoutePlan` from the observer's
  authoritative position, existing speed and sighting world time.
- Immediate reciprocal detection creates an evasion route directly away from
  the pursuer; one-way detection creates no target evasion.
- Both plans expose normal finite `RouteMotion` values consumable by SIM-008.
- Existing continuous encounter geometry proves deterministic catch/no-catch
  outcomes for faster pursuer and faster evader scenarios.
- A later sighting on the abandoned original path is not reused after a route
  change; it must be recomputed from current authoritative motion.

## Last known good commit

- `fc555b7736628b1fc8ec2934d4578fea83d0c3ba` — LIVING-004 functional commit;
  tree `0b5c918dd3ed57da5c74de7f160e45336b008330`.
- Branch: `feature/living-004-pursuit-evasion`; PR/merge status is
  updated after the GitHub quality gate.

## Verification

- TypeScript build: PASS for `sim-core` and `debug-map`.
- Full `npm run verify:local`: `395/395` PASS, zero failures, compiled
  Checkpoint 46 demo PASS.
- Targeted LIVING-002/003/004 suite: `18/18` PASS.
- `git diff --check`: PASS.

## Current task

Complete the PR/CI/merge cycle for Checkpoint 46, then continue immediately to
CONSEQUENCE-001.

## Next action

`CONSEQUENCE-001`: retain a destroyed caravan as permanent world remains with
minimal loot and deterministic world-time degradation. Do not add tactical
combat, full inventory simulation or a production economy.

## Scope boundary

No trading economy, production chains, tactical combat, PvP, multiplayer,
database, full physical-map inventory, Magic/System 256 or neural agents.

## Resume instruction

Read `AGENTS.md`, `docs/DEVELOPMENT_WORKFLOW.md`, `TODO.md`, the MVP-1 section of
`docs/ROADMAP.md`, `docs/MVP_SPEC.md`, this file and the latest checkpoint only.
Verify the branch/PR/main state, finish the current quality gate if necessary,
then continue with the exact next action above.
