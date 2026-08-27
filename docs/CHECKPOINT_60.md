# Checkpoint 60 — INFO-TRADE-002: constrained degrading copies

Version: `0.0.60`

## Goal

Prevent copied or recovered information from resetting to pristine research
quality, preserving the economic reason to explore and confirm the world.

## Implemented

- One physical bundle carries at most three knowledge entries.
- Direct physical copying is limited to two generations.
- Traveller originals start at fidelity `1.0`; city-library copies start at
  `0.85`; each direct physical copy multiplies inherited fidelity by `0.8`.
- Physical carrier age independently reduces medium fidelity after 7/30/90 days.
- INFO-TRADE-001 value now includes the effective bundle-fidelity multiplier in
  addition to observation age and local novelty.
- Fallen-library fragments multiply city-copy fidelity by the existing
  LIBRARY-002 completeness projection, so archive decay survives extraction.
- Known identical information remains worth zero at every fidelity.

## Automated verification

The dedicated INFO-TRADE-002 suite is `8/8` PASS. Full repository verification
is `504/504` PASS with both TypeScript builds, the compiled Checkpoint 60 demo
and `git diff --check` green.

## Scope boundary

No DRM, cryptography, paper/ink crafting, production database, global archive
or Tactical Combat is added. UI-007 exposes the completed material and
information economy in the existing debug map.
