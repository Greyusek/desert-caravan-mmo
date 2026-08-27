# Checkpoint 48 — KNOWLEDGE-001: provenance-aware world evidence

Version: `0.0.48`

## Goal

Record discovered tracks and caravan remains in player knowledge and an event
journal with explicit source, acquisition time and confidence, without leaking
server truth or adding persistent storage.

## Implemented

- `PlayerWorldEvidenceState` stores coordinate-free entries and journal events
  for one world seed;
- every entry keeps first/latest observation time, current facts, confidence and
  an ordered provenance list;
- direct track clues enter as `probable` with coarse age/direction, while direct
  remains inspection enters as `confirmed` with condition/loot availability;
- accepted observations append exactly one matching journal event;
- repeating the same observation is idempotent and creates neither duplicate
  provenance nor duplicate journal events;
- later observations preserve earlier provenance and update current facts;
- remains conversion deliberately strips position, destruction time, source
  caravan ID and exact loot amounts from player state.

## Automated verification

Seven KNOWLEDGE-001 regressions cover track provenance, coordinate stripping,
journal composition, idempotence, later updates, separate evidence identities
and invalid chronology/state. Repository verification contains 409 tests, all
passing, plus the compiled Checkpoint 48 demo.

## Scope boundary

This is still in-session knowledge. City archives, physical transfer, archive
merging/degradation, database persistence, pricing and production inventory are
separate later checkpoints.
