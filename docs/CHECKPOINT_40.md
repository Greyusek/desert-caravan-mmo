# Checkpoint 40 — GAME-023: moving avoidance across patrols

Version: `0.0.40`

## Goal

Execute moving `AVOID | CONTINUE` from the first authoritative 1000 m warning
selected across several cyclic patrols. Accept an AVOID continuation only when
the complete timed route is continuously clear of every patrol, without
changing the established first-boundary and stable identity rules.

## Implemented

- `planExpeditionMonsterDangerResponseAmongPatrols(...)` reuses the GAME-022
  aggregate warning as the one authoritative doctrine trigger;
- a contact from any patrol at the same or an earlier instant keeps priority
  and blocks danger-doctrine execution;
- `CONTINUE` returns the original route object and preserves the stable first
  contact selected by time and then raw monster ID;
- `AVOID` generates the existing deterministic one-waypoint candidates around
  the warning patrol, then checks each complete timed route through the
  continuous contact solver for every patrol;
- the shortest configured candidate is accepted only when every check returns
  clear; otherwise the result is `detour-unavailable` and the original route
  remains effective;
- duplicate IDs remain invalid, empty patrol sets remain deterministic and
  patrol input order cannot affect the selected warning, contact or detour;
- the debug-map moving intercept flow evaluates both generated patrols,
  displays the trigger and full clearance set, and executes contact against the
  stable winning patrol when `CONTINUE` is selected;
- the scheduled discovery-STOP doctrine remains explicitly scoped to the
  selected QA patrol and is not presented as multi-patrol-safe.

## Manual acceptance

Run:

```bash
npm run debug-map
```

Open `http://127.0.0.1:4173` and:

1. Keep **AVOID** selected and press **DEV: маршрут на перехват**. Confirm that
   the GAME-023 panel names the first warning patrol and lists both patrols in
   the clearance set.
2. Advance to the exact 1000 m decision, then advance again to the end of the
   detour. The journal must contain `danger-detected` followed by
   `danger-doctrine-decision`, with no patrol contact.
3. Select **CONTINUE**, prepare the intercept again and advance. The original
   route and stable first 500 m contact must remain unchanged.
4. Select **STOP** and press **DEV: опасность во время STOP**. Confirm that the
   panel labels this older path as selected-QA-patrol clearance rather than
   claiming all-patrol safety.

The compiled demo prints the stable trigger, sorted clearance IDs, selected
side and absence of contact after a successful multi-patrol detour:

```bash
npm run demo
```

## Automated verification

Eight simulation-core regressions cover stable CONTINUE arbitration,
all-patrol AVOID clearance, rejection by a second patrol, contact priority,
input permutation, patrol-cycle delay, warning-only near passes, empty sets and
duplicate IDs. Two debug-map regressions cover moving all-patrol avoidance and
stable CONTINUE contact presentation. Repository verification contains 356
tests: 351 simulation/UI tests plus 5 tooling tests.

## Scope boundary

GAME-023 covers uninterrupted movement only. The scheduled discovery `STOP`
path still plans against one selected patrol; multi-patrol STOP composition is
GAME-024. Pursuit, arbitrary pathfinding and tactical combat also remain out
of scope.
