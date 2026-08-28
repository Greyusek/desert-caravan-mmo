# Manual test — Checkpoint 66 / TACTICAL-004

Run from the repository root after updating `main`:

```bash
npm ci
npm run manual:tactical-cargo
```

## Scenario 1 — cargo survives

Expected block `[SURVIVE]`: both `ore x5` and `medicine x2` remain under
`caravan`; captured and destroyed are empty; conservation ends with `PASS`.

## Scenario 2 — one baggage unit is destroyed

Expected block `[DESTROY]`: ore baggage has `durability=0/6`; `ore x5` appears
only under `destroyed`; `medicine x2` remains under `caravan`; conservation is
still `7 source = 7 accounted — PASS`.

## Scenario 3 — cargo is captured

Expected block `[CAPTURE]`: caravan is empty; both stacks appear under
`captured`; destroyed is empty; conservation ends with `PASS`.

Individual runs are available as:

```bash
npm run manual:tactical-cargo -- survive
npm run manual:tactical-cargo -- destroy
npm run manual:tactical-cargo -- capture
```

Report any mismatch by attaching the complete console output.
