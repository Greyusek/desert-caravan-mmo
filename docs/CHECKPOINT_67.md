# Checkpoint 67 — TACTICAL-005 edge-separation retreat

Version: `0.0.67`

## Implemented

- Added deterministic retreat evaluation for either tactical side.
- Every living retreating unit must reach its own battlefield edge.
- Retreat requires a configurable safe Manhattan separation from every living
  enemy and can execute only on the retreating side's turn.
- Successful retreat preserves source identities and current health, returns
  escaped units explicitly and produces zero casualties.
- The opposing side wins the tactical field; cargo/world application remain for
  later checkpoints.

## Acceptance carried forward

- User manually accepted Checkpoint 66 on commit `f9340db`.
- Local acceptance: `550/550` PASS; all survive/destroy/capture scenarios PASS.

## Verification

- Targeted `tactical-retreat.test.mjs`: `8/8` PASS.
- Full `npm run verify:local`: `558/558` PASS; Checkpoint 67 demo PASS.
- `git diff --check`: PASS.

## Next

`TACTICAL-006`: apply survivors, casualties and cargo exactly once to real
caravan and persistent-creature state.
