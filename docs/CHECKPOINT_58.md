# Checkpoint 58 — TRADE-004: NPC trader market impact

Version: `0.0.58`

## Goal

Prove that an NPC trader is a physical participant in the same market rather
than a decorative or parallel economy.

## Implemented

- One deterministic NPC trade order orchestrates the public TRADE-003 actions.
- The NPC buys at the origin's current quote, consumes finite capacity and
  changes the origin stock.
- The loaded NPC is projected halfway through the same physical `RoutePlan`.
- The NPC cannot sell until the exact destination ETA.
- Destination production/consumption catches up to arrival time before sale.
- The sale changes the same destination stock and quote later visible to the
  player; NPC journal and cost-basis profit are unchanged from player rules.

## Automated verification

The dedicated TRADE-004 suite is `6/6` PASS. Full repository verification is
`488/488` PASS with both TypeScript builds, the compiled Checkpoint 58 demo and
`git diff --check` green.

## Scope boundary

No NPC personality, autonomous long-term planner, neural agent, fake market,
information price, persistence or Tactical Combat is added. `INFO-TRADE-001`
now prices existing physical knowledge against one local library.
