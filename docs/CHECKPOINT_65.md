# Checkpoint 65 — TACTICAL-003 deterministic combat rules

Version: `0.0.65`

## Implemented

- Added one immutable authoritative battle state with alternating side turns.
- Added validated `MOVE`, `ATTACK` and `WAIT` commands.
- Movement uses class allowance, battlefield bounds and physical occupancy.
- Attacks use Manhattan range, explicit class damage, health and permanent
  tactical defeat at zero health.
- Battle completes when one side has no living combatants and records a stable
  ordered event journal. No randomness or browser-side formulas are used.

## Verification

- Targeted `tactical-combat.test.mjs`: `8/8` PASS.
- Full `npm run verify:local`: `542/542` PASS; Checkpoint 65 demo PASS.
- `git diff --check`: PASS.

## Next

`TACTICAL-004`: represent existing trade cargo as physical baggage units and
resolve conserved surviving, destroyed or captured stacks.
