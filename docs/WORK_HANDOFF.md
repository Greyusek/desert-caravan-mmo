# Work handoff

Updated: 28 August 2026

This is the short operational recovery point for the autonomous MAIN4 series.
Repository history and checkpoint documents contain the full record.

## Current autonomous block

MVP-1 «Living Path» and Trading Prototype Stage 3 are complete. MAIN4 has
implemented Checkpoint 62 / TRADING-001 / version `0.0.62`: one deterministic
scenario now composes the player goods route, later NPC market impact and a
physically delivered locally valued knowledge bundle. Tactical Combat Prototype
and every later roadmap stage remain gated by a separate user command.

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

- `c289a2aa280246be25676cf8a511016b119daa85` — merge of PR #70;
  tree `ebaaaaa4f3c4511bfff76cddc2bc34311492c21a`.
- `main` exactly matched `origin/main` before the TRADING-001 feature branch;
  PR #70 is merged and its GitHub CI run #153 succeeded.

## Verification

- TypeScript build: PASS for `sim-core` and `debug-map`.
- Full `npm run verify:local`: `521/521` PASS, zero failures, compiled
  Checkpoint 62 demo PASS.
- Dedicated TRADING-001 suite: `11/11` PASS; debug-map remains `132/132` PASS.
- `git diff --check`: PASS.

## Current task

Complete the PR/CI/merge cycle for Checkpoint 62, then publish the final MAIN4
handoff record with the exact merge commit, PR and green CI run.

## Next action

After stable `main`, make no gameplay changes. Finalize only the exact handoff
metadata if needed, then stop. Tactical Combat requires a new user command.

## Scope boundary

No tactical combat, PvP, multiplayer, production database, player settlements,
full Magic/System 256, neural agents or broad production-chain simulation.

## Resume instruction

Read `AGENTS.md`, `docs/DEVELOPMENT_WORKFLOW.md`, `TODO.md`, Stage 3 of
`docs/ROADMAP.md`, the relevant knowledge/economy parts of `docs/MVP_SPEC.md`,
this file and the latest checkpoint only. Verify the active branch/PR/main
state, finish any current quality gate, and resume at the first unchecked MAIN4
queue item. Stop after `TRADING-001`; Tactical Combat requires a new command.
