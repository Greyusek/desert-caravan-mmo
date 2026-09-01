# Manual test — Checkpoint 74 / PLAYER-GLOBAL-001

These commands are written for Git Bash on Windows. Replace
`/d/dev/newWorld` only if your repository is stored elsewhere.

## 1. Switch to the test branch

Stop any running local server with `Ctrl+C`, then run each command in order:

```bash
cd /d/dev/newWorld
git status --short
git fetch origin
git switch feature/player-global-001
git pull --ff-only origin feature/player-global-001
npm ci
npm run player-ui
```

If `git status --short` prints any lines, stop before switching branches and
send that output for investigation. Otherwise open `http://127.0.0.1:4174`.

Expected:

- loading finishes and **Карта и караван** opens;
- South Camp and North Camp appear on a north-up map, with North Camp above
  South Camp;
- the status strip shows South Camp, two members, 250 credits and cargo
  10.2/20;
- food and water show 100 units each;
- no seed, exact coordinate, hidden monster, DEV control or raw JSON appears.

## 2. Check the five map layers

Turn off and on each checkbox: **Города**, **Известные объекты**, **Маршрут**,
**Слухи и угрозы**, **События**.

Expected:

- every checkbox responds independently;
- Cities shows count 2 and hides/restores the two city markers;
- Known objects and Rumors/threats truthfully show count 0;
- Route starts at count 0;
- Events starts at count 1 and hides/restores the event ring;
- changing layers never changes session state, supplies or journal entries.

## 3. Prepare a route

Leave **North Camp** selected and press **Проложить маршрут** once.

Expected:

- state changes to **Маршрут подготовлен** / `Состояние 2`;
- a south-to-north route line appears and Route count becomes 1;
- the caption reports 2 km and 4 min;
- speed shows 10 m/s, distance 2 km and ETA 4 min;
- the button changes to **Отправить караван**;
- the journal opens with two entries, including route preparation.

## 4. Start the journey

Press **Отправить караван** once.

Expected:

- state changes to **В пути** / `Состояние 3`;
- location in the summary changes to **В пути**;
- the route remains visible and its caption says the caravan is travelling;
- the command button becomes disabled and says **Караван в пути**;
- the journal contains three entries, newest first, including departure;
- City and Caravan Preparation navigation becomes unavailable according to the
  projected session state.

## 5. Refresh persistence and separation

Press `F5` once.

Expected: the same local server session remains in **В пути**, with route and
three journal entries intact.

Leave Player UI running. Open a second Git Bash window and run:

```bash
cd /d/dev/newWorld
npm run debug-map
```

Open `http://127.0.0.1:4173`.

Expected: port 4173 is still the privileged Debug Map, while port 4174 remains
the player-facing Caravan Command. Debug-only data never appears on port 4174.

## 6. Return to main after the test

Stop both servers with `Ctrl+C` in their terminals. After the PR has been
merged, run:

```bash
cd /d/dev/newWorld
git switch main
git pull --ff-only origin main
npm run accept:main
```

Expected: `630/630` tests pass, the Checkpoint 74 demo ends successfully and the
working tree remains clean.
