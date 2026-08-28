# Checkpoint 69 — TACTICAL-007 PvE contact migration

Version: `0.0.69`

## Implemented

- Adds one explicit `TACTICAL | LEGACY_POWER` resolver for existing
  authoritative `ExpeditionMonsterContact` values; tactical is the default.
- Validates contact monster identity and Power against the same persistent
  creature before creating a deterministic battlefield.
- Re-deploys every living caravan member and the contacted creature with stable
  command IDs while preserving current health and source identity.
- Executes only existing tactical commands, requires a complete battle, then
  conserves cargo and applies survivors, casualties and winner exactly once to
  the global world state.
- Keeps `resolveMonsterPowerContact` unchanged and reachable only through the
  explicit `LEGACY_POWER` compatibility mode in the new resolver.
- Adds manual tactical-win, tactical-loss and legacy scenarios.

## Verification

- Dedicated TACTICAL-007 suite: `9/9` PASS.
- GAME-005/006 plus TACTICAL-006/007 regression group: `29/29` PASS.
- Full `npm run verify:local`: `574/574` PASS; Checkpoint 69 demo PASS.
- `npm run manual:tactical-pve`: all three scenarios PASS.
- `git diff --check`: PASS.

## Next

`UI-008`: project this same tactical contact, units, baggage, commands, events,
casualties, winner, cargo outcome and world return in the existing debug map.
