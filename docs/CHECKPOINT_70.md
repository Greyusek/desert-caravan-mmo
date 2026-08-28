# Checkpoint 70 — UI-008 tactical debug projection

Version: `0.0.70`

## Implemented

- Adds one responsive Tactical Combat panel to the existing dependency-free
  debug map without introducing a UI framework or production-player UX.
- `createTacticalDebugSnapshot(seed)` creates a real expedition contact and
  resolves it through the TACTICAL-007 API, then exposes only resolved data.
- Renders all 12×8 cells and both deployment zones, final source-linked guard,
  skirmisher and monster positions/health, plus both physical baggage units.
- Pairs every fixed MOVE/ATTACK/WAIT command with its authoritative sim-core
  event and shows damage, defeat and turn progression.
- Projects winner, survivors, casualties, cargo conservation and exactly-once
  world application. `main.js` imports no combat, cargo or world-return solver.
- Changing the world seed changes battlefield/battle identities while the same
  fixed action contract reproduces the same layout and consequences.

## Verification

- Dedicated UI-008 snapshot/browser-boundary additions: `8/8` PASS.
- Debug-map and tooling group: `142/142` PASS.
- Full `npm run verify:local`: `582/582` PASS; Checkpoint 70 demo PASS.
- Local debug server asset/content-type smoke test: PASS.
- `git diff --check`: PASS.

## Manual review

See [`MANUAL_TEST_CHECKPOINT_70.md`](MANUAL_TEST_CHECKPOINT_70.md) for the field,
unit, event, consequence and seed-change checks.

## Next

`COMBAT-001`: compose one final seeded global contact → tactical battle →
persistent consequence → continued global-simulation proof and close Stage 4.
