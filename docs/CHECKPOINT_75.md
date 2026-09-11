# Checkpoint 75 — PLAYER-CITY-001 City / Market / Information

Version: `0.0.75`

## Implemented

- Replaces the City placeholder with a functional player-facing market and
  local library while leaving preparation, battle and result views for their
  own checkpoints.
- Projects all seven existing finite city goods with local stock, caravan-owned
  quantity, bid/ask price and the exact total for one supported transaction.
- Executes each purchase and sale through the existing authoritative
  `buyGoodFromCity` / `sellGoodToCity` operations. Wallet, city stock, physical
  cargo, free capacity, legal actions and journal update together.
- Carries one deterministic physical field-notes bundle into the session and
  projects only its player-known evidence type, provenance, confidence,
  fidelity and local library value.
- Executes information transfer through the existing
  `sellKnowledgeBundleToLibrary` operation, pays the quoted value, removes the
  physical carrier and records the local archive deposit exactly once.
- Keeps internal city IDs, bundle IDs, evidence identities, world seed,
  coordinates, market formula inputs and cargo cost basis outside the browser.
- Keeps Debug UI separate and preserves the Global Map route flow.

## Verification

- Dedicated PLAYER-CITY-001 additions: `10/10` PASS.
- Full `npm run verify:local`: `640/640` PASS.
- Player UI HTTP market and information state transitions: PASS.
- Rejected city actions preserve the current session revision: PASS.
- `git diff --check`: PASS.

## Manual review

See [`MANUAL_TEST_CHECKPOINT_75.md`](MANUAL_TEST_CHECKPOINT_75.md) for exact
main update, launch and City transaction checks.

## Next

`PLAYER-PREP-001`: implement caravan preparation and the tactical formation
view using existing cargo and validated deployment capabilities.
