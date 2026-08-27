# Checkpoint 56 — TRADE-002: stock-driven local prices

Version: `0.0.56`

## Goal

Prove a direct deterministic connection from local stock and demand to the
price seen by later player and NPC transactions.

## Formula

1. `targetStock = dailyConsumption × 30 days`.
2. `scarcity = clamp(targetStock / currentStock, 0.5, 3.0)`; empty stock uses
   the maximum multiplier.
3. `localValue = referencePrice × scarcity`.
4. The city buys at `floor(localValue × 0.9)` and sells at
   `ceil(localValue × 1.1)`, with a minimum one-credit spread.

The formula uses no random price roll. TRADE-001 production, consumption and
transactions in later checkpoints change `currentStock`, therefore changing
the next quote.

## Automated verification

The dedicated TRADE-002 suite is `6/6` PASS. Full repository verification is
`472/472` PASS with both TypeScript builds, the compiled Checkpoint 56 demo and
`git diff --check` green.

## Scope boundary

No wallet, transaction, cargo mutation, route settlement, NPC trader or
information price is added here. `TRADE-003` consumes these quotes through one
capacity-limited physical caravan route.
