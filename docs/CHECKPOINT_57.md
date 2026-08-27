# Checkpoint 57 — TRADE-003: physical player trade route

Version: `0.0.57`

## Goal

Prove the complete material player loop from a local purchase through physical
movement to a destination sale and measured profit or loss.

## Implemented

- Caravan wallet and finite cargo capacity measured from per-good cargo size.
- Cargo stacks retain quantity and purchase cost basis.
- A purchase uses the current TRADE-002 city sell quote and changes that same
  city's stock, wallet, cargo and journal.
- Stock, money and capacity checks reject impossible loading.
- Departure requires a real `RoutePlan` whose endpoints lie inside the selected
  origin and destination cities.
- Route position is derived from SIM-005; arrival before exact ETA is rejected.
- Destination sale uses its current local quote, changes its stock, unloads the
  cargo and records revenue, cost basis and realized profit/loss.
- The ordered journal contains purchase, departure, arrival and sale events.

## Automated verification

The dedicated TRADE-003 suite is `10/10` PASS. Full repository verification is
`482/482` PASS with both TypeScript builds, the compiled Checkpoint 57 demo and
`git diff --check` green.

## Scope boundary

No NPC trader, information price, tactical wagon cells, cargo interception,
production chain, persistence or Tactical Combat is added. `TRADE-004` applies
the same market and physical route operations to an NPC trader.
