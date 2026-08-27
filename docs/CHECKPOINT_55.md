# Checkpoint 55 — TRADE-001: finite city goods

Version: `0.0.55`

## Goal

Create the smallest deterministic material economy that can later support
stock-driven prices and physical trade routes without replacing the existing
CITY-001/002 state.

## Implemented

- Seven goods: food, water, salt, textiles, ore, medicine and tools.
- Each good has one explicit gameplay role and physical cargo size.
- Food and water start at the exact seeded `CityStocks` quantities.
- Daily consumption is derived from the existing aggregate city population;
  food/water rates preserve the CITY-002 provisional contract.
- Namespaced seeded profiles guarantee at least one surplus and one deficit
  flow per city while keeping every initial stock finite.
- Immutable catch-up from authoritative world time records produced, consumed,
  unmet and remaining units. Direct and staged catch-up are identical.

## Automated verification

The dedicated TRADE-001 suite is `8/8` PASS. Full repository verification is
`466/466` PASS with both TypeScript builds, the compiled Checkpoint 55 demo and
`git diff --check` green.

## Scope boundary

No prices, currency, player transactions, route profit, NPC trading,
information pricing, production chains, tactical cargo grid, persistence or
Tactical Combat are introduced here. `TRADE-002` adds bounded stock-driven
prices over this state.
