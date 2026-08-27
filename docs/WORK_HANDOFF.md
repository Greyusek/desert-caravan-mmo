# Work handoff

Updated: 27 August 2026

This is the short operational recovery point for the autonomous MAIN4 series.
Repository history and checkpoint documents contain the full record.

## Current autonomous block

MVP-1 «Living Path» is complete at Checkpoint 54 / MVP1-001 / version `0.0.54`.
MAIN4 is authorized to complete only Stage 3 — Trading Prototype. Tactical
Combat Prototype and every later roadmap stage remain gated by a separate user
command.

## Completed

- One end-to-end scenario composes an authoritative travelling NPC caravan,
  one-way sighting, approximate-age track, route-backed pursuit, permanent
  degrading remains and deterministic minimal loot.
- Track/remains observations become coordinate-free knowledge and journal
  records with provenance, observation time and confidence.
- A physical carrier returns that knowledge to city A. City B remains empty
  until a copied bundle physically travels the full A-to-B route.
- Delivered remains evidence produces a typed, quality-rated world rumor.
- The complete server truth and player view reproduce for identical seed and
  actions; the player view contains no coordinates or source-caravan identity.
- Checkpoints 43–53 retain their independent regression coverage, including
  persistent catch-up, creature intelligence and earned legendary history.

## Last known good main

- `cfa92c9009e1abe8685cfe78b80df785da6a7a54` — merge of PR #62;
  tree `35c8b60ed3840723024043252bffe92bcd7ae29a`.
- `main` exactly matches `origin/main`; PR #62 is merged and no PR is open.

## Verification

- TypeScript build: PASS for `sim-core` and `debug-map`.
- Clean baseline `npm ci` and full `npm run verify:local`: `458/458` PASS,
  zero failures, compiled Checkpoint 54 demo PASS.
- Targeted MVP1-001 suite: `11/11` PASS.
- `git diff --check`: PASS.

## Current task

Publish the documentation-only Trading Prototype decomposition, then implement
the queue in order: `TRADE-001`, `TRADE-002`, `TRADE-003`, `TRADE-004`,
`INFO-TRADE-001`, `INFO-TRADE-002`, `UI-007`, `TRADING-001`.

## Next action

Complete the docs PR without a version bump, return to current `main`, then
start `TRADE-001` in its own feature branch.

## Scope boundary

No tactical combat, PvP, multiplayer, production database, player settlements,
full Magic/System 256, neural agents or broad production-chain simulation.

## Resume instruction

Read `AGENTS.md`, `docs/DEVELOPMENT_WORKFLOW.md`, `TODO.md`, Stage 3 of
`docs/ROADMAP.md`, the relevant knowledge/economy parts of `docs/MVP_SPEC.md`,
this file and the latest checkpoint only. Verify the active branch/PR/main
state, finish any current quality gate, and resume at the first unchecked MAIN4
queue item. Stop after `TRADING-001`; Tactical Combat requires a new command.
