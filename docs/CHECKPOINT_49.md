# Checkpoint 49 — LIBRARY-001: local physical city archives

Version: `0.0.49`

## Goal

Make knowledge physically transferable between a traveller and one local city
archive, while proving that no global synchronization exists.

## Implemented

- player or library knowledge is copied into an explicit
  `PhysicalKnowledgeBundle` carried by one traveller;
- depositing a bundle changes only the selected `CityLibraryArchive`;
- another city remains unaware until a carrier explicitly delivers a bundle;
- deterministic archive merging preserves unique provenance, strongest
  confidence and latest facts independent of bundle order;
- repeating the same physical deposit is idempotent;
- copying knowledge out of a library leaves the local original intact;
- `informationValueUnits` counts novel provenance as an explicit temporary
  exchange stub and is not money, a price model or a trading economy;
- bundles and archives preserve the coordinate-free evidence contract.

## Automated verification

Eight LIBRARY-001 regressions cover physical copy creation, targeted local
deposit, explicit inter-city delivery, provenance merge, repeated-deposit
idempotence, non-destructive archive copy, coordinate secrecy and validation.
Repository verification contains 417 tests, all passing, plus the compiled
Checkpoint 49 demo.

## Scope boundary

No global archive service, automatic replication, database, currency, market
price, cartographer NPC simulation, capacity or production inventory exists.
