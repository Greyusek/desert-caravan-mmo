# Manual test — Checkpoint 72 / PLAYER-PROJECTION-001

Run from the repository root after installing dependencies. This checkpoint is
the safe data/action boundary; the standalone visual Player UI starts in the
next checkpoint.

## 1. Complete player-session transition

```bash
npm run manual:player-projection
```

Expected:

- initial phase is `city`, current place is `place:south-camp`, and the only
  action is `SELECT_DESTINATION`;
- the known map is `north-up` and uses local `E/N` metre offsets only;
- the caravan shows 250 credits, 10.2/20 cargo and two public member refs;
- the market exposes exactly four fields per quote;
- the planned route is 2000 m / 200 s and enables `START_JOURNEY`;
- travel becomes `moving`, city becomes `null`, and journal order is
  `session-ready->route-planned->departure`;
- all three final assertions report `PASS`.

## 2. Server-truth boundary

Inspect the same command output.

Expected:

- `private controller serialization={}` is `PASS`;
- the forbidden server-truth scan is `PASS`;
- output contains no latitude/longitude, hidden creature/patrol, battlefield or
  battle ID, cargo cost basis, scarcity multiplier or seed value.

## 3. Deterministic replay

Run the same explicit input twice:

```bash
npm run manual:player-projection -- manual-replay-a
npm run manual:player-projection -- manual-replay-a
```

Expected: both outputs are identical, including the first market quote, route,
cargo, members and journal. Then run:

```bash
npm run manual:player-projection -- manual-replay-b
```

Expected: the seeded market sample may change, while the allow-listed shape,
route/action transitions and all assertions remain stable.

## 4. Full local verification

```bash
npm run verify:local
git diff --check
```

Expected: `606/606` tests pass, the demo ends with Checkpoint 72 complete, and
`git diff --check` prints no errors.
