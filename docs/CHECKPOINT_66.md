# Checkpoint 66 — TACTICAL-004 physical cargo consequences

Version: `0.0.66`

## Implemented

- Converts each existing `TradeCargoHold` stack into one physical baggage unit
  in an unoccupied caravan deployment cell.
- Baggage keeps the exact good, units and cost basis from Trading Prototype.
- Explicit baggage damage can destroy a physical stack.
- Caravan victory preserves intact stacks; hostile victory captures intact
  stacks; destroyed stacks go to neither side.
- A per-good conservation report proves source equals survived + captured +
  destroyed without creating cargo.

## Verification

- Targeted `tactical-cargo.test.mjs`: `7/7` PASS.
- Full `npm run verify:local`: `550/550` PASS; Checkpoint 66 demo PASS.
- Manual survive/destroy/capture runner: PASS; all three conservation checks PASS.
- `git diff --check`: PASS.

## Manual acceptance

See [`MANUAL_TEST_CHECKPOINT_66.md`](MANUAL_TEST_CHECKPOINT_66.md).

## Next

Pause for requested intermediate local acceptance. After acceptance,
`TACTICAL-005` adds retreat through edge separation only.
