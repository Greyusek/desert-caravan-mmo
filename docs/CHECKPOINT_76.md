# Checkpoint 76 — PLAYER-PREP-001 Caravan Preparation / Tactical Formation

Version: `0.0.76`

## Implemented

- Replaces the Caravan placeholder with a functional preparation screen while
  leaving battle and result views for their own checkpoints.
- Presents the two existing caravan members with their combat roles, health,
  movement, attack range and damage from the authoritative tactical unit model.
- Presents food, water, used/free cargo capacity and every current physical
  goods stack without creating a parallel browser inventory.
- Reuses `deployTacticalCargo` to place current market cargo around the existing
  combatants in the real caravan deployment zone.
- Projects only the two-column caravan zone. Hostile placement, encounter data,
  field identity, seed, internal source IDs and cargo cost basis remain private.
- Marks the accepted formation as fixed because the current tactical core does
  not expose a validated pre-battle reposition command. The UI does not invent
  one; this exact deployment becomes the input boundary for PLAYER-BATTLE-001.
- Keeps the preparation screen unavailable once the journey starts and
  preserves the separate Debug UI, Global Map and City flows.

## Verification

- Dedicated PLAYER-PREP-001 additions: `9/9` PASS.
- Full `npm run verify:local`: `649/649` PASS.
- Player and Debug UI HTTP smoke: PASS.
- Player UI preparation HTML, model and session projection smoke: PASS.
- `git diff --check`: PASS.

## Manual review

See [`MANUAL_TEST_CHECKPOINT_76.md`](MANUAL_TEST_CHECKPOINT_76.md) for exact
main update, launch and Caravan preparation checks.

## Next

`PLAYER-BATTLE-001`: implement the readable 2D battle scene, projected legal
actions, authoritative manual commands and minimal supported auto/manual control.
