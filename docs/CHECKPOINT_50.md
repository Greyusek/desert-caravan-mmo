# Checkpoint 50 — LIBRARY-002: fallen-city archive degradation

Version: `0.0.50`

## Goal

Keep a fallen city's library physically discoverable while its accumulated
information loses completeness, precision, readability and actuality over
authoritative world time.

## Implemented

- a city fall snapshots the local archive into a permanent world object at the
  city's exact server-side position;
- completeness declines linearly to zero over 30 game days;
- readability moves from `clear` to `fragmentary` to `illegible`;
- actuality becomes `stale` after seven days and `obsolete` at full loss;
- confirmed information downgrades to `probable` below 50% completeness;
- still-readable entries can be extracted only as a physical carrier bundle;
- after complete information loss the ruined library stays permanently present
  and discoverable;
- projection and extraction do not mutate the original archive snapshot.

## Automated verification

Seven LIBRARY-002 regressions cover permanent fall object creation, fresh state,
multi-axis degradation, ruined persistence, physical fragment extraction,
immutability and chronology/identity validation. Repository verification
contains 424 tests, all passing, plus the compiled Checkpoint 50 demo.

## Scope boundary

No ruined-city combat, cartographer AI, database, automatic replication,
restoration mechanic, market pricing or global knowledge service is introduced.
