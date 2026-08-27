# Checkpoint 61 — UI-007: Trading Prototype debug projection

Version: `0.0.61`

## Goal

Make the implemented material and information economy visually inspectable in
the existing developer map before closing Stage 3 end to end.

## Implemented

- A compact Trading Prototype panel extends the dependency-free debug map
  without a redesign or UI framework.
- Both selected cities show all seven finite goods, daily production and
  consumption, stocks and local buy/sell quotes.
- The player card shows capacity usage, loaded cargo, wallet movement, the
  physical route result, realized profit and purchase/departure/arrival/sale
  journal.
- The NPC card proves a second trader uses the same physical operations and
  changes the next destination price.
- The information card contrasts a novel local quote, a zero-value known
  duplicate and a lower-fidelity physical copy.
- One seed-bound `createTradingDebugSnapshot` composes sim-core operations;
  browser rendering contains no parallel economy or pricing formula.

## Automated verification

The dedicated UI-007 additions are `6/6` PASS. Full repository verification is
`510/510` PASS with both TypeScript builds, the compiled Checkpoint 61 demo and
`git diff --check` green.

## Scope boundary

The panel is a deterministic developer proof, not production UX. It adds no
server/database, persistence, automatic optimization, production chains,
multiplayer or Tactical Combat. `TRADING-001` remains the only Stage 3 closure
checkpoint.
