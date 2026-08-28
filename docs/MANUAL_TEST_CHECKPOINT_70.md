# Manual test — Checkpoint 70 / UI-008

Run from the repository root after updating `main`:

```bash
npm ci
npm run debug-map
```

Open `http://127.0.0.1:4173` and scroll to **«Авторитетный PvE-бой»** between
the Trading Prototype and the world map.

## Test 1 — battlefield and physical objects

- The field contains 12 columns × 8 rows.
- The two left columns are the caravan deployment zone; the two right columns
  are the hostile deployment zone.
- Final markers are: living `G` at `(5,0)`, defeated monster at `(6,0)` and
  defeated skirmisher at `(6,1)`.
- Two cyan `B` baggage markers remain at `(0,2)` and `(0,3)`.

## Test 2 — units and authoritative event journal

- The unit list shows guard, skirmisher and monster with their real source IDs,
  initial/final cells and HP. The guard ends at `6/12`; the other two are `0`.
- The command/event card reads `17 / 17`.
- Its scrollable journal includes MOVE, ATTACK and one WAIT, each paired with a
  resolved `moved`, `damage/defeated` or `waited` event.

## Test 3 — consequences, cargo and world return

- The heading says the caravan won after 17 commands.
- Survivor is `ui-member-guard`; casualties are the skirmisher and persistent
  monster source IDs.
- Caravan cargo contains `ore ×5, medicine ×2`; captured and destroyed cargo
  are empty; `Conservation` is `PASS`.
- `World apply` contains exactly one `ui-008-battle:<seed>` ID and the creature
  is `dead · 0/10 HP`.

## Test 4 — deterministic seed rebuild

Change **Seed мира** to `manual-ui-008` and press **«Построить»**.

- Battlefield ID and `World apply` battle ID must change.
- The 12×8 geometry, markers, 17/17 journal, winner, casualties and cargo must
  remain identical.
- No error banner should appear.

Stop the server with `Ctrl+C`. Report any mismatch with a screenshot of the
tactical panel and the complete terminal output.
