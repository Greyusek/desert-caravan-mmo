# Manual test — Checkpoint 73 / PLAYER-SHELL-001

Run from the repository root after installing dependencies.

## 1. Open the standalone Player UI

```bash
npm run player-ui
```

Open `http://127.0.0.1:4174`.

Expected:

- the page title is **Desert Caravan MMO — Caravan Command**;
- the first screen is **Карта и караван**;
- header status shows connection and `Состояние 1`;
- the summary shows South Camp, two members, 250 credits and cargo 10.2/20;
- there is no seed field, world-time slider, hidden object, exact coordinate,
  development button or raw JSON.

## 2. Navigation availability

Click **Город**, **Караван**, then **Карта**.

Expected:

- each available button changes the large screen title and selected copper mark;
- **Бой** and **Итоги** are visibly muted and cannot be clicked;
- hovering a disabled item explains why it is not available;
- changing presentation screens does not change credits, cargo or session state.

## 3. Player UI and Debug UI separation

Leave Player UI running. Open a second terminal and run:

```bash
npm run debug-map
```

Open `http://127.0.0.1:4173` beside Player UI at
`http://127.0.0.1:4174`.

Expected:

- port 4174 remains the restrained Caravan Command interface;
- port 4173 remains the existing clearly marked Debug Map;
- seed, exact coordinates, hidden entities and development controls exist only
  in Debug Map;
- neither application redirects to or visually masquerades as the other.

## 4. Narrow-window and keyboard check

Resize Player UI below roughly 980 px, then below 640 px. Use `Tab` and
`Shift+Tab` to move through available navigation.

Expected:

- side navigation becomes a compact top grid without horizontal overflow;
- the three summary cells stack on a narrow phone-sized window;
- focus is clearly visible around links and buttons;
- disabled battle/result controls are skipped by keyboard activation;
- the page remains readable without animation when reduced motion is enabled in
  the operating system.

## 5. Full local acceptance

Stop both servers with `Ctrl+C`, then run:

```bash
npm run accept:main
```

Expected: `619/619` tests pass, the Checkpoint 73 demo ends successfully and the
working tree remains clean.
