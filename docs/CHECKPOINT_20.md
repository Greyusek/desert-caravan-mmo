# Checkpoint 20 — UI-005: deterministic simulation clock

Version: `0.0.20`

## Goal

Run the complete expedition loop from the debug map without repeatedly dragging the time slider, while keeping the existing authoritative simulation boundary and deterministic `elapsedSeconds` contract unchanged.

## Implemented

- accessible Play/Pause control beside the existing simulation-time slider;
- explicit x1, x10, x100 and x1000 development speeds, with x1000 selected by default for short QA runs;
- wall-clock time is converted into simulation time by a pure, validated mapping function;
- every animation frame is evaluated from one stable play anchor, so the result at a given wall-clock timestamp does not depend on how many frames the browser rendered;
- Pause synchronizes the last wall-clock interval before freezing the exact simulation instant;
- changing speed while running first preserves elapsed time, then rebases the clock without a jump;
- playback clamps exactly to the first planned expedition boundary and stops automatically without overshoot;
- arrival, fatal depletion, discovery STOP, monster defeat and route end therefore retain their existing precedence rules;
- a weak-monster victory or successful FLEE remains non-terminal and playback continues toward the later authoritative boundary;
- manual time-slider input pauses playback so the clock does not compete with direct inspection;
- seed, route, supplies and QA-preset changes pause and reset time; doctrine changes pause before recalculating the boundary;
- terminal and paused outcomes disable Play until the expedition is explicitly repeated or its inputs are changed;
- the control exposes running, paused and boundary-reached states in visible text and ARIA state.

## Running locally

```bash
npm run debug-map
```

Open `http://127.0.0.1:4173`.

1. Select start and destination cities and press **DEV: маршрут в город**.
2. Keep x1000 and press **Запустить**. The time, caravan position, supplies and event log must advance without slider input.
3. Press **Пауза**, remember the displayed time, wait and confirm that it stays unchanged.
4. Resume and switch between x1, x10, x100 and x1000. Time must continue from the same instant without jumping backwards.
5. Let the expedition reach its planned arrival or another earlier boundary. Playback must stop automatically at the exact planned time.
6. Repeat with insufficient food or water, discovery `STOP`, and a terminal PWR 110 encounter. None may overshoot its authoritative boundary.

## Automated verification

Seven focused UI-005 regressions cover the exact speed set, wall-to-simulation scaling at every multiplier, frame-sampling independence, exact boundary clamping, pre-boundary continuation, zero-time pause behavior and invalid input rejection. Together with the unchanged suite, repository verification contains 198 tests: 193 simulation/UI tests plus 5 tooling regressions.

## Scope boundary

UI-005 is a developer-side browser clock, not a server scheduler or production offline simulation. It does not persist clock state, define the final game-time ratio, resume an expedition after a doctrine STOP, change any simulation-core API, or alter event precedence. The manual slider and **DEV: к исходу** remain available for exact inspection.

## Next checkpoint

`UI-006` — add local spatial/time zoom controls so short monster patrol loops and close encounters remain readable beside long caravan routes.
