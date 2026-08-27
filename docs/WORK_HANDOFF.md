# Work handoff

Updated: 27 August 2026

This is the short operational recovery point for the autonomous MAIN4 series.
Repository history and checkpoint documents contain the full record.

## Current autonomous block

MVP-1 «Living Path» is complete. MAIN4 has implemented Checkpoint 60 /
INFO-TRADE-002 / version `0.0.60`: physical knowledge copies now have bounded
size/generation and inherited fidelity degradation. Tactical
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

## Last known good main

- `cfa92c9009e1abe8685cfe78b80df785da6a7a54` — merge of PR #62;
  tree `35c8b60ed3840723024043252bffe92bcd7ae29a`.
- `main` exactly matches `origin/main`; PR #62 is merged and no PR is open.

## Verification

- TypeScript build: PASS for `sim-core` and `debug-map`.
- Full `npm run verify:local`: `504/504` PASS, zero failures, compiled
  Checkpoint 60 demo PASS.
- Targeted INFO-TRADE-002 suite: `8/8` PASS.
- `git diff --check`: PASS.

## Current task

Complete the PR/CI/merge cycle for Checkpoint 60, then implement `UI-007`.

## Next action

After stable `main`, start `UI-007` in its own feature branch. Extend the current
debug map only enough to expose goods/flows/prices, player cargo and journal,
NPC market impact and target-library information quotes.

## Scope boundary

No tactical combat, PvP, multiplayer, production database, player settlements,
full Magic/System 256, neural agents or broad production-chain simulation.

## Resume instruction

Read `AGENTS.md`, `docs/DEVELOPMENT_WORKFLOW.md`, `TODO.md`, Stage 3 of
`docs/ROADMAP.md`, the relevant knowledge/economy parts of `docs/MVP_SPEC.md`,
this file and the latest checkpoint only. Verify the active branch/PR/main
state, finish any current quality gate, and resume at the first unchecked MAIN4
queue item. Stop after `TRADING-001`; Tactical Combat requires a new command.
