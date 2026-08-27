# Work handoff

Updated: 27 August 2026

This is the short operational recovery point for the autonomous MAIN4 series.
Repository history and checkpoint documents contain the full record.

## Current autonomous block

MVP-1 «Living Path» is complete. MAIN4 has implemented Checkpoint 61 / UI-007 /
version `0.0.61`: the existing debug map now projects the material and
information economy as one deterministic Trading Prototype QA scenario.
Tactical Combat Prototype and every later roadmap stage remain gated by a
separate user command.

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

## Last known good main

- `99c392ff9c156d340195a0c5c4910e40209226a9` — merge of PR #69;
  tree `cf476cc4fbbbfabb28688062f15955c5220df40e`.
- `main` exactly matched `origin/main` before the UI-007 feature branch; PR #69
  is merged and its GitHub CI run #151 succeeded.

## Verification

- TypeScript build: PASS for `sim-core` and `debug-map`.
- Full `npm run verify:local`: `510/510` PASS, zero failures, compiled
  Checkpoint 61 demo PASS.
- Debug-map suite: `132/132` PASS, including `6/6` new UI-007 regressions.
- `git diff --check`: PASS.

## Current task

Complete the PR/CI/merge cycle for Checkpoint 61, then implement `TRADING-001`.

## Next action

After stable `main`, start `TRADING-001` in its own feature branch. Add one
authoritative seeded end-to-end scenario that composes the player goods route,
later NPC market impact and physically delivered library information, then close
Stage 3 and stop before Tactical Combat.

## Scope boundary

No tactical combat, PvP, multiplayer, production database, player settlements,
full Magic/System 256, neural agents or broad production-chain simulation.

## Resume instruction

Read `AGENTS.md`, `docs/DEVELOPMENT_WORKFLOW.md`, `TODO.md`, Stage 3 of
`docs/ROADMAP.md`, the relevant knowledge/economy parts of `docs/MVP_SPEC.md`,
this file and the latest checkpoint only. Verify the active branch/PR/main
state, finish any current quality gate, and resume at the first unchecked MAIN4
queue item. Stop after `TRADING-001`; Tactical Combat requires a new command.
