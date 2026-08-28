# Work handoff

Updated: 28 August 2026

This is the short operational recovery point for the autonomous Stage 4 series.
Repository history and checkpoint documents contain the full record.

## Current autonomous block

MVP-1 «Living Path» and Trading Prototype Stage 3 remain complete at Checkpoint
62 / version `0.0.62`. The user has explicitly opened Stage 4. Tactical Combat
Prototype is decomposed into `TACTICAL-001` through `TACTICAL-007`, `UI-008` and
the final `COMBAT-001` proof. Multiplayer Vertical Slice and later stages remain
gated by a separate user command.

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
- TRADE-001 reuses seeded food/water and population, adds five more finite goods
  and guarantees one deterministic surplus and deficit flow per city.
- TRADE-002 derives city buy/sell quotes from thirty-day target demand, current
  stock, `0.5x..3x` scarcity bounds and a fixed 10% spread.
- TRADE-003 changes the same markets through capacity-limited purchase and sale,
  requires physical route completion and retains cost basis for route profit.
- TRADE-004 orchestrates those same operations for an NPC and proves its
  destination delivery changes the price subsequently quoted to the player.
- INFO-TRADE-001 quotes a physical bundle from target-library novelty, accuracy,
  age, confirmations/provenance and strategic evidence kind; exact repeats pay 0.
- INFO-TRADE-002 limits bundles to three entries/two copy generations and carries
  copy, medium-age and fallen-archive fidelity into the local price.
- UI-007 exposes both seven-good markets, production/consumption, cargo and the
  player journal/profit, physical NPC price impact and differentiated local
  information quotes without duplicating sim-core formulas in the DOM.
- TRADING-001 composes those primitives in one authoritative seeded scenario,
  preserves exact state in `serverTruth`, exposes a coordinate-free
  `playerView`, and makes UI-007 a projection of that final view.

## Last known good main

- `8e5eac328839c90473ddbc36b3836d1ba1616404` — merge of PR #71;
  functional head `ca186aa4145292d5f25b1a4d80ddb59d6725dc30`, tree
  `a1460521bd840f90fec091ef4730fa38d76446bc`.
- PR #71 is merged; GitHub `CI / verify` run #155 completed successfully on the
  exact functional head. `main` matched `origin/main` when this final handoff
  branch was created.

## Verification

- TypeScript build: PASS for `sim-core` and `debug-map`.
- Full `npm run verify:local`: `521/521` PASS, zero failures, compiled
  Checkpoint 62 demo PASS.
- Dedicated TRADING-001 suite: `11/11` PASS; debug-map remains `132/132` PASS.
- `git diff --check`: PASS.

## Current task

Docs-only Stage 4 decomposition is the current stable planning change. No
functional checkpoint or version has advanced. The next implementation task is
`TACTICAL-001`: deterministic discrete battlefield geometry and deployment
zones only.

## Next action

Complete the docs-only decomposition PR, then autonomously start `TACTICAL-001`
from updated `main` and continue through the Stage 4 queue while verification
remains green and resources allow.

## Scope boundary

Tactical Combat Prototype only. No real-player PvP, multiplayer, production
database, player settlements, full Magic/System 256, neural agents, broad
production-chain simulation or Stage 5 work.

## Resume instruction

Read `AGENTS.md`, `docs/DEVELOPMENT_WORKFLOW.md`, `TODO.md`, this file and
`docs/CHECKPOINT_62.md`. Verify repository/PR/CI state. Continue with the first
unchecked Stage 4 queue item. Stop after `COMBAT-001`; Stage 5 requires an
explicit user command.
