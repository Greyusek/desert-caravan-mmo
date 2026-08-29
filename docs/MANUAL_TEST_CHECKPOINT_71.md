# Manual test — Checkpoint 71 / COMBAT-001

Run from the repository root after installing dependencies.

## 1. Complete CLI scenario

```bash
npm run manual:combat
```

Expected:

- the route is `combat-origin->combat-destination`, 2000 m, ETA 200 s;
- a real `combat-monster` contact appears near T=92.929 s and 100 m;
- `commands/events=17/17`, winner is `caravan`;
- the guard is alive at 6 HP, the skirmisher and creature are dead;
- ore ×5 and medicine ×2 remain, conservation is PASS, world apply is once;
- the route resumes by 300 m, arrives at `combat-destination`, and the journal
  is `departure->arrival`;
- the last line is `COMBAT-001 manual assertions — PASS`.

## 2. Tactical browser projection

```bash
npm run debug-map
```

Open `http://127.0.0.1:4173`, then scroll to **Tactical Combat · DEV Projection**.

Expected:

- a 12×8 field shows the guard, skirmisher, monster and two baggage markers;
- the command/event counter is `17 / 17` and no browser error appears;
- result is `Караван победил · 17 команд`;
- losses list `combat-member-skirmisher` and `persistent-combat-monster`;
- cargo lists ore ×5 and medicine ×2; captured/destroyed are empty;
- `Conservation` is PASS and `World apply` contains one battle ID;
- `Маршрут после боя` is moving with `+300 м`;
- `Прибытие` is arrived at `combat-destination` and `Global journal` shows
  `departure → arrival`.

## 3. Seed replay

Change **World seed** to `manual-combat-a`, note the battlefield and battle IDs,
then change it to `manual-combat-b`.

Expected:

- battlefield and battle IDs change;
- field geometry, units, 17 commands/events, casualties, cargo, +300 m resume
  and destination arrival remain identical;
- returning to `manual-combat-a` restores its original IDs.

## 4. Full local verification

Stop the debug server with `Ctrl+C`, then run:

```bash
npm run verify:local
git diff --check
```

Expected: `594/594` tests pass, the Checkpoint 71 demo ends successfully and
`git diff --check` prints no errors.
