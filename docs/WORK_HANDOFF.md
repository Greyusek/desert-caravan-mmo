# Work handoff

Updated: 29 August 2026

This is the short operational recovery point for the Stage 4.5 series.
Repository history and checkpoint documents contain the full record.

## Current autonomous block

MVP-1 «Living Path», Trading Prototype Stage 3 and Tactical Combat Prototype
Stage 4 are complete. Stage 4.5 has advanced to Checkpoint 73 / version `0.0.73`.
`TACTICAL-001` through `TACTICAL-007`, `UI-008` and the final `COMBAT-001` proof
are closed. The Stage 4.5 Player-facing UI Vertical Slice is decomposed by the
separate `UI-VERTICAL-DECOMP` docs-only checkpoint, and `PLAYER-PROJECTION-001` now
provides its safe player data/action boundary. `PLAYER-SHELL-001` now supplies a
separate visual application over that boundary. Multiplayer and later stages
remain gated.

## Completed

- Checkpoints 43–53 retain independent regression coverage for the complete
  Living Path, persistent creatures, physical knowledge and earned history.
- Checkpoints 54–62 retain the complete seven-good Trading Prototype, physical
  player/NPC routes, market effects, information valuation and UI projection.
- TACTICAL-001–003 provide a seeded battlefield, physical source-linked units
  and deterministic validated MOVE/ATTACK/WAIT commands through completion.
- TACTICAL-004–006 make existing cargo physical, resolve retreat and apply
  health, permanent casualties and conserved cargo exactly once to world state.
- TACTICAL-007 makes tactical combat the default resolver for an existing
  authoritative PvE monster contact. It validates the contact against the same
  persistent creature, preserves current source health, executes tactical
  commands and returns winner/casualties/cargo to the global state.
- The unchanged GAME-005/006 Power stub is available through the new resolver
  only when callers explicitly select `LEGACY_POWER`.
- UI-008 projects that same resolved tactical snapshot in the dependency-free
  debug map: cells/zones, source-linked units, baggage, commands/events,
  casualties, winner, conserved cargo and exactly-once world return. Browser
  rendering contains no combat, cargo or world-return solver.
- COMBAT-001 owns the final shared server-truth composition: an active physical
  route creates the contact, tactical resolution applies source health, deaths
  and cargo once, and the same journey resumes 300 m then arrives with every
  consequence intact. UI-008 now projects this scenario directly.
- PLAYER-PROJECTION-001 keeps that server truth inside an immutable controller
  and exposes only allow-listed screens, local known-map positions, caravan,
  market, route, journal and validated player actions. Serialized views omit
  exact coordinates, seed, hidden encounters, internal identities and formula
  inputs.
- PLAYER-SHELL-001 adds an independently served Caravan Command application,
  five projection-driven top-level screens and shared visual/accessibility
  tokens. Its server exposes only Player UI assets and a safe read-only view;
  Debug UI remains separate and retains all privileged inspection controls.

## Last known good main

- `3c31c4a0d17bebbda297c09a59b99c491f444d66` — merge of PR #90 / PLAYER-PROJECTION-001.

## Verification

- TypeScript build: PASS for `sim-core`, `debug-map` and `player-ui`.
- Full `npm run verify:local`: `619/619` PASS, zero failures, compiled
  Checkpoint 73 demo PASS.
- Dedicated PLAYER-SHELL-001 additions: `13/13` PASS.
- Player UI HTTP smoke and safe-payload scan: PASS.
- `git diff --check`: PASS.

## Current task

`PLAYER-SHELL-001` implements the second of eight Stage 4.5 checkpoints: the
separate browser application, visual language and navigation driven only by the
safe player projection. Functional screen content remains queued.

## Next action

After this checkpoint merges, start `PLAYER-GLOBAL-001`: add the known north-up
map, caravan command summary, map layers, route actions and compact player
journal inside the established shell.

## Scope boundary

The current branch contains the visual shell but no functional map, market,
formation or combat controls. No real-player PvP, multiplayer, production
database, player settlements, full
Magic/System 256, neural agents, broad
production-chain simulation or Stage 5 work.

## Resume instruction

Read `AGENTS.md`, `docs/DEVELOPMENT_WORKFLOW.md`, the supplied Stage 4.5 prompt,
`TODO.md`, this file, `docs/STAGE_4_5_UI_DECOMPOSITION.md` and
`docs/CHECKPOINT_73.md`. Verify the shell PR is merged, then continue with
`PLAYER-GLOBAL-001` only.
