# Checkpoint 64 — TACTICAL-002 physical combatants

Version: `0.0.64`

## Implemented

- Added physical tactical units linked to persistent caravan-member or creature
  source identities.
- Added stable collision-free placement in TACTICAL-001 deployment cells.
- Added three compact functional profiles: durable close-range `guard`, mobile
  ranged `skirmisher` and distinct close-range `monster`.
- Initial health derives from each class profile. No movement/attack execution,
  cargo, retreat or world-return logic enters this checkpoint.

## Verification

- Targeted `tactical-unit.test.mjs`: `7/7` PASS.
- Full `npm run verify:local`: `534/534` PASS; Checkpoint 64 demo PASS.
- `git diff --check`: PASS.

## Next

`TACTICAL-003`: validated turn-based movement, attacks, damage, defeat and battle
completion over these units.
