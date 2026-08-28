# Checkpoint 68 — TACTICAL-006 authoritative world return

Version: `0.0.68`

## Implemented

- Composes one authoritative combat-world state from the existing trade
  caravan, caravan-member source IDs and existing persistent creature state.
- Applies tactical health, survivors and casualties back to those same source
  identities.
- Replaces caravan cargo with the exact TACTICAL-004 conserved outcome and
  records captured/destroyed stacks.
- Uses battle ID as an idempotency key; repeated application is rejected.
- Dead members or creatures cannot reappear in a later battle application.

## Verification

- Targeted `tactical-world-return.test.mjs`: `7/7` PASS.
- Full `npm run verify:local`: `565/565` PASS; Checkpoint 68 demo PASS.
- `git diff --check`: PASS.

## Next

`TACTICAL-007`: migrate existing PvE monster contacts through this tactical
core while retaining an explicit legacy Power compatibility path.
