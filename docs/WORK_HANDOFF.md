# Work handoff

Updated: 26 August 2026

This is the short operational recovery point for the autonomous MAIN3 series.
Repository history and checkpoint documents contain the full record.

## Current autonomous block

MVP-1 «Living Path» is in progress. Checkpoint 43 / LIVING-001 / version
`0.0.43` adds the first deterministic route-backed NPC caravan without starting
Trading Prototype, tactical combat, multiplayer or persistent storage.

## Completed

- Seeded worlds contain configurable NPC caravans travelling between cities.
- NPC travel reuses `RoutePlan`, SIM-005, existing speed units and authoritative
  world time; no parallel movement physics exists.
- Delayed departures expose scheduled, moving and arrived states.
- Existing city, static-object and wandering-monster deterministic streams are
  preserved.

## Last known good commit

- `9c9b8c39a9fbda37fe8fae20c75ee06db605f67b` — LIVING-001 functional commit;
  tree `bf954bd4fad4334b86bce3f57117ec1520ec68c5`.
- Branch: `feature/living-001-npc-caravans`; PR/merge status is updated after
  the GitHub quality gate.

## Verification

- TypeScript build: PASS for `sim-core` and `debug-map`.
- Full local equivalent of `npm run verify:local`: `377/377` PASS, zero
  failures, compiled demo PASS.
- Targeted NPC/world/monster suite: `36/36` PASS.
- `git diff --check`: PASS.

## Current task

Complete the PR/CI/merge cycle for Checkpoint 43, then continue immediately to
LIVING-002.

## Next action

`LIVING-002`: implement asymmetric caravan detection using the existing
continuous moving-encounter geometry while keeping each observer's vision
radius independent. Player-facing output must not contain absolute coordinates.

## Scope boundary

No trading economy, production chains, tactical combat, PvP, multiplayer,
database, full physical-map inventory, Magic/System 256 or neural agents.

## Resume instruction

Read `AGENTS.md`, `docs/DEVELOPMENT_WORKFLOW.md`, `TODO.md`, the MVP-1 section of
`docs/ROADMAP.md`, `docs/MVP_SPEC.md`, this file and the latest checkpoint only.
Verify the branch/PR/main state, finish the current quality gate if necessary,
then continue with the exact next action above.
