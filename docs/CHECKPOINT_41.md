# Checkpoint 41 — GAME-024: multi-patrol avoidance during STOP

Version: `0.0.41`

## Goal

Compose the stable first danger warning across several cyclic patrols with one
scheduled discovery `STOP`. Preserve exact world/route time and first-boundary
priority, and accept an AVOID departure only when its complete continuation is
continuously clear of every patrol.

## Implemented

- `planExpeditionMonsterDangerResponseDuringIdleStopAmongPatrols(...)` uses the
  GAME-022 aggregate idle warning as the single authoritative trigger;
- warning and contact candidates keep earliest-time then raw monster-ID
  ordering independently of caller array order;
- a contact from any patrol or a caller-supplied boundary at the same or an
  earlier expedition instant blocks doctrine execution;
- `CONTINUE` returns the original route object, retains the complete scheduled
  wait and preserves the stable first contact;
- `AVOID` retains the executed route prefix, cancels only the unelapsed wait,
  departs from the exact STOP coordinate and validates every deterministic
  continuation against every patrol from the actual world departure time;
- an accepted plan records the effective idle duration and completion in world
  time; an unavailable detour preserves the original route and full wait;
- duplicate patrol IDs remain invalid, empty patrol sets remain deterministic,
  and a complete patrol-cycle delay preserves route geometry;
- the debug-map STOP flow now uses both generated patrols for warning, contact,
  doctrine execution, route clearance, journal execution and contact focus.

## Manual acceptance

Run:

```bash
npm run debug-map
```

Open `http://127.0.0.1:4173` and:

1. Select **STOP** and **AVOID**, then press **DEV: опасность во время STOP**.
   The GAME-024 panel must name the first warning patrol and state that the
   departure is checked against both patrols.
2. Advance to the exact warning. World time must advance while route time stays
   pinned; only the remaining wait is cancelled.
3. Advance to the detour finish. The journal must contain `danger-detected`,
   `danger-doctrine-decision` and the `danger-avoidance` resume provenance,
   without a patrol contact.
4. Repeat with **CONTINUE**. The full scheduled wait and stable first 500 m
   contact must remain unchanged.

The compiled demo prints the stable trigger, sorted clearance IDs, exact
world/route times, truncated idle duration and absence of contact after AVOID:

```bash
npm run demo
```

## Automated verification

Eight simulation-core regressions cover stable CONTINUE, exact STOP departure,
all-patrol clearance, rejection by another patrol, contact and earlier-boundary
priority, input permutation, patrol-cycle delay, empty sets and duplicate IDs.
Two debug-map regressions cover all-patrol STOP AVOID and stable STOP CONTINUE.
Repository verification contains 366 tests: 361 simulation/UI tests plus 5
tooling tests.

## Scope boundary

GAME-024 resolves one danger decision and still relies on a planner-internal
aggregate contact selection. GAME-025 will expose stable multi-patrol contact
selection through the authoritative expedition contact/outcome API. Repeated
contacts, pursuit, arbitrary pathfinding and tactical combat remain out of
scope.
