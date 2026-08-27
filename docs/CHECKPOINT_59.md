# Checkpoint 59 — INFO-TRADE-001: local information value

Version: `0.0.59`

## Goal

Turn the existing physical knowledge bundle and local archive into a real,
transparent information commodity without introducing a global information
currency or coordinate leak.

## Valuation

Each entry quote exposes:

- novelty for this exact target archive (new entry, novel observation or known);
- accuracy from the existing coordinate-free fact granularity and confidence;
- age from the latest observation (`1.0 / 0.8 / 0.5 / 0.2` bands);
- confirmation quality and count of distinct provenance observations;
- strategic base value (`caravan-remains` above ordinary `caravan-track`).

An identical observation already known to this library is worth zero. The same
physical bundle can remain valuable at another city whose archive does not know
it. Sale pays the deterministic quote and delegates archive mutation to the
existing idempotent local `depositKnowledgeBundle` operation.

## Automated verification

The dedicated INFO-TRADE-001 suite is `8/8` PASS. Full repository verification
is `496/496` PASS with both TypeScript builds, the compiled Checkpoint 59 demo
and `git diff --check` green.

## Scope boundary

Copy-count constraints and bundle fidelity degradation remain INFO-TRADE-002.
No global archive synchronization, abstract information currency, database,
neural agent or Tactical Combat is added.
