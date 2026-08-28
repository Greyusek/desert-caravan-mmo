# Manual test — Checkpoint 69 / TACTICAL-007

Run from the repository root after updating `main`:

```bash
npm ci
npm run manual:tactical-pve
```

## Scenario 1 — tactical victory is the default

Expected block `[TACTICAL-WIN]`: the caravan wins, the monster is dead,
`ore x5` remains in caravan cargo and the block ends with
`world-return=once; cargo-conservation=PASS`.

## Scenario 2 — tactical loss returns consequences

Expected block `[TACTICAL-LOSS]`: hostile wins, status is
`expedition-defeated`, the caravan member is dead, caravan cargo is empty and
`ore x5` is captured. The block still ends with both return/conservation PASS.

## Scenario 3 — Power is explicit legacy only

Expected block `[LEGACY]`: mode is `LEGACY_POWER`, the existing Power result is
`monster-defeated`, and both battlefield and world return are `none`.

Individual runs are available as:

```bash
npm run manual:tactical-pve -- tactical-win
npm run manual:tactical-pve -- tactical-loss
npm run manual:tactical-pve -- legacy
```

For an additional deterministic regression check:

```bash
node --test packages/sim-core/tests/pve-contact-resolution.test.mjs
```

It must report `9` tests, `9` pass and `0` fail. Report any mismatch by
attaching the complete console output.
