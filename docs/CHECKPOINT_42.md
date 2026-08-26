# Checkpoint 42 — GAME-025: authoritative multi-patrol contact

Version: `0.0.42`

## Goal

Promote stable first-contact selection from planner-internal logic into the
public expedition contact/outcome path. Preserve first-boundary priority and
resolve no more than one patrol contact in one evaluation slice.

## Implemented

- `findFirstExpeditionMonsterContactAmongPatrols(...)` exposes one first moving
  contact across the complete patrol set;
- `findFirstExpeditionMonsterContactWithIdleStopAmongPatrols(...)` applies the
  same contract to moving/idle/moving execution around a scheduled discovery
  `STOP`;
- earlier absolute world time wins, while candidates inside the encounter
  solver tolerance use raw monster-ID ordering independently of input order;
- empty patrol sets return no contact and duplicate IDs remain invalid;
- GAME-023/024 danger planners reuse the public aggregate contact API instead
  of a private selector;
- the debug map creates one aggregate contact snapshot and passes only that
  contact into the existing outcome, Power/FLEE and journal path;
- depletion, doctrine, arrival and danger boundaries at the same or earlier
  instant retain their existing priority;
- the patrol selector remains a presentation and QA-control surface, not the
  authority that chooses which contact executes.

## Manual acceptance

Run:

```bash
npm run debug-map
```

Open `http://127.0.0.1:4173` and use **DEV: маршрут на перехват** with
`CONTINUE`. Advance to contact. The contact panel, world marker and journal must
name the same first patrol, and the journal must contain exactly one
`monster-contact` event for the slice. Repeat the scheduled-STOP CONTINUE path;
world time advances through the wait while route time remains pinned, with the
same single-contact rule.

The compiled demo prints stable raw-ID arbitration and explicitly reports one
resolved contact:

```bash
npm run demo
```

## Automated verification

Four simulation-core regressions cover earliest moving contact, raw-ID ties,
scheduled-STOP arbitration, empty sets and duplicate identities. Two debug-map
regressions cover single-contact outcome/journal execution and preservation of
an earlier expedition boundary. Repository verification contains 372 tests:
367 simulation/UI tests plus 5 tooling tests.

## MVP 0.1 boundary

GAME-025 completes the agreed MVP 0.1 implementation block. Repeated sequential
contacts, pursuit, arbitrary pathfinding, persistence, production physical-map
ownership, tactical combat and MVP-1 remain outside this checkpoint and are not
started automatically.
